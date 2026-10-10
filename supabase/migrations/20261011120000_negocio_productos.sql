-- Mi negocio (perfil y marca) y productos (catálogo, stock y ventas).

-- Perfil y marca. Se editan solo con public.guardar_negocio (permiso editar_negocio), así un
-- permiso de turnos no alcanza para cambiar la marca.
alter table public.negocios
  add column descripcion text not null default '' check (char_length(descripcion) <= 500),
  add column direccion text not null default '' check (char_length(direccion) <= 120),
  add column instagram text not null default '' check (instagram = '' or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  add column color text not null default '#1c1917' check (color ~ '^#[0-9a-f]{6}$'),
  add column logo_url text not null default '' check (char_length(logo_url) <= 500);

-- Imágenes (logos y fotos de productos): lectura pública; solo el servidor sube con service_role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imagenes', 'imagenes', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Una URL de imagen válida para el negocio: vacía o del bucket público, dentro de su carpeta.
create function private.url_imagen_valida(p_url text, p_negocio uuid) returns boolean
language sql immutable set search_path = '' as $$
  select p_url = '' or p_url ~ ('^https?://[^/]+/storage/v1/object/public/imagenes/' || p_negocio::text || '/[A-Za-z0-9._-]+$')
$$;

create function public.guardar_negocio(
  p_nombre text, p_descripcion text, p_direccion text, p_instagram text,
  p_color text, p_whatsapp text, p_vende_productos boolean
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_negocio uuid := (select private.mi_negocio_id());
begin
  if v_negocio is null or not (select private.tiene_permiso('editar_negocio')) then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  update public.negocios set
    nombre = btrim(p_nombre),
    descripcion = coalesce(p_descripcion, ''),
    direccion = btrim(coalesce(p_direccion, '')),
    instagram = coalesce(p_instagram, ''),
    color = p_color,
    whatsapp = coalesce(p_whatsapp, ''),
    vende_productos = p_vende_productos
  where id = v_negocio;
end
$$;

create function public.guardar_logo(p_url text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_negocio uuid := (select private.mi_negocio_id());
begin
  if v_negocio is null or not (select private.tiene_permiso('editar_negocio')) then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  if not private.url_imagen_valida(coalesce(p_url, ''), v_negocio) then
    raise exception 'datos_invalidos';
  end if;
  update public.negocios set logo_url = coalesce(p_url, '') where id = v_negocio;
end
$$;

revoke all on function private.url_imagen_valida(text, uuid) from public, anon, authenticated;
grant execute on function private.url_imagen_valida(text, uuid) to authenticated;
revoke all on function public.guardar_negocio(text, text, text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.guardar_logo(text) from public, anon, authenticated;
grant execute on function public.guardar_negocio(text, text, text, text, text, text, boolean) to authenticated;
grant execute on function public.guardar_logo(text) to authenticated;

-- Productos y ventas.
create table public.productos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 2 and 80),
  descripcion text not null default '' check (char_length(descripcion) <= 500),
  precio numeric(10, 2) not null default 0 check (precio >= 0),
  costo numeric(10, 2) check (costo >= 0),
  stock int not null default 0 check (stock between 0 and 1000000),
  foto_url text not null default '' check (char_length(foto_url) <= 500),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, negocio_id),
  unique (negocio_id, nombre),
  check (private.url_imagen_valida(foto_url, negocio_id))
);
create index productos_negocio_idx on public.productos (negocio_id);

create table public.ventas (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  producto_id uuid not null,
  cantidad int not null check (cantidad between 1 and 1000),
  monto numeric(10, 2) not null check (monto >= 0),
  cliente_id uuid,
  miembro_id uuid references public.miembros (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (producto_id, negocio_id) references public.productos (id, negocio_id),
  foreign key (cliente_id, negocio_id) references public.clientes (id, negocio_id)
);
create index ventas_negocio_fecha_idx on public.ventas (negocio_id, created_at desc);
create index ventas_producto_idx on public.ventas (producto_id, negocio_id);
create index ventas_cliente_idx on public.ventas (cliente_id, negocio_id);

revoke all on public.productos, public.ventas from anon, authenticated;
grant select on public.productos, public.ventas to authenticated;
grant insert (negocio_id, nombre, descripcion, precio, costo, stock, foto_url, activo) on public.productos to authenticated;
grant update (nombre, descripcion, precio, costo, stock, foto_url, activo) on public.productos to authenticated;

alter table public.productos enable row level security;
alter table public.ventas enable row level security;

create policy productos_select on public.productos for select to authenticated
  using (negocio_id = (select private.mi_negocio_id())
    and ((select private.tiene_permiso('editar_catalogo')) or (select private.tiene_permiso('registrar_ventas'))));
create policy productos_insert on public.productos for insert to authenticated
  with check (negocio_id = (select private.mi_negocio_id()) and (select private.tiene_permiso('editar_catalogo')));
create policy productos_update on public.productos for update to authenticated
  using (negocio_id = (select private.mi_negocio_id()) and (select private.tiene_permiso('editar_catalogo')))
  with check (negocio_id = (select private.mi_negocio_id()) and (select private.tiene_permiso('editar_catalogo')));

create policy ventas_select on public.ventas for select to authenticated
  using (negocio_id = (select private.mi_negocio_id())
    and ((select private.tiene_permiso('registrar_ventas')) or (select private.tiene_permiso('ver_ingresos'))));

-- Registrar una venta descuenta stock en la misma transacción. Sin stock suficiente falla con
-- stock_insuficiente, salvo que se confirme (p_forzar): entonces el stock queda en 0.
create function public.registrar_venta(
  p_producto uuid, p_cantidad int, p_monto numeric, p_cliente uuid, p_forzar boolean
) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_negocio uuid := (select private.mi_negocio_id());
  p public.productos;
  v_monto numeric;
  v_stock int;
begin
  if v_negocio is null or not (select private.tiene_permiso('registrar_ventas')) then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  if p_cantidad is null or p_cantidad not between 1 and 1000 or (p_monto is not null and p_monto < 0) then
    raise exception 'datos_invalidos';
  end if;
  select * into p from public.productos
  where id = p_producto and negocio_id = v_negocio and activo
  for update;
  if not found then
    raise exception 'datos_invalidos';
  end if;
  if p_cliente is not null and not exists (
    select 1 from public.clientes where id = p_cliente and negocio_id = v_negocio
  ) then
    raise exception 'datos_invalidos';
  end if;
  if p.stock < p_cantidad and not coalesce(p_forzar, false) then
    raise exception 'stock_insuficiente';
  end if;

  v_monto := coalesce(p_monto, p.precio * p_cantidad);
  v_stock := greatest(p.stock - p_cantidad, 0);
  update public.productos set stock = v_stock where id = p.id;
  insert into public.ventas (negocio_id, producto_id, cantidad, monto, cliente_id, miembro_id)
  values (v_negocio, p.id, p_cantidad, v_monto, p_cliente, (select private.mi_miembro_id()));
  return v_stock;
end
$$;

-- Anular una venta del día (un error de carga): devuelve el stock y la borra.
create function public.anular_venta(p_venta uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_negocio uuid := (select private.mi_negocio_id());
  v public.ventas;
begin
  if v_negocio is null or not (select private.tiene_permiso('registrar_ventas')) then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  select * into v from public.ventas where id = p_venta and negocio_id = v_negocio for update;
  if not found or v.created_at < now() - interval '24 hours' then
    raise exception 'datos_invalidos';
  end if;
  update public.productos set stock = least(stock + v.cantidad, 1000000) where id = v.producto_id;
  delete from public.ventas where id = v.id;
end
$$;

revoke all on function public.registrar_venta(uuid, int, numeric, uuid, boolean) from public, anon, authenticated;
revoke all on function public.anular_venta(uuid) from public, anon, authenticated;
grant execute on function public.registrar_venta(uuid, int, numeric, uuid, boolean) to authenticated;
grant execute on function public.anular_venta(uuid) to authenticated;

-- Unir clientes ahora también mueve sus ventas.
create or replace function public.unir_clientes(p_origen uuid, p_destino uuid) returns void
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
  update public.ventas set cliente_id = p_destino where cliente_id = p_origen and negocio_id = v_negocio;
  if v_notas <> '' then
    update public.clientes
    set notas = left(case when notas = '' then v_notas else notas || E'\n' || v_notas end, 1000)
    where id = p_destino;
  end if;
  delete from public.clientes where id = p_origen and negocio_id = v_negocio;
end
$$;

-- Datos públicos: suma marca y catálogo (sin costo ni stock exacto).
create or replace function public.negocio_publico(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', n.id,
    'nombre', n.nombre,
    'tipo', n.tipo,
    'whatsapp', n.whatsapp,
    'anticipacion_max_dias', n.anticipacion_max_dias,
    'descripcion', n.descripcion,
    'direccion', n.direccion,
    'instagram', n.instagram,
    'color', n.color,
    'logo_url', n.logo_url,
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
    ), '[]'::jsonb),
    'productos', case when n.vende_productos then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'nombre', p.nombre, 'descripcion', p.descripcion, 'precio', p.precio,
        'foto_url', p.foto_url, 'hay_stock', p.stock > 0
      ) order by p.nombre)
      from public.productos p where p.negocio_id = n.id and p.activo
    ), '[]'::jsonb) else '[]'::jsonb end
  )
  from public.negocios n where n.slug = p_slug
$$;
