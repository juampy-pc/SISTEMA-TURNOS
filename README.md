# Sistema de Turnos

Plataforma SaaS de turnos para canchas, peluquerías/barberías y estéticas. Diseño: `docs/superpowers/specs/`. Planes: `docs/superpowers/plans/`.

## Desarrollo local

Requiere Node 22 y Docker (si tu usuario no está en el grupo `docker`, corré los comandos de Supabase con `sg docker -c "..."`).

    npm install
    npx supabase start
    ./scripts/env-local.sh   # genera .env.local con las claves del stack local
    npm run dev

## Pruebas

    npm test          # unitarias (Vitest)
    npm run test:db   # RLS y funciones (pgTAP); necesita el stack de Supabase corriendo
    npm run test:e2e  # flujo completo (Playwright); levanta el dev server solo y necesita el stack de Supabase corriendo

## Estado

- Sub-proyecto 1 (auth, negocios, roles, empleados): listo.
- Sub-proyecto 2a (servicios, recursos, horarios, bloqueos, reglas de reserva, "Primeros pasos"): listo. Plan en `docs/superpowers/plans/2026-10-08-servicios-recursos-horarios.md`.
- Sub-proyecto 2b (clientes, turnos, disponibilidad, agenda): listo. Plan en `docs/superpowers/plans/2026-10-08-clientes-turnos-agenda.md`.
- Sub-proyecto 2c (página pública `/b/[slug]`, confirmación del dueño, dispositivos confiables, límites anti-spam, WhatsApp del negocio): listo. Plan en `docs/superpowers/plans/2026-10-10-reserva-publica.md`.
- Clientes: alta manual y detalle editable por turno en la ficha.
- Sub-proyectos 3 y 4 (Mi negocio con marca y logo; productos, stock, ventas y catálogo público): listos. Plan en `docs/superpowers/plans/2026-10-11-negocio-productos.md`.
- Pendiente: sub-proyecto 5 (Inicio completo y Métricas).

## Pendientes antes de lanzar al público

- Verificación de email: hoy el registro crea la cuenta ya confirmada (`email_confirm: true`), decisión del plan para el sub-proyecto 1.
- Recuperación de contraseña.
- Límite de intentos de login propio.
- Registro público de Supabase: en el proyecto hospedado, desactivar "Allow new users to sign up" en Auth (Settings). La app crea todas las cuentas con `admin.createUser`, que funciona igual con el registro cerrado. En local ya está desactivado con `[auth] enable_signup = false` en `supabase/config.toml`; no tocar `[auth.email] enable_signup`, porque en false deshabilita también el login con email y contraseña.
