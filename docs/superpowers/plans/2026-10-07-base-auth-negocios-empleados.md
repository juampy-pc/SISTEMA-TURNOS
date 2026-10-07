# Base: auth, negocios, roles, empleados y onboarding — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar funcionando el sub-proyecto 1 del sistema de turnos SaaS: registro de un negocio (con tipo y preguntas de configuración), login de dueño y empleados, panel con menú según permisos y gestión de empleados y roles, todo aislado por negocio con RLS.

**Architecture:** Next.js 16 (App Router) + Supabase (Postgres, Auth). Una sola base; cada tabla lleva `negocio_id` y RLS lo aísla. El alta de un negocio es una función Postgres (`crear_negocio`) que crea negocio, roles y miembro dueño en una transacción. Los empleados son usuarios de Supabase Auth con un email interno derivado de `usuario` + slug del negocio (nunca se les pide email). La lógica de dominio (permisos, plantillas, slug, menú) es TypeScript puro y testeado con Vitest; la seguridad se prueba en la base con pgTAP; el flujo completo con Playwright.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind, `@supabase/ssr`, `@supabase/supabase-js`, zod 4, Vitest, pgTAP (`supabase test db`), Playwright, Supabase CLI (requiere Docker).

**Spec:** `docs/superpowers/specs/2026-10-07-sistema-turnos-saas-design.md`

**Alcance de este plan (sub-proyecto 1 de 5) y desvíos respecto del spec:**
- El paso 4 del onboarding (recursos precargados) y el alta de servicios/horarios de plantilla **se mueven al sub-proyecto 2**, porque las tablas `recursos`, `servicios` y `horarios` se crean ahí. Aquí el onboarding tiene 3 pasos y la plantilla aporta vocabulario, valores sugeridos y tips.
- Un usuario de Auth pertenece a **un solo** negocio (`miembros.auth_user_id` único).
- El slug no se puede cambiar después de creado el negocio (el login de empleados lo usa para derivar el email interno).
- La gestión de empleados y de permisos de roles es exclusiva del dueño (`es_dueno`), no es un permiso activable.
- No hay verificación de email ni recuperación de contraseña en este sub-proyecto.

## Global Constraints

- Stack: Next.js (App Router) en Vercel; Supabase (Postgres, Auth, Storage).
- Multi-tenancy: una sola base, `negocio_id` en cada tabla, aislamiento con RLS.
- Los permisos se aplican en la base (RLS), no solo ocultando botones.
- Los empleados entran con usuario y contraseña, sin email; el dueño entra con email.
- Tres roles por defecto: Dueño (todo), Recepción (turnos, clientes, cobros, ventas; sin ingresos ni métricas), Profesional (su propia agenda y marcar cobrado).
- Tipos de negocio: cancha, peluquería/barbería, estética (claves `cancha`, `peluqueria`, `estetica`). `modo_turnos`: `fijo` o `editable`.
- URL pública de cada negocio: `/b/[slug]` (la ruta se implementa en el sub-proyecto 3; aquí `b` queda reservado como slug).
- Principio rector: tareas frecuentes en pocos toques, desde el celular, con valores precargados; lo opcional es opcional.
- Toda la interfaz está en español rioplatense (voseo: "Sumá", "Creá").
- Cada commit termina con la línea `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Directorio de trabajo: `/home/juan/proyectos/sistema-turnos`, rama `rewrite-saas`.

## Review Focus

1. **Slug inválido o reservado** (`panel`, `login`, mayúsculas, tildes, muy corto): debe rechazarse con mensaje claro y nunca crear el negocio. → pgTAP (Task 2) y tests de `slug.ts`/`esquemas.ts` (Task 4).
2. **Dos registros con el mismo slug a la vez:** el segundo falla con "link en uso", no queda un usuario huérfano en Auth y puede reintentar con otro. → pgTAP (23505, Task 2), limpieza en `registrar` (Task 7) y e2e de slug ocupado (Task 11).
3. **Empleado desactivado con la sesión abierta:** en la siguiente request pierde acceso y vuelve al login sin quedar en un bucle de redirecciones. → pgTAP (Task 2), ruta `/salir` (Task 6) y e2e (Task 11).
4. **El rol Dueño y el miembro dueño son intocables:** nadie puede cambiar sus permisos, desactivarlo ni promover a otro a dueño. → pgTAP (Task 2).
5. **Usuario de empleado con mayúsculas o espacios** (`"  Juan "`) y **mismo usuario en dos negocios:** se normaliza y ambos negocios pueden tener `juan`. → tests de `empleados.ts` (Task 4) y pgTAP (Task 2).

---

## Mapa de archivos

```
src/
  proxy.ts                               # refresca sesión y protege /panel
  app/
    layout.tsx, globals.css, page.tsx    # raíz y landing mínima
    salir/route.ts                       # cierra sesión y vuelve al login (GET)
    (auth)/registro/{page.tsx,RegistroForm.tsx,actions.ts}
    (auth)/login/{page.tsx,LoginForm.tsx,actions.ts}
    panel/{layout.tsx,page.tsx,actions.ts}
    panel/empleados/{page.tsx,actions.ts}
  lib/
    supabase/{server.ts,admin.ts,database.types.ts}
    panel/contexto.ts                    # negocio + miembro + rol de la sesión
    dominio/
      permisos.ts      plantillas.ts    slug.ts
      empleados.ts     esquemas.ts      menu.ts     checklist.ts
      (cada uno con su *.test.ts al lado)
supabase/
  config.toml
  migrations/20261007120000_base.sql
  tests/base.test.sql
e2e/panel.spec.ts
playwright.config.ts, vitest.config.ts
scripts/env-local.sh
```

---

### Task 1: Reiniciar el repo y crear el proyecto Next.js

**Files:**
- Delete: todos los archivos del proyecto anterior (siguen en `main`).
- Create: proyecto Next.js, `vitest.config.ts`, `src/lib/dominio/sanity.test.ts` (temporal).

**Interfaces:**
- Produces: scripts npm `dev`, `build`, `lint`, `typecheck`, `test`; alias `@/*` → `src/*`.

- [ ] **Step 1: Quitar el código anterior**

```bash
cd /home/juan/proyectos/sistema-turnos
git rm -rq admin.html admin.js api client.js db images index.html lib package-lock.json package.json robots.txt SETUP_BACKEND.md storage.js style.css .env.example .gitignore
ls -A
```
Expected: solo quedan `.git` y `docs`.

- [ ] **Step 2: Crear la app Next.js**

```bash
npx create-next-app@16 . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --turbopack --yes
```
Expected: se crean `package.json`, `src/app`, `.gitignore` (que ignora `.env*`), etc. Si el comando se queja de que el directorio no está vacío por `docs/`, moverlo temporalmente (`mv docs ../docs-tmp`), correr el comando y devolverlo (`mv ../docs-tmp docs`).

- [ ] **Step 3: Instalar dependencias**

```bash
npm i @supabase/supabase-js @supabase/ssr zod server-only
npm i -D vitest @playwright/test supabase
```

- [ ] **Step 4: Configurar Vitest y scripts**

Crear `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { include: ['src/**/*.test.ts'] },
});
```

En `package.json`, dentro de `"scripts"`, agregar (conservando los que ya existen):

```json
"typecheck": "tsc --noEmit",
"test": "vitest run",
"test:db": "supabase test db",
"test:e2e": "playwright test"
```

- [ ] **Step 5: Verificar que Vitest corre**

Crear `src/lib/dominio/sanity.test.ts`:

```ts
import { expect, test } from 'vitest';

test('vitest funciona', () => {
  expect(1 + 1).toBe(2);
});
```

Run: `npm test`
Expected: PASS (1 test).

- [ ] **Step 6: Eliminar el test temporal, verificar build y commitear**

```bash
rm src/lib/dominio/sanity.test.ts
npm run lint && npm run typecheck && npm run build
git add -A
git commit -m "chore: reiniciar proyecto como app Next.js 16

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
Expected: lint, typecheck y build sin errores.

---

### Task 2: Base de datos: esquema, RLS y función `crear_negocio` (con pgTAP)

**Files:**
- Create: `supabase/config.toml` (por `supabase init`), `supabase/migrations/20261007120000_base.sql`, `supabase/tests/base.test.sql`, `scripts/env-local.sh`, `.env.example`, `src/lib/supabase/database.types.ts` (generado).

**Interfaces:**
- Produces (SQL): tablas `negocios`, `roles`, `miembros`; funciones `private.mi_negocio_id() → uuid`, `private.es_dueno() → boolean`, `private.tiene_permiso(text) → boolean`; RPC `public.slug_disponible(p_slug text) → boolean` (anon + authenticated) y `public.crear_negocio(p_nombre text, p_slug text, p_tipo text, p_vende_productos boolean, p_modo_turnos text, p_nombre_dueno text, p_roles jsonb) → uuid` (authenticated). `p_roles` es un array `[{nombre, es_dueno, permisos}]` con exactamente un `es_dueno = true`.
- Consumes: nada.

