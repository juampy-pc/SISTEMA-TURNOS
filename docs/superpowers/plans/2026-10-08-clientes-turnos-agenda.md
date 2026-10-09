# Clientes, turnos, disponibilidad y agenda — Plan de implementación (sub-proyecto 2b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El negocio puede ver su agenda por día y recurso, crear turnos a mano eligiendo entre huecos libres, cambiar su estado (confirmar, completar y cobrar, cancelar, no vino) y gestionar clientes (listado, ficha con historial, notas, posibles duplicados y unión), sin que dos turnos se pisen nunca.

**Architecture:** Igual que 2a: tablas con `negocio_id` + RLS, lógica pura en `src/lib/dominio/`, Server Actions con `?ok=`/`?error=`, páginas server-rendered sin JS de cliente. La disponibilidad vive en Postgres (`private.huecos` + wrapper `public.huecos_disponibles`) y la restricción de exclusión sobre `turnos` es la defensa final ante reservas simultáneas.

**Tech Stack:** Next.js 16, Supabase (Postgres/RLS/pgTAP, `btree_gist`), `libphonenumber-js`, zod 4, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-07-sistema-turnos-saas-design.md` (secciones 4, 5, 6 y 7).

**Alcance y desvíos:** Reserva pública, rate limiting, confirmación por dispositivos confiables y wrapper `anon` de disponibilidad son **2c**. Aquí `huecos_disponibles` es solo para miembros autenticados. `monto_cobrado` queda en `turnos` y lo ve quien ve el turno; el gate de "ver ingresos" se aplica en las Métricas (sub-proyecto 5) — riesgo conocido, anotado en Review Focus.

## Global Constraints

- Multi-tenancy: `negocio_id` en cada tabla, aislamiento con RLS; permisos aplicados en la base.
- Una restricción de exclusión sobre el rango de tiempo por recurso (estados activos) impide solapamientos.
- Teléfono en E.164, país por defecto Argentina; mismo número normalizado = mismo cliente (`unique (negocio_id, telefono)`); el mismo número en dos negocios son dos clientes.
- Números parecidos se **sugieren** como posible duplicado, nunca se fusionan solos.
- El rol Profesional ve solo su propia agenda; `ver_agendas_ajenas` la abre.
- Interfaz en español rioplatense (voseo). Mobile-first.
- Cada commit termina con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Comandos de Supabase con `sg docker -c "..."`.

## Review Focus

1. **Teléfono escrito de distintas formas** (`011 15-4444-5555`, `+54 9 11 4444-5555`, `1144445555`) → un solo cliente. → Task 1.
2. **Dos turnos simultáneos en el mismo hueco**, o un turno que pisa a uno `pendiente`: el segundo falla con mensaje claro y recarga huecos. → Task 2 (pgTAP), Task 4 (action).
3. **Turno cancelado o `no_vino` libera el hueco**; uno `completado` lo sigue ocupando. → Task 2.
4. **Profesional sin `ver_agendas_ajenas`** no ve ni crea turnos en recursos ajenos. → Task 2.
5. **Unir clientes de distinto negocio** o consigo mismo se rechaza; los turnos se mueven al destino y el origen desaparece. → Task 5.

---

## Mapa de archivos

```
supabase/migrations/20261008140000_clientes_turnos.sql
supabase/tests/clientes_turnos.test.sql
src/lib/dominio/telefono.ts(.test.ts)      # normalizarTelefono, posibleDuplicado
src/lib/dominio/turnos.ts(.test.ts)        # transiciones de estado y etiquetas
src/app/panel/turnos/{page.tsx,actions.ts}
src/app/panel/clientes/{page.tsx,actions.ts}
src/app/panel/clientes/[id]/page.tsx
e2e/turnos.spec.ts
```

---

### Task 1: Normalización de teléfonos y estados de turno (dominio)

**Files:** Create `src/lib/dominio/telefono.ts`, `telefono.test.ts`, `turnos.ts`, `turnos.test.ts`. Dependencia: `npm install libphonenumber-js`.

**Interfaces — Produces:**
- `normalizarTelefono(entrada: string): { ok: true; e164: string } | { ok: false; error: string }` (celulares AR siempre `+549…`).
- `posibleDuplicado(a: string, b: string): boolean` (un dígito de diferencia o mismos últimos 8; mismo número → `false`).
- `ESTADOS_TURNO`, `type EstadoTurno = 'pendiente' | 'confirmado' | 'completado' | 'cancelado' | 'no_vino'`, `ETIQUETA_ESTADO`, `transicionesDe(estado): EstadoTurno[]`, `ocupaHueco(estado): boolean`.

- [ ] Tests con tabla de formatos argentinos, números de otros países, y rechazos (`''`, `'abc'`, `'123'`, `'0000000000'`, número truncado). Ver tests en el repo.
- [ ] Tests de `turnos.ts`: `pendiente → confirmado|cancelado`; `confirmado → completado|no_vino|cancelado`; `completado`, `cancelado`, `no_vino` → solo `[]` salvo reabrir `cancelado → pendiente` no permitido; `ocupaHueco` verdadero solo para pendiente/confirmado/completado.
- [ ] Implementar, correr `npx vitest run`, commit `feat(dominio): normalización de teléfonos y estados de turno`.

### Task 2: Migración — clientes, turnos y disponibilidad

**Files:** Create `supabase/migrations/20261008140000_clientes_turnos.sql`, `supabase/tests/clientes_turnos.test.sql`; regenerar `src/lib/supabase/database.types.ts`.

**Interfaces — Produces:**
- `clientes(id, negocio_id, nombre, telefono, notas, created_at)`; `turnos(id, negocio_id, recurso_id, servicio_id, cliente_id, inicio, fin, estado, notas, nota_cliente, monto_cobrado, created_at)`.
- `private.mi_miembro_id() uuid`, `private.puede_ver_recurso(uuid) boolean`.
- `public.huecos_disponibles(p_recurso uuid, p_servicio uuid, p_fecha date) returns table (inicio timestamptz, fin timestamptz)`.
- `public.unir_clientes(p_origen uuid, p_destino uuid) returns void`.

Reglas de `private.huecos`: largo del turno = `paso_minutos` si `modo_turnos = 'fijo'`, si no la duración del servicio; inicios cada `paso_minutos` (fijo) o cada 15 min (editable), alineados a la apertura de la franja; excluye bloqueos (del recurso o de todo el negocio) que cubren la fecha, turnos que ocupan hueco y se superponen, inicios anteriores a `now() + anticipacion_min_horas` o posteriores a `now() + anticipacion_max_dias`; el recurso y el servicio deben estar activos y vinculados.

- [ ] pgTAP: aislamiento entre negocios; Profesional sin `ver_agendas_ajenas` no ve turnos de otros recursos ni puede insertarlos; exclusión `23P01` al pisar un turno `pendiente`/`confirmado`; cancelado y no_vino liberan; completado ocupa; `fin <= inicio` falla; teléfono mal formado falla (`23514`); mismo teléfono dos veces en un negocio falla (`23505`), en dos negocios no; `huecos_disponibles` respeta franja, bloqueo, turno existente, anticipación mínima; `unir_clientes` mueve turnos, borra el origen, falla entre negocios (`P0001`) y consigo mismo.
- [ ] Aplicar con `db reset`, correr `supabase test db`, regenerar tipos, commit `feat(db): clientes, turnos con exclusión anti-solapamiento y disponibilidad`.

### Task 3: Agenda del panel

**Files:** Create `src/app/panel/turnos/{page.tsx,actions.ts}`; modify `src/lib/dominio/menu.ts` (+ `Turnos` con permiso `gestionar_turnos`, y su test).

**Interfaces — Consumes:** `huecos_disponibles`, `normalizarTelefono`, `transicionesDe`. **Produces acciones:** `crearTurno` (formData `servicioId`, `recursoId`, `fecha`, `inicio` ISO, `nombre`, `telefono`, `nota`), `cambiarEstado` (`turnoId`, `estado`, `monto` opcional para completar).

- [ ] Página `/panel/turnos?fecha=&recurso=&servicio=`: navegación día anterior/siguiente/hoy, turnos del día agrupados por recurso con estado y acciones; formulario "Nuevo turno" en pasos GET (servicio → recurso/“cualquiera” → fecha → huecos como botones radio) + cliente (nombre y teléfono, con sugerencia si el teléfono ya existe).
- [ ] `crearTurno`: valida el hueco contra `huecos_disponibles` (si ya no está, "Ese horario se acaba de ocupar" y recarga), busca o crea cliente por teléfono normalizado, inserta como `confirmado` (alta manual de quien atiende). `23P01` → mismo mensaje.
- [ ] `cambiarEstado`: solo transiciones permitidas; "Cobrado" prellena el precio del servicio, editable.
- [ ] typecheck + lint + prueba manual; commit `feat(panel): agenda de turnos con alta manual y cambios de estado`.

### Task 4: Clientes, ficha y unión de duplicados

**Files:** Create `src/app/panel/clientes/{page.tsx,actions.ts}`, `src/app/panel/clientes/[id]/page.tsx`; modify menú.

- [ ] Listado con búsqueda por nombre o teléfono (`?q=`), orden por nombre; ficha con datos, notas editables, historial de turnos y bloque "Posibles duplicados" (usa `posibleDuplicado`) con botón "Unir en este cliente" que llama `unir_clientes`.
- [ ] Menú: `Clientes` con `gestionar_clientes`.
- [ ] commit `feat(panel): clientes, ficha con historial y unión de duplicados`.

### Task 5: E2E y cierre

**Files:** Create `e2e/turnos.spec.ts`; modify `README.md`.

- [ ] Escenario: registrar negocio, cargar plantilla, crear turno manual para un cliente nuevo, ver que el hueco desaparece, cancelarlo y que el hueco vuelve; mismo teléfono escrito de otra forma reutiliza la ficha; crear un cliente parecido y unirlos.
- [ ] Corrida completa: `npm test && npm run typecheck && npm run lint && sg docker -c "npx supabase test db" && npm run test:e2e`; commit.

---

## Self-review

- Cobertura del spec: tablas `turnos`/`clientes` y exclusión (sec. 4), permisos de agenda propia (sec. 5), agenda y clientes del panel (sec. 6), normalización, duplicados y disponibilidad (sec. 7). Pendiente en 2c: reserva pública, confirmación por dispositivo, rate limiting, nota del cliente desde la web (la columna `nota_cliente` ya existe).
- Nombres consistentes: `huecos_disponibles(p_recurso, p_servicio, p_fecha)`, `unir_clientes(p_origen, p_destino)`, estados `pendiente|confirmado|completado|cancelado|no_vino`.
