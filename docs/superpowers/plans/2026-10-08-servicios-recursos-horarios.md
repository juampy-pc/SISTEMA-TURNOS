# Servicios, recursos y horarios — Plan de implementación (sub-proyecto 2a)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El dueño (o quien tenga permiso) puede cargar servicios, recursos (canchas/profesionales), qué recurso hace qué servicio, los horarios semanales de cada recurso, bloqueos (feriados/vacaciones) y la configuración de turnos (paso, anticipación mínima/máxima), con valores precargados según el rubro.

**Architecture:** Mismo patrón que el sub-proyecto 1: tablas con `negocio_id` + RLS (escritura exigiendo el permiso `gestionar_servicios`), lógica pura en `src/lib/dominio/` testeada con Vitest, Server Actions que redirigen con `?ok=`/`?error=`, páginas server-rendered. Los horarios se guardan en minutos desde medianoche (enteros) para poder usar una restricción de exclusión anti-solapamiento (`int4range` + `btree_gist`).

**Tech Stack:** Next.js 16, Supabase (Postgres/RLS/pgTAP), zod 4, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-07-sistema-turnos-saas-design.md` (secciones 3, 4, 6 y 7 "Disponibilidad").

**Alcance y desvíos:** El sub-proyecto 2 del spec se parte en tres planes: **2a (este)**: servicios, recursos, horarios, bloqueos, configuración y datos de plantilla (paso 4 del onboarding, como página "Primeros pasos"); **2b**: clientes, normalización de teléfonos, tabla `turnos` con restricción de exclusión, función de disponibilidad y agenda del panel; **2c**: reserva pública `/b/[slug]`, confirmación y dispositivos confiables. Los recursos y servicios no se borran, se desactivan (`activo`), porque 2b los referencia desde `turnos`.

## Global Constraints

- Multi-tenancy: `negocio_id` en cada tabla, aislamiento con RLS; los permisos se aplican en la base, no solo ocultando botones.
- Interfaz en español rioplatense (voseo). Vocabulario por rubro desde `plantillas.ts` (cancha/profesional).
- Principio rector: tareas frecuentes en pocos toques, desde el celular, con valores precargados; lo opcional es opcional.
- Cada commit termina con la línea `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Directorio de trabajo: `/home/juan/proyectos/sistema-turnos`, rama `rewrite-saas`. Antes de escribir código Next leer la guía correspondiente en `node_modules/next/dist/docs/` (AGENTS.md).
- Comandos de Supabase con `sg docker -c "..."`.

## Review Focus

1. **Franjas horarias solapadas o invertidas** (`09:00-13:00` y `12:00-18:00`, o `18:00-09:00`): se rechazan con mensaje claro, en TS y en la base. → Task 2 (pgTAP) y Task 3 (Vitest).
2. **Un empleado sin `gestionar_servicios`** intenta crear/editar por la API: la base lo rechaza. → Task 2.
3. **Referencias cruzadas entre negocios** (asignar un servicio de otro negocio a mi recurso, horario con recurso ajeno): rechazadas estructuralmente por FK compuesta. → Task 2.
4. **Servicio con duración 0/negativa o precio negativo; nombre vacío o en blanco.** → Task 2 y Task 3.
5. **Bloqueo con fin anterior al inicio**, o bloqueo de un recurso que no es del negocio. → Task 2 y Task 3.

---

## Mapa de archivos

```
supabase/migrations/20261008120000_servicios_recursos_horarios.sql
supabase/tests/servicios_recursos_horarios.test.sql
src/lib/dominio/
  horarios.ts(.test.ts)        # minutos <-> "HH:MM", validación de franjas, días
  esquemas-turnos.ts(.test.ts) # zod: servicio, recurso, franja, bloqueo, config
  plantillas.ts                # + datos de ejemplo por rubro (modifica)
  menu.ts                      # + items Servicios, Recursos, Horarios (modifica)
src/app/panel/
  servicios/{page.tsx,actions.ts}
  recursos/{page.tsx,actions.ts}
  horarios/{page.tsx,actions.ts}
  primeros-pasos/{page.tsx,actions.ts}
src/lib/supabase/database.types.ts  # regenerado
e2e/servicios-horarios.spec.ts
```