**Requisito previo:** Docker instalado y corriendo (`docker --version` y `docker ps` sin error). En esta máquina no está instalado: instalarlo antes de empezar (https://docs.docker.com/engine/install/) y agregar al usuario al grupo `docker`.

- [ ] **Step 1: Inicializar Supabase local y levantarlo**

```bash
npx supabase init --with-vscode-settings=false --with-intellij-settings=false
npx supabase start
```
Expected: `supabase start` termina mostrando URLs y llaves. En `supabase/config.toml` verificar que `[auth.email] enable_confirmations = false`.

- [ ] **Step 2: Escribir el test pgTAP (falla porque no existe el esquema)**

Crear `supabase/tests/base.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

create function public.test_roles() returns jsonb language sql as $$
  select '[
    {"nombre":"Dueño","es_dueno":true,"permisos":{}},
    {"nombre":"Recepción","es_dueno":false,"permisos":{"gestionar_turnos":true,"gestionar_clientes":true}},
    {"nombre":"Profesional","es_dueno":false,"permisos":{"gestionar_turnos":true}}
  ]'::jsonb
$$;

-- Usuarios: A dueña de barberia-uno, B dueño de cancha-b, E empleado de A, C empleado de B
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.com'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e@test.com'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@test.com');

-- slug_disponible (1-4)
select ok(public.slug_disponible('mi-cancha'), 'un slug libre y válido está disponible');
select ok(not public.slug_disponible('panel'), 'un slug reservado no está disponible');
select ok(not public.slug_disponible('ab'), 'un slug demasiado corto no está disponible');
select ok(not public.slug_disponible('Mayus'), 'un slug con mayúsculas no es válido');

-- A crea su negocio (5-9)
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
select isnt(public.crear_negocio('Barbería Uno', 'barberia-uno', 'peluqueria', true, 'editable', 'Ana', public.test_roles()), null, 'A crea su negocio');
select is((select count(*)::int from public.negocios), 1, 'A ve su negocio');
select is((select count(*)::int from public.roles), 3, 'se crearon los 3 roles');
select is((select count(*)::int from public.miembros), 1, 'se creó el miembro dueño');
select ok(not public.slug_disponible('barberia-uno'), 'el slug tomado deja de estar disponible');
select throws_ok(
  $$select public.crear_negocio('Otro', 'otro-negocio', 'cancha', false, 'fijo', 'Ana', public.test_roles())$$,
  'P0001', 'ya_tiene_negocio', 'un usuario no puede crear dos negocios');

-- B: slug repetido falla, luego crea el suyo (10-13)
reset role;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.crear_negocio('Copia', 'barberia-uno', 'cancha', false, 'fijo', 'Beto', public.test_roles())$$,
  '23505', null, 'un slug repetido falla');
select isnt(public.crear_negocio('Cancha B', 'cancha-b', 'cancha', false, 'fijo', 'Beto', public.test_roles()), null, 'B crea su negocio');
select is((select count(*)::int from public.negocios), 1, 'B solo ve un negocio');
select is((select slug from public.negocios), 'cancha-b', 'y es el suyo');

-- El mismo usuario puede existir en dos negocios (14)
reset role;
insert into public.miembros (negocio_id, auth_user_id, rol_id, nombre, usuario)
  select n.id, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', r.id, 'Eva', 'juan'
  from public.negocios n join public.roles r on r.negocio_id = n.id
  where n.slug = 'barberia-uno' and r.nombre = 'Recepción';
select lives_ok($$
  insert into public.miembros (negocio_id, auth_user_id, rol_id, nombre, usuario)
    select n.id, 'cccccccc-cccc-cccc-cccc-cccccccccccc', r.id, 'Carlos', 'juan'
    from public.negocios n join public.roles r on r.negocio_id = n.id
    where n.slug = 'cancha-b' and r.nombre = 'Profesional'
$$, 'el mismo usuario puede existir en dos negocios');

-- E (Recepción de A): permisos y límites (15-18)
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","role":"authenticated"}', true);
set local role authenticated;
select ok(not private.tiene_permiso('ver_ingresos'), 'Recepción no ve ingresos');
select ok(private.tiene_permiso('gestionar_turnos'), 'Recepción gestiona turnos');
select ok(not private.es_dueno(), 'Recepción no es dueño');
update public.roles set permisos = '{"ver_ingresos":true}'::jsonb where nombre = 'Profesional';
reset role;
select is(
  (select r.permisos from public.roles r join public.negocios n on n.id = r.negocio_id where n.slug = 'barberia-uno' and r.nombre = 'Profesional'),
  '{"gestionar_turnos": true}'::jsonb, 'un empleado no puede cambiar permisos de roles');

-- A (dueña): puede editar roles no-dueño, pero no el rol dueño ni columnas protegidas (19-25)
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
select ok(private.es_dueno(), 'A es dueña');
select ok(private.tiene_permiso('ver_ingresos'), 'el dueño tiene todos los permisos sin listarlos');
select throws_ok($$update public.miembros set usuario = 'x' where usuario = 'juan'$$, '42501', null, 'la columna usuario no se puede editar');
select throws_ok($$update public.roles set es_dueno = true where nombre = 'Recepción'$$, '42501', null, 'la columna es_dueno no se puede editar');
update public.roles set permisos = '{"registrar_ventas":true}'::jsonb where nombre = 'Recepción';
update public.roles set permisos = '{"ver_ingresos":false}'::jsonb where es_dueno;
update public.miembros set activo = false where usuario = 'dueno';
reset role;
select is(
  (select r.permisos from public.roles r join public.negocios n on n.id = r.negocio_id where n.slug = 'barberia-uno' and r.nombre = 'Recepción'),
  '{"registrar_ventas": true}'::jsonb, 'el dueño edita permisos de un rol no-dueño');
select is(
  (select r.permisos from public.roles r join public.negocios n on n.id = r.negocio_id where n.slug = 'barberia-uno' and r.es_dueno),
  '{}'::jsonb, 'el rol dueño no se puede modificar');
select ok(
  (select m.activo from public.miembros m join public.negocios n on n.id = m.negocio_id where n.slug = 'barberia-uno' and m.usuario = 'dueno'),
  'el miembro dueño no se puede desactivar');

-- A desactiva a E; E pierde acceso (26-27)
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$update public.miembros set activo = false where usuario = 'juan'$$, 'el dueño desactiva a un empleado');
reset role;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.negocios), 0, 'un empleado desactivado no ve ningún dato');

select * from finish();
rollback;
```

Run: `npx supabase test db`
Expected: FAIL (las tablas y funciones no existen).

- [ ] **Step 3: Escribir la migración**

Crear `supabase/migrations/20261007120000_base.sql`:

```sql
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
  unique (negocio_id, nombre)
);
create unique index roles_un_dueno_por_negocio on public.roles (negocio_id) where es_dueno;

create table public.miembros (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  rol_id uuid not null references public.roles (id),
  nombre text not null check (char_length(nombre) between 2 and 80),
  usuario text not null check (usuario ~ '^[a-z0-9._-]{3,30}$'),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (negocio_id, usuario)
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
```

- [ ] **Step 4: Aplicar la migración y correr los tests**

```bash
npx supabase db reset
npm run test:db
```
Expected: `All tests successful. Files=1, Tests=28`. Si un test falla, corregir la migración (no el test) salvo que el test tenga un error de tipeo evidente.

- [ ] **Step 5: Generar tipos y variables de entorno locales**

Crear `scripts/env-local.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
eval "$(npx supabase status -o env)"
cat > .env.local <<EOF
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
EOF
```

Crear `.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

```bash
mkdir -p src/lib/supabase
chmod +x scripts/env-local.sh && ./scripts/env-local.sh
grep -c '=.\+' .env.local
npx supabase gen types typescript --local > src/lib/supabase/database.types.ts
```
Expected: `grep -c` imprime `3`; `database.types.ts` contiene `crear_negocio` y `slug_disponible`.

- [ ] **Step 6: Commit**

```bash
git add supabase scripts src/lib/supabase/database.types.ts
git add -f .env.example   # .gitignore ignora .env*; este archivo sí se versiona
git commit -m "feat(db): esquema base, RLS y alta atómica de negocio

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Dominio: permisos y plantillas

**Files:**
- Create: `src/lib/dominio/permisos.ts`, `src/lib/dominio/permisos.test.ts`, `src/lib/dominio/plantillas.ts`, `src/lib/dominio/plantillas.test.ts`

**Interfaces:**
- Produces (`permisos.ts`): `PERMISOS` (lista `{clave, etiqueta}`), `type ClavePermiso`, `type Permisos = Partial<Record<ClavePermiso, boolean>>`, `interface RolBase {nombre; es_dueno; permisos}`, `interface RolConPermisos {es_dueno: boolean; permisos: unknown}`, `ROLES_POR_DEFECTO: RolBase[]`, `normalizarPermisos(entrada: unknown): Permisos`, `puede(rol: RolConPermisos, clave: ClavePermiso): boolean`.
- Produces (`plantillas.ts`): `TIPOS_NEGOCIO` (`['cancha','peluqueria','estetica']`), `type TipoNegocio`, `type ModoTurnos = 'fijo' | 'editable'`, `interface Plantilla`, `PLANTILLAS: Record<TipoNegocio, Plantilla>`, `plantillaDe(tipo): Plantilla`, `esTipoNegocio(valor: unknown): valor is TipoNegocio`.

- [ ] **Step 1: Escribir los tests de permisos**

`src/lib/dominio/permisos.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { normalizarPermisos, puede, ROLES_POR_DEFECTO } from './permisos';

describe('puede', () => {
  test('el dueño puede todo aunque no tenga permisos listados', () => {
    expect(puede({ es_dueno: true, permisos: {} }, 'ver_ingresos')).toBe(true);
  });

  test('un rol no-dueño solo puede lo que tiene en true', () => {
    const rol = { es_dueno: false, permisos: { gestionar_turnos: true } };
    expect(puede(rol, 'gestionar_turnos')).toBe(true);
    expect(puede(rol, 'ver_ingresos')).toBe(false);
  });

  test('permisos corruptos se tratan como sin permisos', () => {
    expect(puede({ es_dueno: false, permisos: null }, 'gestionar_turnos')).toBe(false);
    expect(puede({ es_dueno: false, permisos: 'si' }, 'gestionar_turnos')).toBe(false);
  });
});

describe('normalizarPermisos', () => {
  test('descarta claves desconocidas y valores que no son true', () => {
    expect(
      normalizarPermisos({ gestionar_turnos: true, ver_ingresos: false, inventado: true, editar_negocio: 'true' }),
    ).toEqual({ gestionar_turnos: true });
  });

  test('entradas que no son objeto dan vacío', () => {
    expect(normalizarPermisos(null)).toEqual({});
    expect(normalizarPermisos([true])).toEqual({});
    expect(normalizarPermisos('x')).toEqual({});
  });
});

describe('ROLES_POR_DEFECTO', () => {
  test('hay exactamente un rol dueño y tres roles', () => {
    expect(ROLES_POR_DEFECTO).toHaveLength(3);
    expect(ROLES_POR_DEFECTO.filter((r) => r.es_dueno)).toHaveLength(1);
  });

  test('Recepción no ve ingresos y el Profesional no ve agendas ajenas', () => {
    const recepcion = ROLES_POR_DEFECTO.find((r) => r.nombre === 'Recepción')!;
    const profesional = ROLES_POR_DEFECTO.find((r) => r.nombre === 'Profesional')!;
    expect(puede(recepcion, 'ver_ingresos')).toBe(false);
    expect(puede(recepcion, 'gestionar_turnos')).toBe(true);
    expect(puede(profesional, 'ver_agendas_ajenas')).toBe(false);
    expect(puede(profesional, 'gestionar_turnos')).toBe(true);
  });
});
```

- [ ] **Step 2: Verlos fallar**

Run: `npx vitest run src/lib/dominio/permisos.test.ts`
Expected: FAIL (no existe `./permisos`).

- [ ] **Step 3: Implementar `permisos.ts`**

```ts
export const PERMISOS = [
  { clave: 'ver_ingresos', etiqueta: 'Ver ingresos y métricas' },
  { clave: 'gestionar_turnos', etiqueta: 'Gestionar turnos' },
  { clave: 'ver_agendas_ajenas', etiqueta: 'Ver las agendas de otros' },
  { clave: 'gestionar_clientes', etiqueta: 'Gestionar clientes' },
  { clave: 'gestionar_servicios', etiqueta: 'Gestionar servicios y horarios' },
  { clave: 'registrar_ventas', etiqueta: 'Registrar ventas' },
  { clave: 'editar_catalogo', etiqueta: 'Editar catálogo y stock' },
  { clave: 'editar_negocio', etiqueta: 'Editar datos y marca del negocio' },
] as const;

export type ClavePermiso = (typeof PERMISOS)[number]['clave'];
export type Permisos = Partial<Record<ClavePermiso, boolean>>;

export interface RolBase {
  nombre: string;
  es_dueno: boolean;
  permisos: Permisos;
}

export interface RolConPermisos {
  es_dueno: boolean;
  permisos: unknown;
}

const CLAVES = new Set<string>(PERMISOS.map((p) => p.clave));

export function normalizarPermisos(entrada: unknown): Permisos {
  if (typeof entrada !== 'object' || entrada === null || Array.isArray(entrada)) return {};
  const salida: Permisos = {};
  for (const [clave, valor] of Object.entries(entrada)) {
    if (CLAVES.has(clave) && valor === true) salida[clave as ClavePermiso] = true;
  }
  return salida;
}

export function puede(rol: RolConPermisos, clave: ClavePermiso): boolean {
  return rol.es_dueno || normalizarPermisos(rol.permisos)[clave] === true;
}

export const ROLES_POR_DEFECTO: RolBase[] = [
  { nombre: 'Dueño', es_dueno: true, permisos: {} },
  {
    nombre: 'Recepción',
    es_dueno: false,
    permisos: {
      gestionar_turnos: true,
      ver_agendas_ajenas: true,
      gestionar_clientes: true,
      registrar_ventas: true,
      editar_catalogo: true,
    },
  },
  { nombre: 'Profesional', es_dueno: false, permisos: { gestionar_turnos: true } },
];
```

- [ ] **Step 4: Verlos pasar**

Run: `npx vitest run src/lib/dominio/permisos.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Escribir los tests de plantillas**

`src/lib/dominio/plantillas.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { esTipoNegocio, plantillaDe, PLANTILLAS, TIPOS_NEGOCIO } from './plantillas';

describe('plantillas', () => {
  test('hay una plantilla completa por cada tipo de negocio', () => {
    for (const tipo of TIPOS_NEGOCIO) {
      const p = plantillaDe(tipo);
      expect(p.tipo).toBe(tipo);
      expect(p.etiqueta.length).toBeGreaterThan(0);
      expect(p.recurso.singular.length).toBeGreaterThan(0);
      expect(p.recurso.plural.length).toBeGreaterThan(0);
      expect(p.tips.length).toBeGreaterThanOrEqual(3);
    }
  });

  test('las canchas usan turnos fijos y llaman "cancha" a su recurso', () => {
    expect(PLANTILLAS.cancha.modoTurnosSugerido).toBe('fijo');
    expect(PLANTILLAS.cancha.recurso.singular).toBe('cancha');
  });

  test('peluquerías y estéticas sugieren turnos editables', () => {
    expect(PLANTILLAS.peluqueria.modoTurnosSugerido).toBe('editable');
    expect(PLANTILLAS.estetica.modoTurnosSugerido).toBe('editable');
  });

  test('esTipoNegocio acepta solo tipos válidos', () => {
    expect(esTipoNegocio('cancha')).toBe(true);
    expect(esTipoNegocio('gimnasio')).toBe(false);
    expect(esTipoNegocio(undefined)).toBe(false);
  });
});
```

- [ ] **Step 6: Verlos fallar, implementar y verlos pasar**

Run: `npx vitest run src/lib/dominio/plantillas.test.ts` → FAIL.

`src/lib/dominio/plantillas.ts`:

```ts
export const TIPOS_NEGOCIO = ['cancha', 'peluqueria', 'estetica'] as const;
export type TipoNegocio = (typeof TIPOS_NEGOCIO)[number];
export type ModoTurnos = 'fijo' | 'editable';

export interface Plantilla {
  tipo: TipoNegocio;
  etiqueta: string;
  recurso: { singular: string; plural: string };
  reserva: { singular: string; plural: string };
  modoTurnosSugerido: ModoTurnos;
  vendeProductosSugerido: boolean;
  tips: string[];
}

export const PLANTILLAS: Record<TipoNegocio, Plantilla> = {
  cancha: {
    tipo: 'cancha',
    etiqueta: 'Canchas de fútbol',
    recurso: { singular: 'cancha', plural: 'canchas' },
    reserva: { singular: 'reserva', plural: 'reservas' },
    modoTurnosSugerido: 'fijo',
    vendeProductosSugerido: false,
    tips: [
      'Cargá cada cancha como un recurso aparte para que tus clientes elijan en cuál jugar.',
      'Con turnos fijos armás una grilla (por ejemplo, de una hora) y evitás superposiciones.',
      'Si vendés bebidas o accesorios, activá el catálogo para controlar el stock.',
    ],
  },
  peluqueria: {
    tipo: 'peluqueria',
    etiqueta: 'Peluquería / Barbería',
    recurso: { singular: 'profesional', plural: 'profesionales' },
    reserva: { singular: 'turno', plural: 'turnos' },
    modoTurnosSugerido: 'editable',
    vendeProductosSugerido: true,
    tips: [
      'Sumá a cada barbero o peluquero como profesional, con su propia agenda.',
      'Cargá tus servicios con duración y precio: el sistema calcula los horarios libres.',
      'Creá usuarios para tu equipo desde Empleados y elegí qué puede ver cada uno.',
    ],
  },
  estetica: {
    tipo: 'estetica',
    etiqueta: 'Estética',
    recurso: { singular: 'profesional', plural: 'profesionales' },
    reserva: { singular: 'turno', plural: 'turnos' },
    modoTurnosSugerido: 'editable',
    vendeProductosSugerido: true,
    tips: [
      'Cargá cada tratamiento como un servicio con su duración, así los turnos no se pisan.',
      'Sumá a cada profesional o cabina como recurso para que el cliente elija.',
      'Si vendés cosmética, activá el catálogo y llevá el stock en un solo lugar.',
    ],
  },
};

export function plantillaDe(tipo: TipoNegocio): Plantilla {
  return PLANTILLAS[tipo];
}

export function esTipoNegocio(valor: unknown): valor is TipoNegocio {
  return typeof valor === 'string' && (TIPOS_NEGOCIO as readonly string[]).includes(valor);
}
```

Run: `npx vitest run src/lib/dominio/plantillas.test.ts` → PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/dominio
git commit -m "feat(dominio): permisos, roles por defecto y plantillas por rubro

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Dominio: slug, empleados y esquemas de validación

**Files:**
- Create: `src/lib/dominio/slug.ts`, `slug.test.ts`, `empleados.ts`, `empleados.test.ts`, `esquemas.ts`, `esquemas.test.ts`

**Interfaces:**
- Consumes: `TIPOS_NEGOCIO` de `plantillas.ts`.
- Produces (`slug.ts`): `slugify(texto: string): string`, `esSlugValido(slug: string): boolean`.
- Produces (`empleados.ts`): `USUARIO_REGEX: RegExp`, `normalizarUsuario(s: string): string`, `emailInterno(usuario: string, slug: string): string`.
- Produces (`esquemas.ts`): `registroSchema` (campos `email, password, nombreDueno, nombreNegocio, slug, tipo, vendeProductos: boolean, modoTurnos`), `empleadoSchema` (`nombre, usuario, password, rolId`), `passwordSchema`.

- [ ] **Step 1: Tests de slug y empleados**

`src/lib/dominio/slug.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { esSlugValido, slugify } from './slug';

describe('slugify', () => {
  test('pasa a minúsculas, saca tildes y reemplaza símbolos por guiones', () => {
    expect(slugify('Barbería Los Pibes!')).toBe('barberia-los-pibes');
    expect(slugify('Ñandú')).toBe('nandu');
  });

  test('colapsa guiones y recorta los extremos', () => {
    expect(slugify('  --a--b--  ')).toBe('a-b');
  });

  test('limita a 40 caracteres sin dejar un guion al final', () => {
    const s = slugify('a'.repeat(39) + ' bbbb');
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith('-')).toBe(false);
  });

  test('un texto sin letras ni números da vacío', () => {
    expect(slugify('!!!')).toBe('');
  });
});

