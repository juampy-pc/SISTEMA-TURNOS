# Reserva pública, confirmación y dispositivos confiables — Plan (sub-proyecto 2c)

Spec: `docs/superpowers/specs/2026-10-07-sistema-turnos-saas-design.md`, secciones 6 (página pública) y 7.

## Decisiones

- **Sin acceso directo de `anon`.** Las funciones `negocio_publico`, `huecos_publicos`, `datos_dispositivo` y `reservar_publico` solo las ejecuta `service_role`. La página y la Server Action las llaman desde el servidor con `crearClienteAdmin()`. Así la IP que se registra para el límite sale de los headers de Vercel y no la puede inventar quien llama.
- **Dispositivo = cookie `turnos_dispositivo`** (httpOnly, `path=/b`, 1 año) con un token aleatorio; la base guarda solo el SHA-256 en `dispositivos_confiables`. La fila se crea en la primera reserva (no confiable) y un trigger la marca confiable cuando el negocio pasa ese turno de `pendiente` a `confirmado`.
- **Estado del turno:** dispositivo confiable para ese cliente → `confirmado`; si no (cliente nuevo, otro dispositivo o dispositivo revocado) → `pendiente`.
- **Límites:** 20 reservas por hora por IP, 8 por día por teléfono y negocio, y hasta 3 turnos pendientes futuros por cliente. Un pedido que falla se revierte con su transacción, así que se cuentan solo las reservas creadas.
- **"Cualquiera":** se ofrece un horario si algún recurso que hace el servicio está libre; al reservar se asigna el primero libre según `orden`.
- **WhatsApp del negocio** (`negocios.whatsapp`, E.164 o vacío), editable en Configuración. Si está cargado, la pantalla final ofrece un link `wa.me` con el mensaje precargado.

## Tareas

- [x] Migración `20261010120000_reserva_publica.sql` y pgTAP `reserva_publica.test.sql` (permisos, huecos, estados, confianza, límites).
- [x] `/b/[slug]`: servicio → recurso/“cualquiera” → día → horarios; nombre, teléfono y nota; precarga desde un dispositivo confiable.
- [x] `/b/[slug]/listo`: resultado (pendiente o confirmado) y botón de WhatsApp.
- [x] Panel: pendientes de confirmar en el Inicio (confirmar o rechazar), nota del cliente en la agenda, dispositivos confiables en la ficha con opción de quitarlos, WhatsApp y link público en Configuración.
- [x] E2E `reserva-publica.spec.ts`.

## Fuera de este plan

- Marca de la página pública (logo, color, descripción): sub-proyecto 3.
- Catálogo de solo lectura en la página pública: sub-proyecto 4.
