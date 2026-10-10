-- Reserva pública (/b/[slug]): WhatsApp del negocio, dispositivos confiables, límites anti-spam
-- y las funciones que usa el servidor. Las funciones públicas solo las ejecuta service_role:
-- el navegador nunca las llama directo, así la IP que se registra para el límite es confiable.

alter table public.negocios
  add column whatsapp text not null default ''
    check (whatsapp = '' or whatsapp ~ '^\+[1-9][0-9]{6,14}$');
grant update (whatsapp) on public.negocios to authenticated;

-- Un dispositivo (cookie httpOnly; acá solo el hash) de un cliente. Se vuelve confiable cuando el
-- negocio confirma un turno pedido desde él; desde entonces las reservas de ese cliente en ese
-- dispositivo se confirman solas.
create table public.dispositivos_confiables (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  cliente_id uuid not null,
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  confiable boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (cliente_id, negocio_id) references public.clientes (id, negocio_id) on delete cascade,
  unique (negocio_id, cliente_id, token_hash)
);
create index dispositivos_cliente_idx on public.dispositivos_confiables (cliente_id, negocio_id);
create index dispositivos_token_idx on public.dispositivos_confiables (negocio_id, token_hash);

alter table public.turnos
  add column dispositivo_id uuid references public.dispositivos_confiables (id) on delete set null;
create index turnos_dispositivo_idx on public.turnos (dispositivo_id);

revoke all on public.dispositivos_confiables from anon, authenticated;
grant select, delete on public.dispositivos_confiables to authenticated;
alter table public.dispositivos_confiables enable row level security;
create policy dispositivos_select on public.dispositivos_confiables for select to authenticated
  using (negocio_id = (select private.mi_negocio_id()) and (select private.tiene_permiso('gestionar_clientes')));
create policy dispositivos_delete on public.dispositivos_confiables for delete to authenticated
  using (negocio_id = (select private.mi_negocio_id()) and (select private.tiene_permiso('gestionar_clientes')));

-- Confirmar un turno pendiente vuelve confiable el dispositivo desde el que se pidió.
create function private.confiar_dispositivo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.estado = 'pendiente' and new.estado = 'confirmado' and new.dispositivo_id is not null then
    update public.dispositivos_confiables set confiable = true where id = new.dispositivo_id;
  end if;
  return new;
end
$$;
revoke all on function private.confiar_dispositivo() from public, anon, authenticated;
create trigger turnos_confiar_dispositivo after update of estado on public.turnos
  for each row execute function private.confiar_dispositivo();

-- Reservas pedidas desde la página pública, para el límite por IP y por teléfono. Un intento
-- fallido se revierte con su transacción: se cuentan las reservas que llegaron a crearse.
create table private.intentos_reserva (
  id bigserial primary key,
  negocio_id uuid not null,
  ip text not null,
  telefono text not null,
  created_at timestamptz not null default now()
);
create index intentos_ip_idx on private.intentos_reserva (ip, created_at);
create index intentos_tel_idx on private.intentos_reserva (negocio_id, telefono, created_at);
create index intentos_fecha_idx on private.intentos_reserva (created_at);

-- Datos públicos del negocio: nombre, WhatsApp, servicios activos con sus recursos.
create function public.negocio_publico(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', n.id,
    'nombre', n.nombre,
    'tipo', n.tipo,
    'whatsapp', n.whatsapp,
    'anticipacion_max_dias', n.anticipacion_max_dias,
    'servicios', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'nombre', s.nombre, 'duracion_min', s.duracion_min, 'precio', s.precio,
        'recursos', coalesce((
          select jsonb_agg(r.id order by r.orden, r.nombre)
          from public.recurso_servicio rs
          join public.recursos r on r.id = rs.recurso_id and r.activo
          where rs.servicio_id = s.id
        ), '[]'::jsonb)
      ) order by s.nombre)
      from public.servicios s where s.negocio_id = n.id and s.activo
    ), '[]'::jsonb),
    'recursos', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'nombre', r.nombre) order by r.orden, r.nombre)
      from public.recursos r where r.negocio_id = n.id and r.activo
    ), '[]'::jsonb)
  )
  from public.negocios n where n.slug = p_slug
$$;