describe('esSlugValido', () => {
  test('acepta slugs bien formados de 3 a 40 caracteres', () => {
    expect(esSlugValido('mi-cancha')).toBe(true);
    expect(esSlugValido('abc')).toBe(true);
  });

  test('rechaza mayúsculas, espacios, guiones dobles o en los extremos y largos fuera de rango', () => {
    for (const malo of ['Mi-Cancha', 'mi cancha', 'mi--cancha', '-mi', 'mi-', 'ab', 'a'.repeat(41), '']) {
      expect(esSlugValido(malo)).toBe(false);
    }
  });
});
```

`src/lib/dominio/empleados.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { emailInterno, normalizarUsuario, USUARIO_REGEX } from './empleados';

describe('normalizarUsuario', () => {
  test('recorta espacios y pasa a minúsculas', () => {
    expect(normalizarUsuario('  Juan.Perez ')).toBe('juan.perez');
  });
});

describe('USUARIO_REGEX', () => {
  test('acepta letras, números, punto, guion y guion bajo (3 a 30)', () => {
    expect(USUARIO_REGEX.test('juan_perez-2')).toBe(true);
  });

  test('rechaza espacios, @, tildes y largos fuera de rango', () => {
    for (const malo of ['ju', 'juan perez', 'juan@x', 'jóse', 'a'.repeat(31)]) {
      expect(USUARIO_REGEX.test(malo)).toBe(false);
    }
  });
});

