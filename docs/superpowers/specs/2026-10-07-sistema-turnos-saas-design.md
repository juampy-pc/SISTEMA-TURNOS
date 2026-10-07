# Sistema de Turnos SaaS — Diseño

Fecha: 2026-10-07 · Rama: `rewrite-saas` · Estado: pendiente de revisión

## 1. Objetivo

Plataforma web multi-tenant para que negocios con turnos gestionen todo en un solo lugar: agenda, clientes, servicios, productos y métricas. Primero web, luego app (PWA o Expo). Rubros iniciales: canchas de fútbol, peluquerías/barberías y estéticas.

**Principio rector:** el sistema centraliza la gestión del negocio, no automatiza todo. Cada tarea frecuente debe resolverse en pocos toques, desde el celular y con valores precargados; lo opcional es opcional. Si la carga manual es engorrosa, el dueño no percibe el valor.

**Fuera de alcance de la v1:** pagos online, API oficial de WhatsApp, caja completa (gastos, métodos de pago, cierres), cuenta obligatoria de clientes, dominios propios.

## 2. Stack y decisiones

- Next.js (App Router) desplegado en Vercel; Supabase (Postgres, Auth, Storage).
- Multi-tenancy: una sola base, `negocio_id` en cada tabla, aislamiento con RLS.
- Se reescribe desde cero (el código HTML/JS anterior queda en `main`). Trabajo en la rama `rewrite-saas`; Vercel genera previews sin tocar producción.
- URL pública: `/b/[slug]`.

## 3. Adaptación por rubro

No hay lógica separada por rubro en el código. Todo sale de una configuración por negocio:

- `tipo` (cancha, peluquería/barbería, estética): carga una **plantilla** con vocabulario ("cancha"/"profesional", "reserva"/"turno"), servicios, horarios y recursos de ejemplo, y tips de uso.
- Preguntas de onboarding: `vende_productos` (muestra u oculta Catálogo/Stock, activable luego) y `modo_turnos` (`fijo`: grilla predefinida; `editable`: duración según servicio).
- Checklist de primeros pasos en el Inicio y tips contextuales por pantalla, según la configuración.
- Agregar un rubro nuevo = agregar una plantilla.

## 4. Modelo de datos

Todas las tablas llevan `negocio_id`; RLS garantiza que cada usuario solo accede a su negocio.

**Negocio y accesos**
- `negocios`: slug, nombre, tipo, zona horaria, contacto, marca (logo, color, tipografía, descripción), flags de onboarding.
- `roles`: nombre y JSON de permisos (ver ingresos, editar catálogo, ver agendas ajenas, gestionar clientes, etc.). Se crean tres por defecto: Dueño, Recepción/Encargado, Profesional.
- `miembros`: persona con acceso al panel (nombre, usuario, rol, activo), vinculada a Supabase Auth.

**Turnos**
- `recursos`: canchas, barberos, sillones; opcionalmente vinculados a un `miembro`.
- `horarios`: franjas por recurso y día de semana. `bloqueos`: excepciones (feriados, vacaciones).
- `servicios`: nombre, duración, precio. `recurso_servicio`: qué recurso hace qué servicio.
- `turnos`: recurso, servicio, cliente, inicio/fin, estado (`pendiente`, `confirmado`, `completado`, `cancelado`, `no_vino`), notas, monto cobrado. Una restricción de exclusión sobre el rango de tiempo por recurso (estados activos) impide solapamientos aun con reservas simultáneas.

**Clientes**
- `clientes`: nombre, teléfono normalizado E.164, notas. Índice único (`negocio_id`, teléfono). Un número en dos negocios son dos clientes distintos.
- `dispositivos_confiables`: hash de token asociado a un cliente confirmado.

**Productos**
- `productos`: nombre, descripción (CHECK ≤ 500 caracteres), precio, costo, una foto, stock.
- `ventas`: producto, cantidad, monto, fecha; cliente y turno opcionales. Registrar una venta descuenta stock en la misma transacción.

Las métricas se calculan con consultas sobre `turnos` y `ventas`.

## 5. Empleados y permisos

- Solo el dueño ve la sección Empleados: crea usuarios con nombre, usuario y contraseña; puede resetear o desactivar.
- Los empleados entran con usuario y contraseña (sin email; internamente se les asigna un identificador). El dueño entra con email.
- Cada empleado tiene un rol; el dueño edita los permisos con interruptores simples.
- Los permisos se aplican en la base (RLS), no solo ocultando botones.
- Roles por defecto: **Dueño** (todo), **Recepción** (turnos, clientes, cobros, ventas; sin ingresos ni métricas), **Profesional** (su propia agenda y marcar cobrado).

