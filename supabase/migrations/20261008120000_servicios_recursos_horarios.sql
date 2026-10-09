-- Servicios, recursos, horarios, bloqueos y configuración de turnos.
create extension if not exists btree_gist with schema extensions;

alter table public.negocios
  add column paso_minutos int not null default 60 check (paso_minutos in (15, 20, 30, 45, 60, 90, 120)),
  add column anticipacion_min_horas int not null default 1 check (anticipacion_min_horas between 0 and 168),
  add column anticipacion_max_dias int not null default 30 check (anticipacion_max_dias between 1 and 365);

-- Para vincular recursos a miembros del mismo negocio
alter table public.miembros add unique (id, negocio_id);

create table public.recursos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 2 and 60),
  miembro_id uuid,
  activo boolean not null default true,
  orden int not null default 0,
  created_at timestamptz not null default now(),
  unique (id, negocio_id),
  unique (negocio_id, nombre),
  foreign key (miembro_id, negocio_id) references public.miembros (id, negocio_id)
);
create index recursos_negocio_idx on public.recursos (negocio_id);
create index recursos_miembro_idx on public.recursos (miembro_id);

create table public.servicios (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 2 and 80),
  duracion_min int not null check (duracion_min between 5 and 480),
  precio numeric(10, 2) not null default 0 check (precio >= 0),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, negocio_id),
  unique (negocio_id, nombre)
);
create index servicios_negocio_idx on public.servicios (negocio_id);

create table public.recurso_servicio (
  recurso_id uuid not null,
  servicio_id uuid not null,
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  primary key (recurso_id, servicio_id),
  foreign key (recurso_id, negocio_id) references public.recursos (id, negocio_id) on delete cascade,
  foreign key (servicio_id, negocio_id) references public.servicios (id, negocio_id) on delete cascade
);
create index recurso_servicio_negocio_idx on public.recurso_servicio (negocio_id);
create index recurso_servicio_servicio_idx on public.recurso_servicio (servicio_id, negocio_id);

create table public.horarios (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  recurso_id uuid not null,
  dia_semana int not null check (dia_semana between 0 and 6),
  desde_min int not null check (desde_min between 0 and 1439),
  hasta_min int not null check (hasta_min between 1 and 1440),
  check (hasta_min > desde_min),
  foreign key (recurso_id, negocio_id) references public.recursos (id, negocio_id) on delete cascade,
  exclude using gist (
    recurso_id with =, dia_semana with =, int4range(desde_min, hasta_min) with &&
  )
);
create index horarios_negocio_idx on public.horarios (negocio_id);

create table public.bloqueos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  recurso_id uuid,
  desde date not null,
  hasta date not null,
  motivo text not null default '' check (char_length(motivo) <= 80),
  check (hasta >= desde),
  foreign key (recurso_id, negocio_id) references public.recursos (id, negocio_id) on delete cascade
);
create index bloqueos_negocio_idx on public.bloqueos (negocio_id);
create index bloqueos_recurso_idx on public.bloqueos (recurso_id, negocio_id);

-- Privilegios
revoke all on public.recursos, public.servicios, public.recurso_servicio, public.horarios, public.bloqueos
  from anon, authenticated;
grant select on public.recursos, public.servicios to authenticated;
grant select, delete on public.recurso_servicio, public.horarios, public.bloqueos to authenticated;
grant insert (negocio_id, recurso_id, servicio_id) on public.recurso_servicio to authenticated;
grant insert (negocio_id, recurso_id, dia_semana, desde_min, hasta_min) on public.horarios to authenticated;
grant insert (negocio_id, recurso_id, desde, hasta, motivo) on public.bloqueos to authenticated;
grant insert (negocio_id, nombre, miembro_id, orden) on public.recursos to authenticated;
grant update (nombre, miembro_id, activo, orden) on public.recursos to authenticated;
grant insert (negocio_id, nombre, duracion_min, precio) on public.servicios to authenticated;
grant update (nombre, duracion_min, precio, activo) on public.servicios to authenticated;
grant update (paso_minutos, anticipacion_min_horas, anticipacion_max_dias) on public.negocios to authenticated;

alter table public.recursos enable row level security;
alter table public.servicios enable row level security;
alter table public.recurso_servicio enable row level security;
alter table public.horarios enable row level security;
alter table public.bloqueos enable row level security;

-- Lectura: cualquier miembro activo del negocio. Escritura: permiso gestionar_servicios.
do $$
declare t text;
begin
  foreach t in array array['recursos', 'servicios', 'recurso_servicio', 'horarios', 'bloqueos'] loop
    execute format($f$create policy %1$s_select on public.%1$s for select to authenticated
      using (negocio_id = (select private.mi_negocio_id()))$f$, t);
    execute format($f$create policy %1$s_insert on public.%1$s for insert to authenticated
      with check (negocio_id = (select private.mi_negocio_id()) and (select private.tiene_permiso('gestionar_servicios')))$f$, t);
  end loop;
  foreach t in array array['recursos', 'servicios'] loop
    execute format($f$create policy %1$s_update on public.%1$s for update to authenticated
      using (negocio_id = (select private.mi_negocio_id()) and (select private.tiene_permiso('gestionar_servicios')))
      with check (negocio_id = (select private.mi_negocio_id()) and (select private.tiene_permiso('gestionar_servicios')))$f$, t);
  end loop;
  foreach t in array array['recurso_servicio', 'horarios', 'bloqueos'] loop
    execute format($f$create policy %1$s_delete on public.%1$s for delete to authenticated
      using (negocio_id = (select private.mi_negocio_id()) and (select private.tiene_permiso('gestionar_servicios')))$f$, t);
  end loop;
end $$;

create policy negocios_update on public.negocios for update to authenticated
  using (id = (select private.mi_negocio_id()) and (select private.tiene_permiso('gestionar_servicios')))
  with check (id = (select private.mi_negocio_id()) and (select private.tiene_permiso('gestionar_servicios')));