describe('emailInterno', () => {
  test('es determinístico y separa usuario y negocio sin ambigüedad', () => {
    expect(emailInterno('juan', 'barberia-uno')).toBe('juan@barberia-uno.staff.sistema-turnos.invalid');
    expect(emailInterno('juan', 'a-b')).not.toBe(emailInterno('juan.a', 'b'));
  });

  test('el mismo usuario en dos negocios da emails distintos', () => {
    expect(emailInterno('juan', 'negocio-a')).not.toBe(emailInterno('juan', 'negocio-b'));
  });
});
```

Run: `npx vitest run src/lib/dominio/slug.test.ts src/lib/dominio/empleados.test.ts` → FAIL.

- [ ] **Step 2: Implementar `slug.ts` y `empleados.ts`**

`src/lib/dominio/slug.ts`:

```ts
const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function esSlugValido(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 40 && SLUG_REGEX.test(slug);
}

export function slugify(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}
```

`src/lib/dominio/empleados.ts`:

```ts
export const USUARIO_REGEX = /^[a-z0-9._-]{3,30}$/;

export function normalizarUsuario(valor: string): string {
  return valor.trim().toLowerCase();
}

// Los empleados no tienen email real: Supabase Auth necesita uno, así que se
// deriva del usuario y del slug del negocio. El dominio .invalid nunca resuelve.
export function emailInterno(usuario: string, slug: string): string {
  return `${usuario}@${slug}.staff.sistema-turnos.invalid`;
}
```

Run los dos archivos de test → PASS.

- [ ] **Step 3: Tests de esquemas**

`src/lib/dominio/esquemas.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { empleadoSchema, registroSchema } from './esquemas';

const registroValido = {
  email: 'ana@example.com',
  password: 'clave-segura-1',
  nombreDueno: 'Ana',
  nombreNegocio: 'Barbería Uno',
  slug: 'barberia-uno',
  tipo: 'peluqueria',
  vendeProductos: true,
  modoTurnos: 'editable',
};

describe('registroSchema', () => {
  test('acepta un registro válido', () => {
    expect(registroSchema.safeParse(registroValido).success).toBe(true);
  });

  test.each([
    ['email', { email: 'no-es-email' }],
    ['password corta', { password: '1234567' }],
    ['password de más de 72 caracteres', { password: 'a'.repeat(73) }],
    ['slug con espacios', { slug: 'mal slug' }],
    ['slug con mayúsculas', { slug: 'Mal-Slug' }],
    ['tipo inexistente', { tipo: 'gimnasio' }],
    ['modo inexistente', { modoTurnos: 'libre' }],
    ['nombre de negocio vacío', { nombreNegocio: ' ' }],
  ])('rechaza %s', (_, cambio) => {
    expect(registroSchema.safeParse({ ...registroValido, ...cambio }).success).toBe(false);
  });
});

describe('empleadoSchema', () => {
  const valido = {
    nombre: 'Juan Pérez',
    usuario: '  Juan.Perez ',
    password: 'clave-segura-1',
    rolId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  };

  test('normaliza el usuario (espacios y mayúsculas)', () => {
    const r = empleadoSchema.safeParse(valido);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.usuario).toBe('juan.perez');
  });

  test.each([
    ['usuario corto', { usuario: 'ab' }],
    ['usuario con espacios internos', { usuario: 'juan perez' }],
    ['password corta', { password: 'corta' }],
    ['rol que no es uuid', { rolId: 'no-uuid' }],
  ])('rechaza %s', (_, cambio) => {
    expect(empleadoSchema.safeParse({ ...valido, ...cambio }).success).toBe(false);
  });
});
```

Run: `npx vitest run src/lib/dominio/esquemas.test.ts` → FAIL.

- [ ] **Step 4: Implementar `esquemas.ts`**

```ts
import { z } from 'zod';
import { normalizarUsuario, USUARIO_REGEX } from './empleados';
import { TIPOS_NEGOCIO } from './plantillas';
import { esSlugValido } from './slug';

const texto = (min: number, max: number) => z.string().trim().min(min).max(max);

export const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(72, 'La contraseña no puede superar los 72 caracteres.');

export const registroSchema = z.object({
  email: z.email('Ingresá un email válido.').max(254),
  password: passwordSchema,
  nombreDueno: texto(2, 80),
  nombreNegocio: texto(2, 80),
  slug: z.string().refine(esSlugValido, 'El link solo admite minúsculas, números y guiones (3 a 40 caracteres).'),
  tipo: z.enum(TIPOS_NEGOCIO),
  vendeProductos: z.boolean(),
  modoTurnos: z.enum(['fijo', 'editable']),
});

export const empleadoSchema = z.object({
  nombre: texto(2, 80),
  usuario: z
    .string()
    .transform(normalizarUsuario)
    .refine((u) => USUARIO_REGEX.test(u), 'El usuario debe tener de 3 a 30 caracteres: letras, números, punto, guion o guion bajo.'),
  password: passwordSchema,
  rolId: z.uuid('Elegí un rol.'),
});
```

Run: `npm test` → PASS en todo lo hecho hasta acá.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dominio
git commit -m "feat(dominio): slug, usuarios de empleados y esquemas de validación

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Dominio: menú del panel y checklist inicial

**Files:**
- Create: `src/lib/dominio/menu.ts`, `menu.test.ts`, `checklist.ts`, `checklist.test.ts`

**Interfaces:**
- Consumes: `puede`, `ClavePermiso`, `RolConPermisos` de `permisos.ts`.
- Produces: `interface ItemMenu {href: string; etiqueta: string; permiso?: ClavePermiso; soloDueno?: boolean}`, `ITEMS_MENU: ItemMenu[]`, `itemsDeMenu(rol: RolConPermisos, items?: ItemMenu[]): ItemMenu[]`; `interface PasoInicial {id: string; texto: string; hecho: boolean; href?: string}`, `pasosIniciales(estado: {cantidadMiembros: number}): PasoInicial[]`.

- [ ] **Step 1: Tests**

`src/lib/dominio/menu.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { itemsDeMenu, type ItemMenu } from './menu';

describe('itemsDeMenu', () => {
  test('el dueño ve Inicio y Empleados', () => {
    const hrefs = itemsDeMenu({ es_dueno: true, permisos: {} }).map((i) => i.href);
    expect(hrefs).toEqual(['/panel', '/panel/empleados']);
  });

  test('un empleado no ve Empleados', () => {
    const hrefs = itemsDeMenu({ es_dueno: false, permisos: { gestionar_turnos: true } }).map((i) => i.href);
    expect(hrefs).toEqual(['/panel']);
  });

  test('un ítem con permiso solo aparece para quien lo tiene', () => {
    const items: ItemMenu[] = [
      { href: '/panel', etiqueta: 'Inicio' },
      { href: '/panel/metricas', etiqueta: 'Métricas', permiso: 'ver_ingresos' },
    ];
    expect(itemsDeMenu({ es_dueno: false, permisos: {} }, items)).toHaveLength(1);
    expect(itemsDeMenu({ es_dueno: false, permisos: { ver_ingresos: true } }, items)).toHaveLength(2);
  });
});
```

`src/lib/dominio/checklist.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { pasosIniciales } from './checklist';

describe('pasosIniciales', () => {
  test('el paso de la cuenta siempre está hecho', () => {
    expect(pasosIniciales({ cantidadMiembros: 1 }).find((p) => p.id === 'cuenta')?.hecho).toBe(true);
  });

  test('el paso del equipo se completa al haber más de un miembro', () => {
    expect(pasosIniciales({ cantidadMiembros: 1 }).find((p) => p.id === 'equipo')?.hecho).toBe(false);
    expect(pasosIniciales({ cantidadMiembros: 2 }).find((p) => p.id === 'equipo')?.hecho).toBe(true);
  });
});
```

Run: `npx vitest run src/lib/dominio/menu.test.ts src/lib/dominio/checklist.test.ts` → FAIL.

- [ ] **Step 2: Implementar**

`src/lib/dominio/menu.ts`:

```ts
import { puede, type ClavePermiso, type RolConPermisos } from './permisos';

export interface ItemMenu {
  href: string;
  etiqueta: string;
  permiso?: ClavePermiso;
  soloDueno?: boolean;
}

export const ITEMS_MENU: ItemMenu[] = [
  { href: '/panel', etiqueta: 'Inicio' },
  { href: '/panel/empleados', etiqueta: 'Empleados', soloDueno: true },
];

export function itemsDeMenu(rol: RolConPermisos, items: ItemMenu[] = ITEMS_MENU): ItemMenu[] {
  return items.filter(
    (i) => (!i.soloDueno || rol.es_dueno) && (!i.permiso || puede(rol, i.permiso)),
  );
}
```

`src/lib/dominio/checklist.ts`:

```ts
export interface PasoInicial {
  id: string;
  texto: string;
  hecho: boolean;
  href?: string;
}

export function pasosIniciales(estado: { cantidadMiembros: number }): PasoInicial[] {
  return [
    { id: 'cuenta', texto: 'Creaste tu cuenta y tu negocio', hecho: true },
    {
      id: 'equipo',
      texto: 'Sumá a tu equipo (opcional)',
      hecho: estado.cantidadMiembros > 1,
      href: '/panel/empleados',
    },
  ];
}
```

Run: `npm test` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/dominio
git commit -m "feat(dominio): menú del panel según permisos y checklist inicial

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Infraestructura Supabase en Next: clientes, proxy, contexto y `/salir`

**Files:**
- Create: `src/lib/supabase/server.ts`, `src/lib/supabase/admin.ts`, `src/lib/panel/contexto.ts`, `src/proxy.ts`, `src/app/salir/route.ts`

**Interfaces:**
- Consumes: `Database` de `database.types.ts`; `Permisos`, `normalizarPermisos` (permisos.ts); `TipoNegocio`, `ModoTurnos` (plantillas.ts).
- Produces: `crearClienteServidor(): Promise<SupabaseClient<Database>>` (sesión del usuario, RLS activo); `crearClienteAdmin(): SupabaseClient<Database>` (service role, solo servidor); `obtenerContexto(): Promise<Contexto>` con `Contexto = { userId; miembro: {id, nombre, usuario}; negocio: {id, slug, nombre, tipo: TipoNegocio, vende_productos: boolean, modo_turnos: ModoTurnos}; rol: {id, nombre, es_dueno, permisos: Permisos} }` (redirige a `/login` sin sesión y a `/salir` si no hay miembro activo).

- [ ] **Step 1: Cliente de servidor**

`src/lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './database.types';