---

### Task 1: Dominio de horarios y esquemas

**Files:**
- Create: `src/lib/dominio/horarios.ts`, `src/lib/dominio/horarios.test.ts`, `src/lib/dominio/esquemas-turnos.ts`, `src/lib/dominio/esquemas-turnos.test.ts`

**Interfaces:**
- Produces:
  - `DIAS: readonly { n: number; corto: string; largo: string }[]` (0 = domingo … 6 = sábado)
  - `parseHora(s: string): number | null` ("09:30" → 570; inválido → null; "24:00" → 1440)
  - `formatearHora(min: number): string`
  - `validarFranjas(f: { desde_min: number; hasta_min: number }[]): string | null` (mensaje de error o null)
  - zod: `servicioSchema`, `recursoSchema`, `franjaSchema`, `bloqueoSchema`, `configTurnosSchema`

- [ ] **Step 1: Tests de `horarios.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { formatearHora, parseHora, validarFranjas } from './horarios';

describe('parseHora / formatearHora', () => {
  it('convierte HH:MM a minutos y viceversa', () => {
    expect(parseHora('09:30')).toBe(570);
    expect(parseHora('0:05')).toBe(5);
    expect(parseHora('24:00')).toBe(1440);
    expect(formatearHora(570)).toBe('09:30');
    expect(formatearHora(1440)).toBe('24:00');
  });
  it('rechaza horas inválidas', () => {
    for (const s of ['', '9', '25:00', '12:60', 'ab:cd', '24:01', '-1:00']) expect(parseHora(s)).toBeNull();
  });
});

describe('validarFranjas', () => {
  it('acepta franjas ordenadas y sin solape, incluso pegadas', () => {
    expect(validarFranjas([{ desde_min: 540, hasta_min: 780 }, { desde_min: 780, hasta_min: 1080 }])).toBeNull();
  });
  it('rechaza franjas invertidas o vacías', () => {
    expect(validarFranjas([{ desde_min: 1080, hasta_min: 540 }])).toMatch(/anterior/);
    expect(validarFranjas([{ desde_min: 540, hasta_min: 540 }])).toMatch(/anterior/);
  });
  it('rechaza solapes sin importar el orden de carga', () => {
    expect(validarFranjas([{ desde_min: 720, hasta_min: 1080 }, { desde_min: 540, hasta_min: 780 }])).toMatch(/superpone/);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/lib/dominio/horarios.test.ts` → FAIL (módulo inexistente).

- [ ] **Step 3: Implementar `horarios.ts`**

```ts
export const DIAS = [
  { n: 1, corto: 'Lun', largo: 'Lunes' },
  { n: 2, corto: 'Mar', largo: 'Martes' },
  { n: 3, corto: 'Mié', largo: 'Miércoles' },
  { n: 4, corto: 'Jue', largo: 'Jueves' },
  { n: 5, corto: 'Vie', largo: 'Viernes' },
  { n: 6, corto: 'Sáb', largo: 'Sábado' },
  { n: 0, corto: 'Dom', largo: 'Domingo' },
] as const;

export function parseHora(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59 || h > 24 || (h === 24 && min > 0)) return null;
  return h * 60 + min;
}

export function formatearHora(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface Franja {
  desde_min: number;
  hasta_min: number;
}

export function validarFranjas(franjas: Franja[]): string | null {
  for (const f of franjas) {
    if (f.hasta_min <= f.desde_min) return 'La hora de cierre tiene que ser posterior a la de apertura.';
  }
  const orden = [...franjas].sort((a, b) => a.desde_min - b.desde_min);
  for (let i = 1; i < orden.length; i++) {
    if (orden[i].desde_min < orden[i - 1].hasta_min) return 'Hay franjas que se superponen.';
  }
  return null;
}
```

- [ ] **Step 4:** correr el test → PASS.

