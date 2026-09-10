-- schema.sql
-- Esquema de la base de datos del Sistema de Turnos.
--
-- Diseñado para multicliente desde el día uno: todas las tablas de datos
-- tienen negocio_id, aunque hoy solo exista un negocio cargado. El día que
-- se sume un segundo cliente, no hace falta tocar el esquema — alcanza con
-- agregar una fila en "negocios" y usuarios con ese negocio_id.
--
-- Cómo correr esto: pegar todo el contenido de este archivo en el SQL
-- Editor de Vercel Postgres (o en cualquier cliente de Postgres apuntando
-- a la base) y ejecutarlo una sola vez, al crear la base.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------
-- Negocios (cada cliente de pago es un negocio)
-- ------------------------------------------------------------------
create table if not exists negocios (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,        -- identificador corto en URLs/config, ej: "miriam"
  nombre      text not null,
  whatsapp    text,                        -- número para el botón "Consultar por WhatsApp" de la tienda
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- Usuarios (tanto administradores como clientes; se diferencian por rol)
-- ------------------------------------------------------------------
create table if not exists usuarios (
  id             uuid primary key default gen_random_uuid(),
  negocio_id     uuid not null references negocios(id) on delete cascade,
  rol            text not null check (rol in ('admin','cliente')),
  nombre         text not null,
  telefono       text,
  email          text not null,
  password_hash  text not null,
  created_at     timestamptz not null default now(),
  unique (negocio_id, email)
);

create index if not exists idx_usuarios_negocio on usuarios(negocio_id);

-- ------------------------------------------------------------------
-- Turnos
-- ------------------------------------------------------------------
create table if not exists turnos (
  id              uuid primary key default gen_random_uuid(),
  negocio_id      uuid not null references negocios(id) on delete cascade,
  cliente_id      uuid references usuarios(id) on delete set null,
  cliente_nombre  text,        -- respaldo para turnos sin cuenta vinculada (cargados a mano por el admin)
  servicio        text not null,
  fecha           date not null,
  hora            text not null,
  estado          text not null default 'pendiente'
                    check (estado in ('pendiente','confirmado','completado','cancelado')),
  notas           text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_turnos_negocio on turnos(negocio_id);
create index if not exists idx_turnos_cliente on turnos(cliente_id);
create index if not exists idx_turnos_fecha on turnos(negocio_id, fecha);

-- ------------------------------------------------------------------
-- Productos (catálogo / tienda)
-- ------------------------------------------------------------------
create table if not exists productos (
  id           uuid primary key default gen_random_uuid(),
  negocio_id   uuid not null references negocios(id) on delete cascade,
  nombre       text not null,
  categoria    text,
  precio       numeric(12,2) not null default 0,
  costo        numeric(12,2) not null default 0,   -- no se expone públicamente, solo para calcular margen
  stock        integer not null default 0,
  descripcion  text,
  activo       boolean not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists idx_productos_negocio on productos(negocio_id);

-- ------------------------------------------------------------------
-- Ventas (para el panel de Análisis)
-- ------------------------------------------------------------------
create table if not exists ventas (
  id                uuid primary key default gen_random_uuid(),
  negocio_id        uuid not null references negocios(id) on delete cascade,
  producto_id       uuid references productos(id) on delete set null,
  producto_nombre   text not null,      -- copia del nombre al momento de la venta (por si el producto se borra despues)
  cantidad          integer not null check (cantidad > 0),
  precio_unitario   numeric(12,2) not null,
  costo_unitario    numeric(12,2) not null,
  fecha             date not null,
  cliente_id        uuid references usuarios(id) on delete set null,
  cliente_nombre    text,
  created_at        timestamptz not null default now()
);

create index if not exists idx_ventas_negocio on ventas(negocio_id);
create index if not exists idx_ventas_fecha on ventas(negocio_id, fecha);

-- ------------------------------------------------------------------
-- Carga inicial: el negocio de Miriam
-- (Editar nombre/whatsapp/slug según corresponda antes de correr esto)
-- ------------------------------------------------------------------
insert into negocios (slug, nombre, whatsapp)
values ('miriam', 'Sistema de Turnos', '5493624000000')
on conflict (slug) do nothing;