export async function crearClienteServidor() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Desde un Server Component no se pueden escribir cookies; el proxy refresca la sesión.
          }
        },
      },
    },
  );
}
```

`src/lib/supabase/admin.ts`:

```ts
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export function crearClienteAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
```

- [ ] **Step 2: Contexto de la sesión**

`src/lib/panel/contexto.ts`:

```ts
import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { crearClienteServidor } from '@/lib/supabase/server';
import { normalizarPermisos, type Permisos } from '@/lib/dominio/permisos';
import type { ModoTurnos, TipoNegocio } from '@/lib/dominio/plantillas';

export interface Contexto {
  userId: string;
  miembro: { id: string; nombre: string; usuario: string };
  negocio: {
    id: string;
    slug: string;
    nombre: string;
    tipo: TipoNegocio;
    vende_productos: boolean;
    modo_turnos: ModoTurnos;
  };
  rol: { id: string; nombre: string; es_dueno: boolean; permisos: Permisos };
}

interface FilaContexto {
  id: string;
  nombre: string;
  usuario: string;
  activo: boolean;
  negocio: Contexto['negocio'];
  rol: { id: string; nombre: string; es_dueno: boolean; permisos: unknown };
}

export const obtenerContexto = cache(async (): Promise<Contexto> => {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // RLS devuelve vacío si el miembro está desactivado o no existe.
  const { data } = await supabase
    .from('miembros')
    .select(
      'id, nombre, usuario, activo, negocio:negocios(id, slug, nombre, tipo, vende_productos, modo_turnos), rol:roles(id, nombre, es_dueno, permisos)',
    )
    .eq('auth_user_id', user.id)
    .maybeSingle();

  const fila = data as unknown as FilaContexto | null;
  if (!fila || !fila.activo || !fila.negocio || !fila.rol) redirect('/salir');

  return {
    userId: user.id,
    miembro: { id: fila.id, nombre: fila.nombre, usuario: fila.usuario },
    negocio: fila.negocio,
    rol: { ...fila.rol, permisos: normalizarPermisos(fila.rol.permisos) },
  };
});
```

- [ ] **Step 3: Proxy (refresca sesión y protege `/panel`)**

`src/proxy.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function redirigir(request: NextRequest, destino: string, desde: NextResponse) {
  const respuesta = NextResponse.redirect(new URL(destino, request.url));
  desde.cookies.getAll().forEach((c) => respuesta.cookies.set(c));
  return respuesta;
}

export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          respuesta = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  if (!user && pathname.startsWith('/panel')) return redirigir(request, '/login', respuesta);
  if (user && (pathname === '/login' || pathname === '/registro')) return redirigir(request, '/panel', respuesta);
  return respuesta;
}

export const config = { matcher: ['/panel/:path*', '/login', '/registro'] };
```

- [ ] **Step 4: Ruta `/salir`**

`src/app/salir/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { crearClienteServidor } from '@/lib/supabase/server';

// Se usa cuando hay sesión pero ya no hay acceso (miembro desactivado). Un Route Handler
// sí puede borrar las cookies; hacerlo desde un Server Component no.
export async function GET(request: NextRequest) {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/login?aviso=sin-acceso', request.url));
}
```

`/salir` no está en el matcher del proxy, por lo que el usuario con sesión puede llegar hasta ahí sin ser redirigido a `/panel`, evitando un bucle.

- [ ] **Step 5: Verificar y commitear**

```bash
npm run typecheck && npm run lint
git add src
git commit -m "feat: clientes de Supabase, proxy de sesión, contexto del panel y ruta /salir

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
Expected: sin errores. Si TypeScript se queja del tipo del `select` con relaciones, no tocar `FilaContexto`: el cast `as unknown as` existe justamente para eso.

---

### Task 7: Registro del negocio (onboarding)

**Files:**
- Create: `src/app/(auth)/registro/page.tsx`, `src/app/(auth)/registro/RegistroForm.tsx`, `src/app/(auth)/registro/actions.ts`
- Modify: `src/app/layout.tsx` (título y `lang="es"`), `src/app/page.tsx` (landing mínima), `src/app/globals.css` (dejar solo las líneas `@import "tailwindcss";` y el color de fondo por defecto)

**Interfaces:**
- Consumes: `registroSchema`, `ROLES_POR_DEFECTO`, `PLANTILLAS`, `TIPOS_NEGOCIO`, `slugify`, `esSlugValido`, `crearClienteServidor`, `crearClienteAdmin`, `Json` de `database.types.ts`.
- Produces: server actions `verificarSlug(slug: string): Promise<boolean>` y `registrar(prev: EstadoRegistro, formData: FormData): Promise<EstadoRegistro>` con `EstadoRegistro = { error?: string }`. Textos de UI que usa el e2e: "Tu nombre", "Email", "Contraseña", "Siguiente", "Nombre del negocio", etiquetas de plantilla, "Link de tu página", "Disponible"/"No disponible", "Sí, vendo productos", "Turnos editables (según el servicio)", "Crear mi negocio".

- [ ] **Step 1: Layout raíz y landing**

En `src/app/layout.tsx`, dejar `<html lang="es">` y `export const metadata = { title: 'Sistema de Turnos', description: 'Gestioná turnos, clientes y productos de tu negocio en un solo lugar.' };`.

`src/app/page.tsx`:

```tsx
import Link from 'next/link';

export default function Landing() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
      <h1 className="text-3xl font-semibold">Sistema de Turnos</h1>
      <p className="text-stone-600">Turnos, clientes y productos de tu negocio en un solo lugar.</p>
      <div className="flex gap-3">
        <Link href="/registro" className="rounded-lg bg-stone-900 px-4 py-2 text-white">Crear mi negocio</Link>
        <Link href="/login" className="rounded-lg border border-stone-300 px-4 py-2">Entrar</Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Server actions**

`src/app/(auth)/registro/actions.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { ROLES_POR_DEFECTO } from '@/lib/dominio/permisos';
import { registroSchema } from '@/lib/dominio/esquemas';
import { esSlugValido } from '@/lib/dominio/slug';
import type { Json } from '@/lib/supabase/database.types';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { crearClienteServidor } from '@/lib/supabase/server';

export interface EstadoRegistro {
  error?: string;
}

export async function verificarSlug(slug: string): Promise<boolean> {
  const normal = slug.trim().toLowerCase();
  if (!esSlugValido(normal)) return false;
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc('slug_disponible', { p_slug: normal });
  return data === true;
}

export async function registrar(_: EstadoRegistro, formData: FormData): Promise<EstadoRegistro> {
  const parsed = registroSchema.safeParse({
    email: String(formData.get('email') ?? '').trim().toLowerCase(),
    password: formData.get('password'),
    nombreDueno: formData.get('nombreDueno'),
    nombreNegocio: formData.get('nombreNegocio'),
    slug: String(formData.get('slug') ?? '').trim().toLowerCase(),
    tipo: formData.get('tipo'),
    vendeProductos: formData.get('vendeProductos') === 'si',
    modoTurnos: formData.get('modoTurnos'),
  });
  if (!parsed.success) {
    return { error: z.prettifyError(parsed.error) };
  }
  const d = parsed.data;

  const admin = crearClienteAdmin();
  const { data: creado, error: errCrear } = await admin.auth.admin.createUser({
    email: d.email,
    password: d.password,
    email_confirm: true,
  });
  if (errCrear || !creado.user) {
    return {
      error:
        errCrear?.code === 'email_exists'
          ? 'Ya existe una cuenta con ese email.'
          : 'No pudimos crear tu cuenta. Probá de nuevo.',
    };
  }
  const userId = creado.user.id;

  const supabase = await crearClienteServidor();
  const { error: errLogin } = await supabase.auth.signInWithPassword({ email: d.email, password: d.password });
  if (errLogin) {
    await admin.auth.admin.deleteUser(userId);
    return { error: 'No pudimos iniciar tu sesión. Probá de nuevo.' };
  }

  const { error: errNegocio } = await supabase.rpc('crear_negocio', {
    p_nombre: d.nombreNegocio,
    p_slug: d.slug,
    p_tipo: d.tipo,
    p_vende_productos: d.vendeProductos,
    p_modo_turnos: d.modoTurnos,
    p_nombre_dueno: d.nombreDueno,
    p_roles: ROLES_POR_DEFECTO as unknown as Json,
  });
  if (errNegocio) {
    await supabase.auth.signOut();
    await admin.auth.admin.deleteUser(userId);
    const enUso = errNegocio.code === '23505' || errNegocio.message.includes('slug_reservado');
    return {
      error: enUso
        ? 'Ese link ya está en uso. Elegí otro.'
        : 'No pudimos crear tu negocio. Probá de nuevo.',
    };
  }

  redirect('/panel');
}
```

- [ ] **Step 3: Formulario de 3 pasos**

`src/app/(auth)/registro/RegistroForm.tsx`:

```tsx
'use client';

import { useActionState, useRef, useState } from 'react';
import { PLANTILLAS, TIPOS_NEGOCIO, type ModoTurnos, type TipoNegocio } from '@/lib/dominio/plantillas';
import { esSlugValido, slugify } from '@/lib/dominio/slug';
import { registrar, verificarSlug, type EstadoRegistro } from './actions';

const inicial: EstadoRegistro = {};
const input = 'w-full rounded-lg border border-stone-300 px-3 py-2';
const boton = 'rounded-lg bg-stone-900 px-4 py-2 text-white disabled:opacity-50';

