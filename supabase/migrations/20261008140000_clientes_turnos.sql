-- Clientes, turnos (con exclusión anti-solapamiento) y disponibilidad.

create function private.mi_miembro_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.id from public.miembros m
  where m.auth_user_id = (select auth.uid()) and m.activo
$$;

create function private.puede_ver_recurso(p_recurso uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.tiene_permiso('ver_agendas_ajenas')
    or exists (
      select 1 from public.recursos r
      where r.id = p_recurso and r.miembro_id is not null and r.miembro_id = private.mi_miembro_id()
    )
$$;

revoke all on function private.mi_miembro_id(), private.puede_ver_recurso(uuid) from public, anon, authenticated;
grant execute on function private.mi_miembro_id(), private.puede_ver_recurso(uuid) to authenticated;

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 2 and 80),
  telefono text not null check (telefono ~ '^\+[1-9][0-9]{6,14}$'),
  notas text not null default '' check (char_length(notas) <= 1000),
  created_at timestamptz not null default now(),
  unique (id, negocio_id),
  unique (negocio_id, telefono)
);

create table public.turnos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  recurso_id uuid not null,
  servicio_id uuid not null,
  cliente_id uuid not null,
  inicio timestamptz not null,
  fin timestamptz not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'confirmado', 'completado', 'cancelado', 'no_vino')),
  notas text not null default '' check (char_length(notas) <= 500),
  nota_cliente text not null default '' check (char_length(nota_cliente) <= 500),
  monto_cobrado numeric(10, 2) check (monto_cobrado >= 0),
  created_at timestamptz not null default now(),
  check (fin > inicio),
  foreign key (recurso_id, negocio_id) references public.recursos (id, negocio_id),
  foreign key (servicio_id, negocio_id) references public.servicios (id, negocio_id),
  foreign key (cliente_id, negocio_id) references public.clientes (id, negocio_id),
  exclude using gist (recurso_id with =, tstzrange(inicio, fin) with &&)
    where (estado in ('pendiente', 'confirmado', 'completado'))
);
create index turnos_negocio_inicio_idx on public.turnos (negocio_id, inicio);
create index turnos_recurso_idx on public.turnos (recurso_id, negocio_id);
create index turnos_servicio_idx on public.turnos (servicio_id, negocio_id);
create index turnos_cliente_idx on public.turnos (cliente_id, negocio_id);

revoke all on public.clientes, public.turnos from anon, authenticated;
grant select on public.clientes, public.turnos to authenticated;
grant insert (negocio_id, nombre, telefono, notas) on public.clientes to authenticated;
grant update (nombre, notas) on public.clientes to authenticated;
grant insert (negocio_id, recurso_id, servicio_id, cliente_id, inicio, fin, estado, notas, nota_cliente, monto_cobrado)
  on public.turnos to authenticated;
grant update (estado, notas, monto_cobrado) on public.turnos to authenticated;

alter table public.clientes enable row level security;
alter table public.turnos enable row level security;

create policy clientes_select on public.clientes for select to authenticated
  using (negocio_id = (select private.mi_negocio_id())
    and ((select private.tiene_permiso('gestionar_clientes')) or (select private.tiene_permiso('gestionar_turnos'))));
create policy clientes_insert on public.clientes for insert to authenticated
  with check (negocio_id = (select private.mi_negocio_id())
    and ((select private.tiene_permiso('gestionar_clientes')) or (select private.tiene_permiso('gestionar_turnos'))));
create policy clientes_update on public.clientes for update to authenticated
  using (negocio_id = (select private.mi_negocio_id()) and (select private.tiene_permiso('gestionar_clientes')))
  with check (negocio_id = (select private.mi_negocio_id()) and (select private.tiene_permiso('gestionar_clientes')));

create policy turnos_select on public.turnos for select to authenticated
  using (negocio_id = (select private.mi_negocio_id())
    and (select private.tiene_permiso('gestionar_turnos')) and (select private.puede_ver_recurso(recurso_id)));
create policy turnos_insert on public.turnos for insert to authenticated
  with check (negocio_id = (select private.mi_negocio_id())
    and (select private.tiene_permiso('gestionar_turnos')) and (select private.puede_ver_recurso(recurso_id)));
create policy turnos_update on public.turnos for update to authenticated
  using (negocio_id = (select private.mi_negocio_id())
    and (select private.tiene_permiso('gestionar_turnos')) and (select private.puede_ver_recurso(recurso_id)))
  with check (negocio_id = (select private.mi_negocio_id())
    and (select private.tiene_permiso('gestionar_turnos')) and (select private.puede_ver_recurso(recurso_id)));

