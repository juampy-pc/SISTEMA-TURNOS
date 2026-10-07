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

## Pendientes antes de lanzar al público

- Verificación de email: hoy el registro crea la cuenta ya confirmada (`email_confirm: true`), decisión del plan para el sub-proyecto 1.
- Recuperación de contraseña.
- Límite de intentos de login propio.