export default function RegistroForm() {
  const [estado, accion, pendiente] = useActionState(registrar, inicial);
  const [paso, setPaso] = useState(1);
  const [tipo, setTipo] = useState<TipoNegocio>('peluqueria');
  const [nombreNegocio, setNombreNegocio] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTocado, setSlugTocado] = useState(false);
  const [slugOk, setSlugOk] = useState<boolean | null>(null);
  const [vende, setVende] = useState(PLANTILLAS.peluqueria.vendeProductosSugerido);
  const [modo, setModo] = useState<ModoTurnos>(PLANTILLAS.peluqueria.modoTurnosSugerido);
  const formRef = useRef<HTMLFormElement>(null);

  const consulta = useRef(0);

  // Solo vale la última consulta: una respuesta vieja no puede pisar a una más nueva.
  async function comprobarSlug(valor: string) {
    const n = ++consulta.current;
    setSlugOk(null);
    const ok = await verificarSlug(valor);
    if (n === consulta.current) setSlugOk(ok);
  }

  function elegirTipo(nuevo: TipoNegocio) {
    setTipo(nuevo);
    setVende(PLANTILLAS[nuevo].vendeProductosSugerido);
    setModo(PLANTILLAS[nuevo].modoTurnosSugerido);
  }

  function cambiarNombreNegocio(valor: string) {
    setNombreNegocio(valor);
    if (!slugTocado) {
      const sugerido = slugify(valor);
      setSlug(sugerido);
      if (esSlugValido(sugerido)) void comprobarSlug(sugerido);
      else {
        consulta.current++;
        setSlugOk(null);
      }
    }
  }

  function siguiente(desde: number) {
    const fieldset = formRef.current?.querySelector<HTMLElement>(`[data-paso="${desde}"]`);
    const campos = fieldset?.querySelectorAll<HTMLInputElement>('input');
    if (campos && ![...campos].every((c) => c.reportValidity())) return;
    setPaso(desde + 1);
  }

  return (
    <form ref={formRef} action={accion} className="space-y-6">
      <p className="text-sm text-stone-500">Paso {paso} de 3</p>

      <fieldset data-paso="1" hidden={paso !== 1} className="space-y-4">
        <legend className="mb-2 text-lg font-semibold">Tu cuenta</legend>
        <label className="block">Tu nombre
          <input name="nombreDueno" required minLength={2} maxLength={80} className={input} />
        </label>
        <label className="block">Email
          <input name="email" type="email" required className={input} />
        </label>
        <label className="block">Contraseña
          <input name="password" type="password" required minLength={8} maxLength={72} className={input} />
        </label>
        <button type="button" onClick={() => siguiente(1)} className={boton}>Siguiente</button>
      </fieldset>

      <fieldset data-paso="2" hidden={paso !== 2} className="space-y-4">
        <legend className="mb-2 text-lg font-semibold">Tu negocio</legend>
        <label className="block">Nombre del negocio
          <input
            name="nombreNegocio" required minLength={2} maxLength={80} className={input}
            value={nombreNegocio} onChange={(e) => cambiarNombreNegocio(e.target.value)}
          />
        </label>
        <div role="radiogroup" className="space-y-2">
          {TIPOS_NEGOCIO.map((t) => (
            <label key={t} className="flex items-center gap-2 rounded-lg border border-stone-300 px-3 py-2">
              <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => elegirTipo(t)} />
              {PLANTILLAS[t].etiqueta}
            </label>
          ))}
        </div>
        <label className="block">Link de tu página
          <input
            name="slug" required className={input} value={slug}
            onChange={(e) => {
              const v = e.target.value.toLowerCase();
              setSlug(v);
              setSlugTocado(true);
              if (esSlugValido(v)) void comprobarSlug(v);
              else {
                consulta.current++;
                setSlugOk(false);
              }
            }}
          />
        </label>
        <p className="text-sm text-stone-500">
          Tus clientes van a entrar por /b/{slug || 'tu-negocio'}.{' '}
          {slugOk === true && <span className="text-green-700">Disponible</span>}
          {slugOk === false && <span className="text-red-700">No disponible</span>}
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={() => setPaso(1)} className="rounded-lg border border-stone-300 px-4 py-2">Atrás</button>
          <button type="button" disabled={slugOk !== true} onClick={() => siguiente(2)} className={boton}>Siguiente</button>
        </div>
      </fieldset>

      <fieldset data-paso="3" hidden={paso !== 3} className="space-y-4">
        <legend className="mb-2 text-lg font-semibold">Cómo trabajás</legend>
        <p>¿Vendés productos?</p>
        <label className="flex items-center gap-2">
          <input type="radio" name="vendeProductos" value="si" checked={vende} onChange={() => setVende(true)} />
          Sí, vendo productos
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="vendeProductos" value="no" checked={!vende} onChange={() => setVende(false)} />
          No, por ahora no
        </label>
        <p>¿Cómo son tus turnos?</p>
        <label className="flex items-center gap-2">
          <input type="radio" name="modoTurnos" value="fijo" checked={modo === 'fijo'} onChange={() => setModo('fijo')} />
          Turnos fijos (grilla de horarios)
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="modoTurnos" value="editable" checked={modo === 'editable'} onChange={() => setModo('editable')} />
          Turnos editables (según el servicio)
        </label>
        {estado.error && <p role="alert" className="text-red-700">{estado.error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={() => setPaso(2)} className="rounded-lg border border-stone-300 px-4 py-2">Atrás</button>
          <button type="submit" disabled={pendiente} className={boton}>Crear mi negocio</button>
        </div>
      </fieldset>
    </form>
  );
}
```

`src/app/(auth)/registro/page.tsx`:

```tsx
import Link from 'next/link';
import RegistroForm from './RegistroForm';

export default function RegistroPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Creá tu negocio</h1>
      <RegistroForm />
      <p className="mt-6 text-sm text-stone-600">
        ¿Ya tenés cuenta? <Link href="/login" className="underline">Entrá</Link>
      </p>
    </main>
  );
}
```

- [ ] **Step 4: Verificar y commitear**

```bash
npm run typecheck && npm run lint
git add src
git commit -m "feat: registro de negocio en 3 pasos con tipo y preguntas de configuración

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
El comportamiento completo se verifica en el e2e (Task 11).

---

### Task 8: Login (dueño y empleados) y cierre de sesión

**Files:**
- Create: `src/app/(auth)/login/page.tsx`, `src/app/(auth)/login/LoginForm.tsx`, `src/app/(auth)/login/actions.ts`, `src/app/panel/actions.ts`

**Interfaces:**
- Consumes: `normalizarUsuario`, `USUARIO_REGEX`, `emailInterno`, `esSlugValido`, `crearClienteServidor`.
- Produces: `iniciarSesion(prev: EstadoLogin, formData: FormData): Promise<EstadoLogin>` con `EstadoLogin = { error?: string }`; `cerrarSesion(): Promise<void>`. Textos de UI que usa el e2e: "Soy dueño", "Soy empleado", "Email", "Contraseña", "Usuario", "Código del negocio", "Entrar", botón "Salir".

- [ ] **Step 1: Acciones**

`src/app/(auth)/login/actions.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';
import { emailInterno, normalizarUsuario, USUARIO_REGEX } from '@/lib/dominio/empleados';
import { esSlugValido } from '@/lib/dominio/slug';
import { crearClienteServidor } from '@/lib/supabase/server';

export interface EstadoLogin {
  error?: string;
}

const ERROR = 'Los datos no son correctos.';

export async function iniciarSesion(_: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const password = String(formData.get('password') ?? '');
  let email: string;

  if (formData.get('modo') === 'empleado') {
    const usuario = normalizarUsuario(String(formData.get('usuario') ?? ''));
    const slug = String(formData.get('codigo') ?? '').trim().toLowerCase();
    if (!USUARIO_REGEX.test(usuario) || !esSlugValido(slug)) return { error: ERROR };
    email = emailInterno(usuario, slug);
  } else {
    email = String(formData.get('email') ?? '').trim().toLowerCase();
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: ERROR };
  redirect('/panel');
}
```

`src/app/panel/actions.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';
import { crearClienteServidor } from '@/lib/supabase/server';

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect('/login');
}
```

- [ ] **Step 2: Formulario y página**

`src/app/(auth)/login/LoginForm.tsx`:

```tsx
'use client';

import { useActionState, useState } from 'react';
import { iniciarSesion, type EstadoLogin } from './actions';

const inicial: EstadoLogin = {};
const input = 'w-full rounded-lg border border-stone-300 px-3 py-2';

export default function LoginForm({ aviso }: { aviso?: string }) {
  const [estado, accion, pendiente] = useActionState(iniciarSesion, inicial);
  const [modo, setModo] = useState<'dueno' | 'empleado'>('dueno');

  return (
    <form action={accion} className="space-y-4">
      <div className="flex gap-4">
        <label className="flex items-center gap-2">
          <input type="radio" name="modo" value="dueno" checked={modo === 'dueno'} onChange={() => setModo('dueno')} />
          Soy dueño
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="modo" value="empleado" checked={modo === 'empleado'} onChange={() => setModo('empleado')} />
          Soy empleado
        </label>
      </div>

      {modo === 'dueno' ? (
        <label className="block">Email
          <input name="email" type="email" required className={input} />
        </label>
      ) : (
        <>
          <label className="block">Usuario
            <input name="usuario" required className={input} autoCapitalize="none" />
          </label>
          <label className="block">Código del negocio
            <input name="codigo" required className={input} autoCapitalize="none" />
          </label>
        </>
      )}
      <label className="block">Contraseña
        <input name="password" type="password" required className={input} />
      </label>

      {aviso && <p role="status" className="text-amber-700">{aviso}</p>}
      {estado.error && <p role="alert" className="text-red-700">{estado.error}</p>}
      <button type="submit" disabled={pendiente} className="rounded-lg bg-stone-900 px-4 py-2 text-white disabled:opacity-50">
        Entrar
      </button>
    </form>
  );
}
```

`src/app/(auth)/login/page.tsx`:

```tsx
import Link from 'next/link';
import LoginForm from './LoginForm';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const { aviso } = await searchParams;
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Entrar</h1>
      <LoginForm aviso={aviso === 'sin-acceso' ? 'Tu acceso fue desactivado o ya no existe.' : undefined} />
      <p className="mt-6 text-sm text-stone-600">
        ¿Todavía no tenés tu negocio? <Link href="/registro" className="underline">Creá uno</Link>
      </p>
    </main>
  );
}
```

- [ ] **Step 3: Verificar y commitear**

