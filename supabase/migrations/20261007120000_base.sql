-- Esquema base: negocios, roles, miembros, RLS y alta de negocio.

create schema if not exists private;
grant usage on schema private to authenticated;

create table public.negocios (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40),
  nombre text not null check (char_length(nombre) between 2 and 80),
  tipo text not null check (tipo in ('cancha', 'peluqueria', 'estetica')),
  zona_horaria text not null default 'America/Argentina/Buenos_Aires',
  vende_productos boolean not null default false,
  modo_turnos text not null check (modo_turnos in ('fijo', 'editable')),
  created_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  nombre text not null check (char_length(nombre) between 2 and 40),
  permisos jsonb not null default '{}'::jsonb,
  es_dueno boolean not null default false,
  unique (negocio_id, nombre),
  unique (id, negocio_id)
);
create unique index roles_un_dueno_por_negocio on public.roles (negocio_id) where es_dueno;

create table public.miembros (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  rol_id uuid not null,
  nombre text not null check (char_length(nombre) between 2 and 80),
  usuario text not null check (usuario ~ '^[a-z0-9._-]{3,30}$'),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (negocio_id, usuario),
  -- el rol debe pertenecer al mismo negocio (aislamiento estructural)
  foreign key (rol_id, negocio_id) references public.roles (id, negocio_id)
);
create index miembros_negocio_idx on public.miembros (negocio_id);
create index miembros_rol_idx on public.miembros (rol_id);

-- Funciones auxiliares (security definer para evitar recursión de RLS)
create function private.mi_negocio_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.negocio_id from public.miembros m
  where m.auth_user_id = (select auth.uid()) and m.activo
$$;

create function private.es_dueno() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select r.es_dueno
    from public.miembros m join public.roles r on r.id = m.rol_id
    where m.auth_user_id = (select auth.uid()) and m.activo
  ), false)
$$;

create function private.tiene_permiso(p_permiso text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select r.es_dueno or (r.permisos ->> p_permiso) = 'true'
    from public.miembros m join public.roles r on r.id = m.rol_id
    where m.auth_user_id = (select auth.uid()) and m.activo
  ), false)
$$;

create function private.slugs_reservados() returns text[]
language sql immutable set search_path = '' as $$
  select array['panel', 'login', 'registro', 'salir', 'api', 'b', 'admin', 'app', 'www', 'static', 'assets', 'soporte']
$$;

revoke all on function private.mi_negocio_id(), private.es_dueno(),
  private.tiene_permiso(text), private.slugs_reservados() from public, anon, authenticated;
grant execute on function private.mi_negocio_id(), private.es_dueno(), private.tiene_permiso(text)
  to authenticated;

-- Privilegios: solo lectura general; escritura acotada por columna
revoke all on public.negocios, public.roles, public.miembros from anon, authenticated;
grant select on public.negocios, public.roles, public.miembros to authenticated;
grant update (permisos) on public.roles to authenticated;
grant update (nombre, rol_id, activo) on public.miembros to authenticated;

alter table public.negocios enable row level security;
alter table public.roles enable row level security;
alter table public.miembros enable row level security;

create policy negocios_select on public.negocios for select to authenticated
  using (id = (select private.mi_negocio_id()));

create policy roles_select on public.roles for select to authenticated
  using (negocio_id = (select private.mi_negocio_id()));

create policy roles_update on public.roles for update to authenticated
  using (negocio_id = (select private.mi_negocio_id()) and not es_dueno and (select private.es_dueno()))
  with check (negocio_id = (select private.mi_negocio_id()) and not es_dueno and (select private.es_dueno()));

create policy miembros_select on public.miembros for select to authenticated
  using (negocio_id = (select private.mi_negocio_id()));

create policy miembros_update on public.miembros for update to authenticated
  using (
    negocio_id = (select private.mi_negocio_id())
    and (select private.es_dueno())
    and not exists (select 1 from public.roles r where r.id = rol_id and r.es_dueno)
  )
  with check (
    negocio_id = (select private.mi_negocio_id())
    and (select private.es_dueno())
    and not exists (select 1 from public.roles r where r.id = rol_id and r.es_dueno)
  );

-- RPC pública: disponibilidad de slug
create function public.slug_disponible(p_slug text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and char_length(p_slug) between 3 and 40
    and not (p_slug = any (private.slugs_reservados()))
    and not exists (select 1 from public.negocios where slug = p_slug)
$$;

revoke all on function public.slug_disponible(text) from public, anon, authenticated;
grant execute on function public.slug_disponible(text) to anon, authenticated;

-- RPC: alta atómica de negocio + roles + miembro dueño
create function public.crear_negocio(
  p_nombre text, p_slug text, p_tipo text, p_vende_productos boolean,
  p_modo_turnos text, p_nombre_dueno text, p_roles jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_negocio uuid;
  v_rol jsonb;
  v_rol_id uuid;
  v_rol_dueno uuid;
begin
  if v_uid is null then
    raise exception 'no_autenticado' using errcode = '28000';
  end if;
  if exists (select 1 from public.miembros where auth_user_id = v_uid) then
    raise exception 'ya_tiene_negocio';
  end if;
  if p_slug = any (private.slugs_reservados()) then
    raise exception 'slug_reservado';
  end if;
  if jsonb_typeof(p_roles) <> 'array'
     or (select count(*) from jsonb_array_elements(p_roles) r
         where coalesce((r ->> 'es_dueno')::boolean, false)) <> 1 then
    raise exception 'roles_invalidos';
  end if;

  insert into public.negocios (slug, nombre, tipo, vende_productos, modo_turnos)
  values (p_slug, p_nombre, p_tipo, p_vende_productos, p_modo_turnos)
  returning id into v_negocio;

  for v_rol in select * from jsonb_array_elements(p_roles) loop
    insert into public.roles (negocio_id, nombre, permisos, es_dueno)
    values (
      v_negocio,
      v_rol ->> 'nombre',
      coalesce(v_rol -> 'permisos', '{}'::jsonb),
      coalesce((v_rol ->> 'es_dueno')::boolean, false)
    )
    returning id into v_rol_id;
    if coalesce((v_rol ->> 'es_dueno')::boolean, false) then
      v_rol_dueno := v_rol_id;
    end if;
  end loop;

  insert into public.miembros (negocio_id, auth_user_id, rol_id, nombre, usuario)
  values (v_negocio, v_uid, v_rol_dueno, p_nombre_dueno, 'dueno');

  return v_negocio;
end
$$;

revoke all on function public.crear_negocio(text, text, text, boolean, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.crear_negocio(text, text, text, boolean, text, text, jsonb)
  to authenticated;