-- Huecos libres para la página pública. p_recurso null = cualquiera que haga el servicio.
create function public.huecos_publicos(p_negocio uuid, p_servicio uuid, p_recurso uuid, p_fecha date)
returns table (recurso_id uuid, inicio timestamptz, fin timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, h.inicio, h.fin
  from public.recursos r
  join public.recurso_servicio rs on rs.recurso_id = r.id and rs.servicio_id = p_servicio
  cross join lateral private.huecos(r.id, p_servicio, p_fecha) h
  where r.negocio_id = p_negocio and r.activo and (p_recurso is null or r.id = p_recurso)
  order by h.inicio, r.orden, r.nombre
$$;

-- Nombre y teléfono del último cliente confiable de este dispositivo, para precargar el formulario.
create function public.datos_dispositivo(p_negocio uuid, p_token_hash text)
returns table (nombre text, telefono text)
language sql stable security definer set search_path = '' as $$
  select c.nombre, c.telefono
  from public.dispositivos_confiables d
  join public.clientes c on c.id = d.cliente_id
  where d.negocio_id = p_negocio and d.token_hash = p_token_hash and d.confiable
  order by d.created_at desc
  limit 1
$$;

-- Crea el turno pedido desde la página pública. El teléfono llega ya normalizado (E.164).
-- Errores (message): datos_invalidos, horario_ocupado, limite_alcanzado.
create function public.reservar_publico(
  p_negocio uuid, p_servicio uuid, p_recurso uuid, p_inicio timestamptz,
  p_nombre text, p_telefono text, p_nota text, p_token_hash text, p_ip text
) returns table (turno_id uuid, estado text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  n public.negocios;
  v_fecha date;
  v_recurso uuid;
  v_fin timestamptz;
  v_cliente uuid;
  v_disp uuid;
  v_confiable boolean := false;
  v_estado text;
  v_turno uuid;
begin
  select * into n from public.negocios where id = p_negocio;
  if not found or p_telefono !~ '^\+[1-9][0-9]{6,14}$'
     or char_length(btrim(coalesce(p_nombre, ''))) not between 2 and 80
     or (p_token_hash is not null and p_token_hash !~ '^[0-9a-f]{64}$') then
    raise exception 'datos_invalidos';
  end if;

  delete from private.intentos_reserva where created_at < now() - interval '2 days';
  if (select count(*) from private.intentos_reserva
      where ip = p_ip and created_at > now() - interval '1 hour') >= 20
     or (select count(*) from private.intentos_reserva
      where negocio_id = p_negocio and telefono = p_telefono and created_at > now() - interval '1 day') >= 8 then
    raise exception 'limite_alcanzado';
  end if;
  insert into private.intentos_reserva (negocio_id, ip, telefono) values (p_negocio, coalesce(p_ip, ''), p_telefono);

  v_fecha := (p_inicio at time zone n.zona_horaria)::date;
  select h.recurso_id, h.fin into v_recurso, v_fin
  from public.huecos_publicos(p_negocio, p_servicio, p_recurso, v_fecha) h
  where h.inicio = p_inicio
  limit 1;
  if v_recurso is null then
    raise exception 'horario_ocupado';
  end if;

  select id into v_cliente from public.clientes where negocio_id = p_negocio and telefono = p_telefono;
  if v_cliente is null then
    insert into public.clientes (negocio_id, nombre, telefono)
    values (p_negocio, btrim(p_nombre), p_telefono)
    on conflict (negocio_id, telefono) do nothing
    returning id into v_cliente;
    if v_cliente is null then
      select id into v_cliente from public.clientes where negocio_id = p_negocio and telefono = p_telefono;
    end if;
  end if;

  if (select count(*) from public.turnos
      where cliente_id = v_cliente and estado = 'pendiente' and inicio > now()) >= 3 then
    raise exception 'limite_alcanzado';
  end if;

  if p_token_hash is not null then
    select id, confiable into v_disp, v_confiable
    from public.dispositivos_confiables
    where negocio_id = p_negocio and cliente_id = v_cliente and token_hash = p_token_hash;
    if v_disp is null then
      insert into public.dispositivos_confiables (negocio_id, cliente_id, token_hash)
      values (p_negocio, v_cliente, p_token_hash)
      returning id into v_disp;
      v_confiable := false;
    end if;
  end if;

  v_estado := case when coalesce(v_confiable, false) then 'confirmado' else 'pendiente' end;
  begin
    insert into public.turnos (negocio_id, recurso_id, servicio_id, cliente_id, inicio, fin, estado, nota_cliente, dispositivo_id)
    values (p_negocio, v_recurso, p_servicio, v_cliente, p_inicio, v_fin, v_estado, left(coalesce(p_nota, ''), 500), v_disp)
    returning id into v_turno;
  exception when exclusion_violation then
    raise exception 'horario_ocupado';
  end;

  return query select v_turno, v_estado;
end
$$;

revoke all on function public.negocio_publico(text) from public, anon, authenticated;
revoke all on function public.huecos_publicos(uuid, uuid, uuid, date) from public, anon, authenticated;
revoke all on function public.datos_dispositivo(uuid, text) from public, anon, authenticated;
revoke all on function public.reservar_publico(uuid, uuid, uuid, timestamptz, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.negocio_publico(text) to service_role;
grant execute on function public.huecos_publicos(uuid, uuid, uuid, date) to service_role;
grant execute on function public.datos_dispositivo(uuid, text) to service_role;
grant execute on function public.reservar_publico(uuid, uuid, uuid, timestamptz, text, text, text, text, text)
  to service_role;