- [ ] **Step 5: Tests de `esquemas-turnos.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { bloqueoSchema, configTurnosSchema, franjaSchema, recursoSchema, servicioSchema } from './esquemas-turnos';

describe('servicioSchema', () => {
  it('acepta un servicio válido y recorta el nombre', () => {
    const r = servicioSchema.parse({ nombre: '  Corte  ', duracion_min: '30', precio: '8000' });
    expect(r).toEqual({ nombre: 'Corte', duracion_min: 30, precio: 8000 });
  });
  it.each([
    [{ nombre: '   ', duracion_min: '30', precio: '1' }],
    [{ nombre: 'Corte', duracion_min: '0', precio: '1' }],
    [{ nombre: 'Corte', duracion_min: '-5', precio: '1' }],
    [{ nombre: 'Corte', duracion_min: '600', precio: '1' }],
    [{ nombre: 'Corte', duracion_min: '30', precio: '-1' }],
    [{ nombre: 'Corte', duracion_min: '30', precio: 'abc' }],
  ])('rechaza %j', (entrada) => {
    expect(servicioSchema.safeParse(entrada).success).toBe(false);
  });
});

describe('recursoSchema', () => {
  it('exige nombre de 2 a 60 caracteres', () => {
    expect(recursoSchema.safeParse({ nombre: 'Cancha 1' }).success).toBe(true);
    expect(recursoSchema.safeParse({ nombre: ' ' }).success).toBe(false);
  });
});

describe('franjaSchema', () => {
  it('convierte HH:MM y valida orden', () => {
    expect(franjaSchema.parse({ dia_semana: '1', desde: '09:00', hasta: '13:00' })).toEqual({
      dia_semana: 1, desde_min: 540, hasta_min: 780,
    });
    expect(franjaSchema.safeParse({ dia_semana: '1', desde: '13:00', hasta: '09:00' }).success).toBe(false);
    expect(franjaSchema.safeParse({ dia_semana: '7', desde: '09:00', hasta: '10:00' }).success).toBe(false);
  });
});

describe('bloqueoSchema', () => {
  it('rechaza fin anterior al inicio', () => {
    expect(bloqueoSchema.safeParse({ desde: '2026-12-25', hasta: '2026-12-24', motivo: '' }).success).toBe(false);
    expect(bloqueoSchema.safeParse({ desde: '2026-12-25', hasta: '2026-12-25', motivo: 'Navidad' }).success).toBe(true);
  });
});

describe('configTurnosSchema', () => {
  it('valida paso y anticipación', () => {
    expect(configTurnosSchema.safeParse({ paso_minutos: '60', anticipacion_min_horas: '1', anticipacion_max_dias: '30' }).success).toBe(true);
    expect(configTurnosSchema.safeParse({ paso_minutos: '7', anticipacion_min_horas: '1', anticipacion_max_dias: '30' }).success).toBe(false);
    expect(configTurnosSchema.safeParse({ paso_minutos: '60', anticipacion_min_horas: '-1', anticipacion_max_dias: '30' }).success).toBe(false);
  });
});
```

- [ ] **Step 6:** correr → FAIL. **Step 7: Implementar**

```ts
import { z } from 'zod';
import { parseHora } from './horarios';

export const PASOS_MINUTOS = [15, 20, 30, 45, 60, 90, 120] as const;

const nombre = (max: number) =>
  z.string().trim().min(2, 'El nombre es muy corto.').max(max, `El nombre es muy largo (máximo ${max}).`);

export const servicioSchema = z.object({
  nombre: nombre(80),
  duracion_min: z.coerce.number({ error: 'Duración inválida.' }).int().min(5, 'La duración mínima es de 5 minutos.').max(480, 'La duración máxima es de 8 horas.'),
  precio: z.coerce.number({ error: 'Precio inválido.' }).min(0, 'El precio no puede ser negativo.').max(99999999, 'Precio demasiado alto.'),
});

export const recursoSchema = z.object({ nombre: nombre(60) });

const hora = z.string().transform((s, ctx) => {
  const m = parseHora(s);
  if (m === null) ctx.addIssue({ code: 'custom', message: 'Hora inválida.' });
  return m ?? 0;
});

export const franjaSchema = z
  .object({ dia_semana: z.coerce.number().int().min(0).max(6), desde: hora, hasta: hora })
  .refine((f) => f.hasta > f.desde, { message: 'La hora de cierre tiene que ser posterior a la de apertura.' })
  .transform((f) => ({ dia_semana: f.dia_semana, desde_min: f.desde, hasta_min: f.hasta }));

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida.');

export const bloqueoSchema = z
  .object({ desde: fecha, hasta: fecha, motivo: z.string().trim().max(80).default('') })
  .refine((b) => b.hasta >= b.desde, { message: 'La fecha de fin no puede ser anterior a la de inicio.' });

export const configTurnosSchema = z.object({
  paso_minutos: z.coerce.number().refine((n) => (PASOS_MINUTOS as readonly number[]).includes(n), 'Paso inválido.'),
  anticipacion_min_horas: z.coerce.number().int().min(0).max(168),
  anticipacion_max_dias: z.coerce.number().int().min(1).max(365),
});
```