-- Disponibilidad: huecos libres de un recurso para un servicio en una fecha (hora local del negocio).
create function private.huecos(p_recurso uuid, p_servicio uuid, p_fecha date)
returns table (inicio timestamptz, fin timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  n public.negocios;
  v_dur int;
  v_len int;
  v_paso int;
  v_dow int;
  v_min int;
  v_ini timestamptz;
  v_fin timestamptz;
  f record;
begin
  select ng.* into n
  from public.negocios ng join public.recursos r on r.negocio_id = ng.id
  where r.id = p_recurso and r.activo;
  if not found then return; end if;

  select s.duracion_min into v_dur
  from public.servicios s
  join public.recurso_servicio rs on rs.servicio_id = s.id and rs.recurso_id = p_recurso
  where s.id = p_servicio and s.activo and s.negocio_id = n.id;
  if not found then return; end if;

  if exists (
    select 1 from public.bloqueos b
    where b.negocio_id = n.id and (b.recurso_id is null or b.recurso_id = p_recurso)
      and p_fecha between b.desde and b.hasta
  ) then return; end if;

  v_len := case when n.modo_turnos = 'fijo' then n.paso_minutos else v_dur end;
  v_paso := case when n.modo_turnos = 'fijo' then n.paso_minutos else 15 end;
  v_dow := extract(dow from p_fecha)::int;

  for f in
    select h.desde_min, h.hasta_min from public.horarios h
    where h.recurso_id = p_recurso and h.dia_semana = v_dow order by h.desde_min
  loop
    v_min := f.desde_min;
    while v_min + v_len <= f.hasta_min loop
      v_ini := (p_fecha::timestamp + make_interval(mins => v_min)) at time zone n.zona_horaria;
      v_fin := v_ini + make_interval(mins => v_len);
      if v_ini >= now() + make_interval(hours => n.anticipacion_min_horas)
         and v_ini <= now() + make_interval(days => n.anticipacion_max_dias)
         and not exists (
           select 1 from public.turnos t
           where t.recurso_id = p_recurso
             and t.estado in ('pendiente', 'confirmado', 'completado')
             and tstzrange(t.inicio, t.fin) && tstzrange(v_ini, v_fin)
         ) then
        inicio := v_ini;
        fin := v_fin;
        return next;
      end if;
      v_min := v_min + v_paso;
    end loop;
  end loop;
end
$$;

create function public.huecos_disponibles(p_recurso uuid, p_servicio uuid, p_fecha date)
returns table (inicio timestamptz, fin timestamptz)
language sql stable security definer set search_path = '' as $$
  select h.inicio, h.fin from private.huecos(p_recurso, p_servicio, p_fecha) h
  where exists (
    select 1 from public.recursos r
    where r.id = p_recurso and r.negocio_id = (select private.mi_negocio_id())
  )
$$;

revoke all on function private.huecos(uuid, uuid, date) from public, anon, authenticated;
revoke all on function public.huecos_disponibles(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.huecos_disponibles(uuid, uuid, date) to authenticated;

-- Unir dos clientes del mismo negocio: mueve turnos y notas al destino y borra el origen.
create function public.unir_clientes(p_origen uuid, p_destino uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_negocio uuid := (select private.mi_negocio_id());
  v_notas text;
begin
  if v_negocio is null or not (select private.tiene_permiso('gestionar_clientes')) then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  if p_origen = p_destino then
    raise exception 'datos_invalidos';
  end if;
  if (select count(*) from public.clientes where id in (p_origen, p_destino) and negocio_id = v_negocio) <> 2 then
    raise exception 'datos_invalidos';
  end if;

  select notas into v_notas from public.clientes where id = p_origen;
  update public.turnos set cliente_id = p_destino where cliente_id = p_origen and negocio_id = v_negocio;
  if v_notas <> '' then
    update public.clientes
    set notas = left(case when notas = '' then v_notas else notas || E'\n' || v_notas end, 1000)
    where id = p_destino;
  end if;
  delete from public.clientes where id = p_origen and negocio_id = v_negocio;
end
$$;

revoke all on function public.unir_clientes(uuid, uuid) from public, anon, authenticated;
grant execute on function public.unir_clientes(uuid, uuid) to authenticated;