## 6. Estructura de la app y flujos

**Acceso (`/registro`, `/login`)**: onboarding en pasos cortos: (1) cuenta, (2) negocio: nombre, tipo, slug con verificación, (3) preguntas de configuración, (4) recursos precargados editables. Al finalizar, una sola transacción crea negocio, roles, miembro dueño y datos de plantilla.

**Panel (`/panel/*`)**, menú según permisos y flags:
- **Inicio**: turnos de hoy con acciones directas (confirmar, cobrar, cancelar, no vino), pendientes por confirmar, 3-4 indicadores clave, checklist de primeros pasos.
- **Turnos**: agenda por día y recurso, alta manual.
- **Clientes**: listado, ficha con historial y notas, aviso de posibles duplicados.
- **Servicios y recursos**, **Horarios**.
- **Catálogo** (ver y editar productos) y **Stock** (cambios masivos de stock y precios): solo con `vende_productos`.
- **Métricas**: solo con permiso de ver ingresos.
- **Empleados** (solo dueño), **Mi negocio** (perfil y marca de la página pública).

**Página pública (`/b/[slug]`)**: marca del negocio; en el home, pedido de turno (servicio, recurso o "cualquiera", día y horario, nombre y teléfono); sección de catálogo de solo lectura si vende productos.

**Registro de ingresos y ventas (manual y mínimo):**
- Un botón "Cobrado" por turno toma el precio del servicio; el monto se edita solo si hace falta.
- Un botón "Vendí uno" por producto descuenta 1 de stock y suma el precio; cantidad y cliente son opcionales.

## 7. Reservas, confirmación y clientes

**Confirmación manual (decisión de producto):**
- Cliente nuevo o dispositivo no reconocido → turno `pendiente`. La pantalla final ofrece un botón `wa.me` para avisar al negocio; el dueño confirma desde el panel. Esa confirmación actúa como verificación del número, sin costo.
- Al confirmar un turno de un cliente nuevo se genera un token de dispositivo (cookie `httpOnly`, hash en base). Las próximas reservas desde ese dispositivo precargan datos y se confirman solas. El dueño puede revocarlo.
- Un teléfono conocido desde un dispositivo no reconocido vuelve a quedar `pendiente`.
- Las reservas admiten una nota del cliente (contexto para el negocio).
- Cuenta de cliente opcional con código por WhatsApp/SMS: v2.

**Normalización y duplicados:**
- `libphonenumber-js`, país por defecto Argentina (`011 15-4444-5555`, `+54 9 11 4444-5555` y `1144445555` → `+5491144445555`). Número inválido se rechaza con mensaje claro.
- Mismo número normalizado = mismo cliente (reutiliza ficha).
- Números parecidos (una diferencia de dígito, o mismos últimos 8 dígitos) se sugieren como "posible duplicado" en la ficha, con botón para unir (mueve turnos y ventas). Nunca se fusiona automáticamente.

**Disponibilidad:**
- Función de Postgres que calcula huecos libres por recurso y día: franjas de `horarios` menos `bloqueos` y turnos activos, cortada según el modo (paso fijo o duración del servicio).
- "Cualquiera" devuelve la unión de huecos de los recursos que hacen el servicio y asigna el primer recurso libre.
- Anticipación mínima y máxima configurables.
- La restricción de exclusión es la defensa final ante reservas simultáneas.

**Seguridad de la reserva pública:** Server Action/endpoint con permisos acotados que normaliza el teléfono, busca o crea cliente y crea el turno. Rate limiting por IP y por número frena spam masivo (no reemplaza la confirmación).

## 8. Errores

- Horario ocupado: mensaje y recarga de huecos.
- Stock insuficiente: aviso, con confirmación explícita para continuar.
- Acciones sin permiso: bloqueadas por RLS; la interfaz oculta lo que no corresponde.

## 9. Pruebas

- Unitarias: normalización de teléfonos (tabla de formatos argentinos), detección de duplicados, cálculo de huecos.
- Base de datos: RLS (aislamiento entre negocios, rol sin permiso no ve ingresos) y restricción anti-solapamiento.
- End to end: onboarding completo, reserva pública de cliente nuevo, confirmación del dueño, reserva desde dispositivo confiable.

## 10. Descomposición en sub-proyectos

Cada uno tiene su propio plan e implementación:

1. Base: auth, negocios, roles, empleados, onboarding.
2. Servicios, recursos, horarios, turnos, clientes y reserva pública.
3. Marca y página pública.
4. Catálogo, stock y ventas.
5. Inicio y Métricas.

Las canchas condicionan el modelo desde el paso 1: el recurso es la cancha y la duración suele ser fija (`modo_turnos = fijo`).