- [ ] **Step 8:** `npx vitest run` → todo PASS. **Step 9: Commit** `feat(dominio): horarios y esquemas de servicios, recursos, bloqueos y configuración`.

---

### Task 2: Migración, RLS y pruebas pgTAP

**Files:**
- Create: `supabase/migrations/20261008120000_servicios_recursos_horarios.sql`, `supabase/tests/servicios_recursos_horarios.test.sql`
- Modify: `src/lib/supabase/database.types.ts` (regenerar)

**Interfaces:**
- Produces tablas: `recursos(id, negocio_id, nombre, miembro_id, activo, orden)`, `servicios(id, negocio_id, nombre, duracion_min, precio, activo)`, `recurso_servicio(recurso_id, servicio_id, negocio_id)`, `horarios(id, negocio_id, recurso_id, dia_semana, desde_min, hasta_min)`, `bloqueos(id, negocio_id, recurso_id null, desde date, hasta date, motivo)`; columnas nuevas en `negocios`: `paso_minutos`, `anticipacion_min_horas`, `anticipacion_max_dias`.
- Los bloqueos son por **día** (fechas inclusivas, en la zona horaria del negocio); 2b los traduce a rangos.

- [ ] **Step 1: Migración**

```sql
-- Servicios, recursos, horarios, bloqueos y configuración de turnos.
create extension if not exists btree_gist with schema extensions;

alter table public.negocios
  add column paso_minutos int not null default 60 check (paso_minutos in (15, 20, 30, 45, 60, 90, 120)),
  add column anticipacion_min_horas int not null default 1 check (anticipacion_min_horas between 0 and 168),
  add column anticipacion_max_dias int not null default 30 check (anticipacion_max_dias between 1 and 365);

create table public.recursos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 2 and 60),
  miembro_id uuid references public.miembros (id) on delete set null,
  activo boolean not null default true,
  orden int not null default 0,
  created_at timestamptz not null default now(),
  unique (id, negocio_id),
  unique (negocio_id, nombre)
);
create index recursos_negocio_idx on public.recursos (negocio_id);

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
create index recurso_servicio_servicio_idx on public.recurso_servicio (servicio_id);

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

-- Privilegios
revoke all on public.recursos, public.servicios, public.recurso_servicio, public.horarios, public.bloqueos
  from anon, authenticated;
grant select, delete on public.recurso_servicio, public.horarios, public.bloqueos to authenticated;
grant select on public.recursos, public.servicios to authenticated;
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
```

Nota: `miembro_id` de un recurso debe ser del mismo negocio. Agregar un trigger o FK compuesta: como `miembros` no tiene `unique (id, negocio_id)`, agregar en la misma migración `alter table public.miembros add unique (id, negocio_id);` y usar `foreign key (miembro_id, negocio_id) references public.miembros (id, negocio_id)` en lugar de la FK simple de `recursos` (con `on delete set null (miembro_id)` no está disponible en PG < 15; usar la forma compuesta sin `on delete`, ya que los miembros se desactivan, no se borran).