```bash
npm run typecheck && npm run lint
git add src
git commit -m "feat: login de dueño (email) y empleados (usuario + código del negocio)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Panel: layout con menú por permisos e Inicio

**Files:**
- Create: `src/app/panel/layout.tsx`, `src/app/panel/page.tsx`

**Interfaces:**
- Consumes: `obtenerContexto`, `itemsDeMenu`, `plantillaDe`, `pasosIniciales`, `cerrarSesion`, `crearClienteServidor`.

- [ ] **Step 1: Layout**

`src/app/panel/layout.tsx`:

```tsx
import Link from 'next/link';
import { itemsDeMenu } from '@/lib/dominio/menu';
import { obtenerContexto } from '@/lib/panel/contexto';
import { cerrarSesion } from './actions';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const ctx = await obtenerContexto();
  const items = itemsDeMenu(ctx.rol);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-sm text-stone-500">{ctx.rol.nombre}</p>
            <h1 className="text-lg font-semibold">{ctx.negocio.nombre}</h1>
          </div>
          <form action={cerrarSesion}>
            <button className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm">Salir</button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2">
          {items.map((i) => (
            <Link key={i.href} href={i.href} className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm hover:bg-stone-100">
              {i.etiqueta}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Inicio con bienvenida, tips y checklist**

`src/app/panel/page.tsx`:

```tsx
import Link from 'next/link';
import { pasosIniciales } from '@/lib/dominio/checklist';
import { plantillaDe } from '@/lib/dominio/plantillas';
import { obtenerContexto } from '@/lib/panel/contexto';
import { crearClienteServidor } from '@/lib/supabase/server';

export default async function InicioPage() {
  const ctx = await obtenerContexto();
  const plantilla = plantillaDe(ctx.negocio.tipo);

  let pasos: ReturnType<typeof pasosIniciales> = [];
  if (ctx.rol.es_dueno) {
    const supabase = await crearClienteServidor();
    const { count } = await supabase.from('miembros').select('id', { count: 'exact', head: true });
    pasos = pasosIniciales({ cantidadMiembros: count ?? 1 });
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-semibold">Hola, {ctx.miembro.nombre}</h2>
        <p className="text-stone-600">
          Acá vas a manejar tus {plantilla.reserva.plural} y tus {plantilla.recurso.plural}.
        </p>
      </section>

      {pasos.length > 0 && (
        <section aria-label="Primeros pasos" className="rounded-xl border border-stone-200 bg-white p-4">
          <h3 className="mb-3 font-semibold">Primeros pasos</h3>
          <ul className="space-y-2">
            {pasos.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <span aria-hidden>{p.hecho ? '✅' : '⬜'}</span>
                {p.href && !p.hecho ? <Link href={p.href} className="underline">{p.texto}</Link> : <span>{p.texto}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Consejos" className="rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="mb-3 font-semibold">Consejos para {plantilla.etiqueta.toLowerCase()}</h3>
        <ul className="list-disc space-y-2 pl-5 text-stone-700">
          {plantilla.tips.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Verificar y commitear**

```bash
npm run typecheck && npm run lint && npm run build
git add src
git commit -m "feat(panel): layout con menú por permisos e Inicio con tips y checklist

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Empleados: alta, rol, desactivación, contraseña y permisos por rol

**Files:**
- Create: `src/app/panel/empleados/actions.ts`, `src/app/panel/empleados/page.tsx`

**Interfaces:**
- Consumes: `obtenerContexto`, `crearClienteServidor` (RLS), `crearClienteAdmin`, `empleadoSchema`, `passwordSchema`, `emailInterno`, `normalizarPermisos`, `PERMISOS`.
- Produces: server actions de formulario `crearEmpleado`, `cambiarRol`, `alternarActivo`, `resetearPassword`, `guardarPermisos` (todas `(formData: FormData) => Promise<void>`; terminan en redirect a `/panel/empleados?ok=...` o `?error=...`). Textos de UI que usa el e2e: heading "Empleados", etiquetas "Nombre", "Usuario", "Contraseña", "Rol", botón "Crear empleado", mensaje "Empleado creado.", botón "Desactivar"/"Activar".

Reglas de seguridad: toda acción verifica que el que llama es dueño. Las lecturas y los `update` de `miembros`/`roles` van por el cliente con RLS (la base rechaza lo que no corresponde). El cliente admin solo se usa para lo que RLS no permite por diseño: crear usuarios de Auth, insertar el `miembro` nuevo, banear/desbanear y cambiar contraseñas.

- [ ] **Step 1: Acciones**

`src/app/panel/empleados/actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { emailInterno } from '@/lib/dominio/empleados';
import { empleadoSchema, passwordSchema } from '@/lib/dominio/esquemas';
import { normalizarPermisos, PERMISOS } from '@/lib/dominio/permisos';
import { obtenerContexto } from '@/lib/panel/contexto';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { crearClienteServidor } from '@/lib/supabase/server';

function volver(tipo: 'ok' | 'error', mensaje: string): never {
  revalidatePath('/panel/empleados');
  redirect(`/panel/empleados?${tipo}=${encodeURIComponent(mensaje)}`);
}

async function exigirDueno() {
  const ctx = await obtenerContexto();
  if (!ctx.rol.es_dueno) volver('error', 'Solo el dueño puede gestionar empleados.');
  return ctx;
}

function uuid(valor: FormDataEntryValue | null): string {
  const r = z.uuid().safeParse(valor);
  if (!r.success) volver('error', 'Solicitud inválida.');
  return r.data;
}

export async function crearEmpleado(formData: FormData) {
  const ctx = await exigirDueno();
  const parsed = empleadoSchema.safeParse({
    nombre: formData.get('nombre'),
    usuario: formData.get('usuario') ?? '',
    password: formData.get('password'),
    rolId: formData.get('rolId'),
  });
  if (!parsed.success) volver('error', parsed.error.issues[0].message);
  const { nombre, usuario, password, rolId } = parsed.data;

  const supabase = await crearClienteServidor();
  const { data: rol } = await supabase.from('roles').select('id, es_dueno').eq('id', rolId).maybeSingle();
  if (!rol || rol.es_dueno) volver('error', 'Rol inválido.');

  const admin = crearClienteAdmin();
  const { data: creado, error } = await admin.auth.admin.createUser({
    email: emailInterno(usuario, ctx.negocio.slug),
    password,
    email_confirm: true,
  });
  if (error || !creado.user) {
    volver('error', error?.code === 'email_exists' ? 'Ese usuario ya existe.' : 'No se pudo crear el usuario.');
  }

  const { error: errMiembro } = await admin.from('miembros').insert({
    negocio_id: ctx.negocio.id,
    auth_user_id: creado.user.id,
    rol_id: rolId,
    nombre,
    usuario,
  });
  if (errMiembro) {
    await admin.auth.admin.deleteUser(creado.user.id);
    volver('error', errMiembro.code === '23505' ? 'Ese usuario ya existe.' : 'No se pudo crear el empleado.');
  }
  volver('ok', 'Empleado creado.');
}

export async function cambiarRol(formData: FormData) {
  await exigirDueno();
  const miembroId = uuid(formData.get('miembroId'));
  const rolId = uuid(formData.get('rolId'));
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from('miembros').update({ rol_id: rolId }).eq('id', miembroId).select('id');
  if (error || !data?.length) volver('error', 'No se pudo cambiar el rol.');
  volver('ok', 'Rol actualizado.');
}

export async function alternarActivo(formData: FormData) {
  await exigirDueno();
  const miembroId = uuid(formData.get('miembroId'));
  const activar = formData.get('activar') === 'si';
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from('miembros')
    .update({ activo: activar })
    .eq('id', miembroId)
    .select('id, auth_user_id');
  if (error || !data?.length) volver('error', 'No se pudo actualizar al empleado.');

  // Además del bloqueo por RLS, se banea al usuario para que no pueda iniciar sesión.
  const admin = crearClienteAdmin();
  await admin.auth.admin.updateUserById(data[0].auth_user_id, { ban_duration: activar ? 'none' : '876000h' });
  volver('ok', activar ? 'Empleado activado.' : 'Empleado desactivado.');
}

export async function resetearPassword(formData: FormData) {
  await exigirDueno();
  const miembroId = uuid(formData.get('miembroId'));
  const password = passwordSchema.safeParse(formData.get('password'));
  if (!password.success) volver('error', password.error.issues[0].message);

  const supabase = await crearClienteServidor();
  const { data: miembro } = await supabase
    .from('miembros')
    .select('auth_user_id, rol_id')
    .eq('id', miembroId)
    .maybeSingle();
  if (!miembro) volver('error', 'Empleado no encontrado.');
  const { data: rol } = await supabase.from('roles').select('es_dueno').eq('id', miembro.rol_id).maybeSingle();
  if (!rol || rol.es_dueno) volver('error', 'No se puede cambiar esa contraseña desde acá.');

  const admin = crearClienteAdmin();
  const { error } = await admin.auth.admin.updateUserById(miembro.auth_user_id, { password: password.data });
  if (error) volver('error', 'No se pudo cambiar la contraseña.');
  volver('ok', 'Contraseña actualizada.');
}

export async function guardarPermisos(formData: FormData) {
  await exigirDueno();
  const rolId = uuid(formData.get('rolId'));
  const permisos = normalizarPermisos(
    Object.fromEntries(PERMISOS.map((p) => [p.clave, formData.get(p.clave) === 'on'])),
  );
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from('roles').update({ permisos }).eq('id', rolId).select('id');
  if (error || !data?.length) volver('error', 'No se pudieron guardar los permisos.');
  volver('ok', 'Permisos guardados.');
}
```

- [ ] **Step 2: Página**

`src/app/panel/empleados/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { normalizarPermisos, PERMISOS } from '@/lib/dominio/permisos';
import { obtenerContexto } from '@/lib/panel/contexto';
import { crearClienteServidor } from '@/lib/supabase/server';
import { alternarActivo, cambiarRol, crearEmpleado, guardarPermisos, resetearPassword } from './actions';

const input = 'w-full rounded-lg border border-stone-300 px-3 py-2';
const boton = 'rounded-lg bg-stone-900 px-3 py-1.5 text-sm text-white';
const botonSec = 'rounded-lg border border-stone-300 px-3 py-1.5 text-sm';

export default async function EmpleadosPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const ctx = await obtenerContexto();
  if (!ctx.rol.es_dueno) redirect('/panel');
  const { ok, error } = await searchParams;

  const supabase = await crearClienteServidor();
  const [{ data: miembros }, { data: roles }] = await Promise.all([
    supabase.from('miembros').select('id, nombre, usuario, activo, rol_id').order('created_at'),
    supabase.from('roles').select('id, nombre, es_dueno, permisos').order('nombre'),
  ]);
  const rolesEditables = (roles ?? []).filter((r) => !r.es_dueno);
  const nombreDeRol = new Map((roles ?? []).map((r) => [r.id, r]));

  return (
    <div className="space-y-10">
      <h2 className="text-2xl font-semibold">Empleados</h2>
      {ok && <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-green-800">{ok}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-800">{error}</p>}

      <section className="space-y-3">
        <h3 className="font-semibold">Nuevo empleado</h3>
        <form action={crearEmpleado} className="grid gap-3 sm:grid-cols-2">
          <label>Nombre<input name="nombre" required minLength={2} maxLength={80} className={input} /></label>
          <label>Usuario<input name="usuario" required autoCapitalize="none" className={input} /></label>
          <label>Contraseña<input name="password" type="password" required minLength={8} maxLength={72} className={input} /></label>
          <label>Rol
            <select name="rolId" required className={input}>
              {rolesEditables.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </label>
          <div className="sm:col-span-2">
            <button className={boton}>Crear empleado</button>
          </div>
        </form>
        <p className="text-sm text-stone-500">
          Tu equipo entra desde la pantalla de login con su usuario, su contraseña y el código del negocio:{' '}
          <strong>{ctx.negocio.slug}</strong>.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">Equipo</h3>
        <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
          {(miembros ?? []).map((m) => {
            const rol = nombreDeRol.get(m.rol_id);
            const esDueno = rol?.es_dueno ?? false;
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-40 flex-1">
                  <p className="font-medium">{m.nombre} {!m.activo && <span className="text-sm text-red-700">(desactivado)</span>}</p>
                  <p className="text-sm text-stone-500">{m.usuario}</p>
                </div>
                {esDueno ? (
                  <span className="text-sm text-stone-600">Dueño</span>
                ) : (
                  <>
                    <form action={cambiarRol} className="flex gap-2">
                      <input type="hidden" name="miembroId" value={m.id} />
                      <select name="rolId" defaultValue={m.rol_id} aria-label={`Rol de ${m.nombre}`} className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm">
                        {rolesEditables.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                      </select>
                      <button className={botonSec}>Guardar rol</button>
                    </form>
                    <form action={resetearPassword} className="flex gap-2">
                      <input type="hidden" name="miembroId" value={m.id} />
                      <input name="password" type="password" required minLength={8} maxLength={72} placeholder="Nueva contraseña" aria-label={`Nueva contraseña de ${m.nombre}`} className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm" />
                      <button className={botonSec}>Cambiar</button>
                    </form>
                    <form action={alternarActivo}>
                      <input type="hidden" name="miembroId" value={m.id} />
                      <input type="hidden" name="activar" value={m.activo ? 'no' : 'si'} />
                      <button className={botonSec}>{m.activo ? 'Desactivar' : 'Activar'}</button>
                    </form>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">Qué puede hacer cada rol</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {rolesEditables.map((r) => {
            const actuales = normalizarPermisos(r.permisos);
            return (
              <form key={r.id} action={guardarPermisos} className="space-y-2 rounded-xl border border-stone-200 bg-white p-4">
                <input type="hidden" name="rolId" value={r.id} />
                <h4 className="font-medium">{r.nombre}</h4>
                {PERMISOS.map((p) => (
                  <label key={p.clave} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name={p.clave} defaultChecked={actuales[p.clave] === true} />
                    {p.etiqueta}
                  </label>
                ))}
                <button className={boton}>Guardar permisos</button>
              </form>
            );
          })}
        </div>
        <p className="text-sm text-stone-500">El rol Dueño siempre puede todo y no se puede modificar.</p>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Verificar y commitear**

```bash
npm run typecheck && npm run lint && npm run build
git add src
git commit -m "feat(panel): gestión de empleados, roles y permisos (solo dueño)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Pruebas end to end

**Files:**
- Create: `playwright.config.ts`, `e2e/panel.spec.ts`

**Interfaces:**
- Consumes: todos los textos de UI listados en las Tasks 7, 8, 9 y 10. Requiere Supabase local corriendo y `.env.local` generado (Task 2).

- [ ] **Step 1: Instalar el navegador y configurar Playwright**

```bash
npx playwright install chromium
```
Si faltan librerías del sistema, correr `npx playwright install-deps chromium` (puede pedir sudo; avisarle al usuario antes).

`playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://localhost:3000', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

- [ ] **Step 2: Escribir los tests**

`e2e/panel.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';

const sufijo = Date.now().toString(36);
const dueno = { email: `dueno-${sufijo}@example.com`, password: 'clave-segura-1' };
const slug = `barberia-${sufijo}`;
const empleado = { nombre: 'Juan Pérez', usuario: `juan${sufijo}`, password: 'clave-empleado-1' };

async function loginDueno(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(dueno.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(dueno.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

async function loginEmpleado(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Soy empleado').check();
  await page.getByLabel('Usuario').fill(` ${empleado.usuario.toUpperCase()} `);
  await page.getByLabel('Código del negocio').fill(slug);
  await page.getByLabel('Contraseña', { exact: true }).fill(empleado.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

test.describe.configure({ mode: 'serial' });

test('el dueño registra su negocio y llega al panel', async ({ page }) => {
  await page.goto('/registro');
  await page.getByLabel('Tu nombre').fill('Ana');
  await page.getByLabel('Email').fill(dueno.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(dueno.password);
  await page.getByRole('button', { name: 'Siguiente' }).click();

  await page.getByLabel('Nombre del negocio').fill('Barbería E2E');
  await page.getByLabel('Peluquería / Barbería').check();
  await page.getByLabel('Link de tu página').fill(slug);
  await expect(page.getByText('Disponible', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente' }).click();

  await page.getByLabel('Sí, vendo productos').check();
  await page.getByLabel('Turnos editables (según el servicio)').check();
  await page.getByRole('button', { name: 'Crear mi negocio' }).click();

  await expect(page).toHaveURL(/\/panel$/);
  await expect(page.getByRole('heading', { name: 'Barbería E2E' })).toBeVisible();
  await expect(page.getByText('Primeros pasos')).toBeVisible();
});

test('un link ya usado se avisa antes de continuar', async ({ page }) => {
  await page.goto('/registro');
  await page.getByLabel('Tu nombre').fill('Otra');
  await page.getByLabel('Email').fill(`otra-${sufijo}@example.com`);
  await page.getByLabel('Contraseña', { exact: true }).fill('clave-segura-1');
  await page.getByRole('button', { name: 'Siguiente' }).click();

  await page.getByLabel('Nombre del negocio').fill('Copia');
  await page.getByLabel('Link de tu página').fill(slug);
  await expect(page.getByText('No disponible')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Siguiente' })).toBeDisabled();

  await page.getByLabel('Link de tu página').fill('panel');
  await expect(page.getByText('No disponible')).toBeVisible();
});

test('el dueño crea un empleado que entra sin ver Empleados', async ({ page }) => {
  await loginDueno(page);
  await page.goto('/panel/empleados');
  await expect(page.getByRole('heading', { name: 'Empleados', exact: true })).toBeVisible();

  await page.getByLabel('Nombre', { exact: true }).fill(empleado.nombre);
  await page.getByLabel('Usuario', { exact: true }).fill(empleado.usuario);
  await page.getByLabel('Contraseña', { exact: true }).fill(empleado.password);
  await page.getByLabel('Rol', { exact: true }).selectOption({ label: 'Recepción' });
  await page.getByRole('button', { name: 'Crear empleado' }).click();
  await expect(page.getByText('Empleado creado.')).toBeVisible();
  await page.getByRole('button', { name: 'Salir' }).click();

  await loginEmpleado(page);
  await expect(page.getByRole('link', { name: 'Empleados' })).toHaveCount(0);
  await page.goto('/panel/empleados');
  await expect(page).toHaveURL(/\/panel$/);
});

test('un empleado desactivado con la sesión abierta pierde el acceso', async ({ browser }) => {
  const ctxEmpleado = await browser.newContext();
  const paginaEmpleado = await ctxEmpleado.newPage();
  await loginEmpleado(paginaEmpleado);

  const ctxDueno = await browser.newContext();
  const paginaDueno = await ctxDueno.newPage();
  await loginDueno(paginaDueno);
  await paginaDueno.goto('/panel/empleados');
  await paginaDueno
    .getByRole('listitem')
    .filter({ hasText: empleado.usuario })
    .getByRole('button', { name: 'Desactivar' })
    .click();
  await expect(paginaDueno.getByText('Empleado desactivado.')).toBeVisible();

  await paginaEmpleado.goto('/panel');
  await expect(paginaEmpleado).toHaveURL(/\/login/);

  await ctxEmpleado.close();
  await ctxDueno.close();
});
```

- [ ] **Step 3: Correr los e2e**

Run: `npm run test:e2e`
Expected: 4 tests PASS. Si el test 3 falla en el alta del usuario de Auth porque rechaza el dominio `.invalid`, cambiar solo `emailInterno` (y su test en `empleados.test.ts`) a un dominio con TLD aceptado como `staff.sistema-turnos.local`, y reportar el cambio.

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts e2e package.json package-lock.json
git commit -m "test(e2e): onboarding, empleados y desactivación con sesión abierta

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Verificación final y preview en Vercel

**Files:** ninguno nuevo (salvo `README.md` breve).

- [ ] **Step 1: README de desarrollo**

Crear `README.md`:

```markdown
# Sistema de Turnos

Plataforma SaaS de turnos para canchas, peluquerías/barberías y estéticas. Diseño: `docs/superpowers/specs/`. Planes: `docs/superpowers/plans/`.

## Desarrollo local

Requiere Node 22 y Docker.

    npm install
    npx supabase start
    ./scripts/env-local.sh
    npm run dev

## Pruebas

    npm test          # unitarias (Vitest)
    npm run test:db   # RLS y funciones (pgTAP)
    npm run test:e2e  # flujo completo (Playwright)
```

- [ ] **Step 2: Correr toda la verificación**

```bash
npm run lint && npm run typecheck && npm test && npm run test:db && npm run build && npm run test:e2e
```
Expected: todo en verde (unit, 28 pgTAP, 4 e2e). Reportar el resultado real, con el número de tests de cada suite.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README de desarrollo

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Preview en Vercel (acción externa: pedir confirmación al usuario antes de cada paso)**

Estos pasos publican código y crean infraestructura; **no ejecutarlos sin el visto bueno explícito del usuario**:

1. `git push -u origin rewrite-saas`. Vercel crea un preview de la rama; `main` y producción no cambian.
2. El usuario crea un proyecto de Supabase en la nube (o se usa el plugin de Supabase), y se corre `npx supabase link --project-ref <ref>` y `npx supabase db push` para aplicar la migración.
3. En Vercel, cargar para el entorno Preview las variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` del proyecto en la nube (la service role **nunca** con prefijo `NEXT_PUBLIC_`).
4. En Supabase (Auth → Providers → Email) dejar desactivada la confirmación de email, porque el registro crea la cuenta ya confirmada.
5. Abrir la URL del preview y repetir a mano: registrar un negocio, crear un empleado, entrar como empleado.