- [ ] **Step 2: Test pgTAP** `supabase/tests/servicios_recursos_horarios.test.sql`. Reusar el patrón de `base.test.sql` (usuarios en `auth.users`, `crear_negocio` con `test_roles()`, `set_config('request.jwt.claims', …)` + `set local role authenticated`). Casos (cada uno una aserción):
  1. dueño A inserta recurso, servicio y los asigna (`lives_ok`).
  2. empleado de A **sin** `gestionar_servicios` (rol Profesional) no puede insertar servicio (`throws_ok` `42501`).
  3. empleado con `gestionar_servicios` sí puede (darlo vía `update roles set permisos` como superusuario).
  4. B no ve recursos/servicios de A (`is(count, 0)`).
  5. B no puede insertar un horario con `recurso_id` de A y `negocio_id` de B (`throws_ok` `23503`).
  6. B no puede asignar un servicio propio a un recurso de A (`23503`).
  7. horario `540-780` y luego `720-1080` mismo recurso y día → `23P01`; `780-1080` pegado → ok.
  8. `desde_min >= hasta_min` → `23514`.
  9. servicio con `duracion_min = 0` → `23514`; `precio = -1` → `23514`; nombre `'  '` → `23514`.
  10. bloqueo con `hasta < desde` → `23514`; bloqueo sin `recurso_id` (todo el negocio) ok.
  11. `update negocios set paso_minutos = 7` → `23514`; `= 30` ok para dueño; un Profesional sin permiso actualiza 0 filas.
  12. empleado desactivado (`activo = false`) no ve ni inserta nada.
  Ajustar `select plan(N)` al total.

- [ ] **Step 3:** `sg docker -c "npx supabase test db"` → FAIL (tablas inexistentes). **Step 4:** `sg docker -c "npx supabase db reset"` y volver a correr → PASS.
- [ ] **Step 5:** Regenerar tipos: `sg docker -c "npx supabase gen types typescript --local" > src/lib/supabase/database.types.ts` (mantener el formato; si el script del repo difiere, ver `git log -- src/lib/supabase/database.types.ts`). `npm run typecheck`.
- [ ] **Step 6: Commit** `feat(db): servicios, recursos, horarios, bloqueos y configuración de turnos con RLS`.

---

### Task 3: Plantillas con datos de ejemplo

**Files:**
- Modify: `src/lib/dominio/plantillas.ts`, `src/lib/dominio/plantillas.test.ts`

**Interfaces:**
- Produces en `Plantilla`: `ejemplo: { recursos: string[]; servicios: { nombre: string; duracion_min: number; precio: number }[]; horario: { dias: number[]; desde_min: number; hasta_min: number } }`.

- [ ] **Step 1: Test:** para cada tipo, `ejemplo.recursos.length >= 1`, cada servicio pasa `servicioSchema` (con strings), el horario tiene `hasta_min > desde_min`, y para `cancha` hay un servicio de 60 min (grilla fija).
- [ ] **Step 2:** FAIL. **Step 3:** agregar datos: cancha → recursos `['Cancha 1', 'Cancha 2']`, servicio `{ 'Alquiler 1 hora', 60, 0 }`, horario lun–dom 16:00–24:00 (`960`–`1440`); peluquería → `['Profesional 1']`, servicios Corte 30/0, Corte y barba 45/0, horario lun–sáb 09:00–18:00; estética → `['Profesional 1']`, servicios Limpieza facial 60/0, Depilación 30/0, horario lun–sáb 09:00–18:00. Precio 0 = "a definir" (el dueño lo completa).
- [ ] **Step 4:** PASS. **Step 5: Commit** `feat(dominio): datos de ejemplo por rubro en las plantillas`.

---

### Task 4: Servicios y recursos en el panel

**Files:**
- Create: `src/app/panel/servicios/{page.tsx,actions.ts}`, `src/app/panel/recursos/{page.tsx,actions.ts}`
- Modify: `src/lib/dominio/menu.ts`, `src/lib/dominio/menu.test.ts`

**Interfaces:**
- Consumes: `servicioSchema`, `recursoSchema` (Task 1), `obtenerContexto`, `puede`, `plantillaDe`.
- Produces acciones: `crearServicio`, `editarServicio`, `alternarServicio` (formData: `servicioId`, `activar`); `crearRecurso`, `renombrarRecurso`, `alternarRecurso`, `guardarServiciosDeRecurso` (formData: `recursoId`, checkboxes `servicio_<uuid>`).

- [ ] **Step 1:** Test de menú: `itemsDeMenu` muestra "Servicios", "Recursos" y "Horarios" solo con `gestionar_servicios` (o dueño); etiqueta de Recursos usa el vocabulario del rubro (se resuelve en el layout, el item base se llama "Recursos").
- [ ] **Step 2:** FAIL → agregar a `ITEMS_MENU`: `/panel/servicios` (Servicios), `/panel/recursos` (Recursos), `/panel/horarios` (Horarios), los tres con `permiso: 'gestionar_servicios'`. PASS.
- [ ] **Step 3:** Implementar acciones y páginas copiando el patrón de `src/app/panel/empleados/` (función `volver`, `exigirPermiso` que hace `puede(ctx.rol, 'gestionar_servicios')`, validación zod, `negocio_id` explícito en cada insert/update, errores `23505` → "Ya existe uno con ese nombre."). Las páginas listan activos primero, muestran inactivos plegados con botón "Reactivar", formulario de alta arriba con valores sugeridos (duración 30, precio vacío), y en Recursos una lista de checkboxes de servicios por recurso con botón Guardar. Mobile-first (grillas de una columna por defecto).
- [ ] **Step 4:** `npm run typecheck && npm run lint && npm test`. Probar a mano con `npm run dev` (crear servicio, recurso, asignar, desactivar) y verificar que un Profesional sin permiso no ve el menú ni entra por URL (redirect a `/panel`).
- [ ] **Step 5: Commit** `feat(panel): gestión de servicios y recursos`.

---

### Task 5: Horarios, bloqueos y configuración de turnos

**Files:**
- Create: `src/app/panel/horarios/{page.tsx,actions.ts}`

**Interfaces:**
- Consumes: `franjaSchema`, `validarFranjas`, `bloqueoSchema`, `configTurnosSchema`, `DIAS`, `formatearHora`.
- Produces acciones: `agregarFranja` (formData `recursoId`, `dia_semana` (uno o varios `dias`), `desde`, `hasta`), `quitarFranja` (`franjaId`), `copiarHorario` (`recursoId`, `desdeRecursoId`), `agregarBloqueo` (`recursoId` opcional, `desde`, `hasta`, `motivo`), `quitarBloqueo` (`bloqueoId`), `guardarConfigTurnos`.

- [ ] **Step 1:** `agregarFranja` acepta varios días a la vez (checkboxes Lun–Dom con la misma franja: pocos toques). Antes de insertar, cargar las franjas existentes del recurso en esos días y correr `validarFranjas([...existentes, nueva])`; si hay error, `volver('error', …)`. La restricción de la base queda como defensa final (`23P01` → "Esa franja se superpone con otra.").
- [ ] **Step 2:** `copiarHorario`: copia todas las franjas de otro recurso del mismo negocio (reemplaza las del destino en un delete + insert; si el insert falla, se informa el error y se vuelve a insertar las originales).
- [ ] **Step 3:** Página: selector de recurso (`?recurso=<id>`), grilla de los 7 días con sus franjas y botón "×", formulario de alta con precarga 09:00–18:00 (o la del rubro), sección Bloqueos (lista de futuros + formulario con "todos los recursos" por defecto), sección Configuración (paso solo visible si `modo_turnos = 'fijo'`; anticipación mínima y máxima siempre).
- [ ] **Step 4:** `npm run typecheck && npm run lint && npm test` y prueba manual: cargar `09–13` y `12–18` el mismo día → error claro; `13–18` → ok; un bloqueo con fin anterior → error.
- [ ] **Step 5: Commit** `feat(panel): horarios por recurso, bloqueos y configuración de turnos`.

---

### Task 6: Primeros pasos (datos de plantilla) y checklist

**Files:**
- Create: `src/app/panel/primeros-pasos/{page.tsx,actions.ts}`
- Modify: `src/lib/dominio/checklist.ts`, `src/lib/dominio/checklist.test.ts`, `src/app/(auth)/registro/actions.ts` (redirect final), `src/app/panel/page.tsx` (datos para el checklist)

**Interfaces:**
- Consumes: `plantillaDe(tipo).ejemplo` (Task 3).
- Produces: acción `cargarPlantilla` (formData `recurso_0..n`, `servicio_<i>_nombre/duracion/precio`, `dias`, `desde`, `hasta`): crea recursos, servicios, asignaciones y horarios en una sola función RPC.

- [ ] **Step 1: RPC `public.sembrar_plantilla(p_recursos jsonb, p_servicios jsonb, p_dias int[], p_desde int, p_hasta int) returns void`** (security definer, `search_path = ''`, solo si `private.tiene_permiso('gestionar_servicios')`, y solo si el negocio **no tiene** recursos ni servicios todavía → `raise exception 'ya_configurado'`). Inserta recursos, servicios, todas las combinaciones recurso×servicio y una franja por día y recurso. Agregarla a una **nueva migración** `20261008130000_sembrar_plantilla.sql` (no editar la anterior) y cubrirla en pgTAP: éxito, doble llamada falla, sin permiso falla, otro negocio no recibe filas.
- [ ] **Step 2:** Tests de checklist: nuevos ítems "Cargá tus servicios", "Cargá tus {recurso}", "Definí tus horarios" completados según conteos (`servicios > 0`, `recursos > 0`, `horarios > 0`); ver la firma actual de `checklist.ts` y extender sin romper los tests existentes.
- [ ] **Step 3:** Página "Primeros pasos": formulario precargado con el ejemplo del rubro, editable (nombres, duraciones, precios, días y horario), botón "Cargar y seguir" y enlace "Prefiero cargarlo yo" que va al panel. Si el negocio ya tiene recursos o servicios, redirige a `/panel`.
- [ ] **Step 4:** El registro redirige a `/panel/primeros-pasos` en lugar de `/panel`. Actualizar el e2e de onboarding existente (`e2e/`) para el nuevo destino: o completar el formulario o usar el enlace "Prefiero cargarlo yo".
- [ ] **Step 5:** `npm test && sg docker -c "npx supabase test db" && npm run typecheck && npm run lint`. **Commit** `feat: primeros pasos con datos de plantilla y checklist de turnos`.

---

### Task 7: E2E y cierre

**Files:**
- Create: `e2e/servicios-horarios.spec.ts`
- Modify: `README.md`

- [ ] **Step 1:** Escenario Playwright (seguir el estilo de los specs existentes en `e2e/`): registrar negocio de peluquería → en Primeros pasos aceptar los datos de ejemplo → ver servicios y recurso cargados → agregar franja solapada y ver el error → desactivar un servicio y verlo en "Inactivos" → bloqueo con fecha inválida muestra error.
- [ ] **Step 2:** `npm run test:e2e` (con el stack corriendo) → PASS. Si hay flakiness por arranque en frío, usar los mismos márgenes que los specs existentes.
- [ ] **Step 3:** README: actualizar la lista de pruebas (nuevo archivo pgTAP) y anotar que 2b/2c siguen pendientes.
- [ ] **Step 4:** Corrida final completa: `npm test && npm run typecheck && npm run lint && sg docker -c "npx supabase test db" && npm run test:e2e`. **Commit** `test(e2e): servicios, horarios y primeros pasos; docs`.

---

## Self-review

- **Cobertura del spec:** servicios, recursos, `recurso_servicio`, horarios, bloqueos (sec. 4), anticipación mínima/máxima y paso (sec. 7), paso 4 del onboarding (sec. 6), permisos en RLS (sec. 5), vocabulario por rubro (sec. 3). Pendientes explícitos en 2b/2c: `turnos`, `clientes`, disponibilidad, reserva pública.
- **Consistencia de nombres:** `desde_min`/`hasta_min`, `dia_semana`, `gestionar_servicios`, `paso_minutos`, `anticipacion_min_horas`, `anticipacion_max_dias` iguales en SQL, zod y acciones.
- **Decisión a validar con el dueño del producto:** bloqueos por día completo (no por hora) y feriados cargados a mano; precio 0 en la plantilla significa "a definir".
