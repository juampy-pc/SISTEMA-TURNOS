# Publicar el Sistema de Turnos con backend real (Vercel + Postgres)

Esta es una versión distinta a la que probaste antes: ya no guarda nada en el
navegador. Ahora hay una base de datos de verdad y una API real detrás, así
que hace falta un poco más de configuración la primera vez — pero después
queda funcionando solo.

Vas a necesitar una cuenta gratis en **GitHub** y en **Vercel** (si ya las
creaste para la versión anterior, son las mismas).

## Archivos del proyecto

```
index.html, admin.html, style.css      → sitio público y panel de admin
storage.js, client.js, admin.js        → lógica del frontend
api/                                    → el backend (funciones serverless)
lib/                                    → lógica compartida del backend
db/schema.sql                           → la base de datos, lista para crear
package.json, package-lock.json         → dependencias del backend
.gitignore, .env.example                → configuración del proyecto
```

Subí **todo junto** (todas las carpetas y archivos, manteniendo la
estructura de carpetas) a un repositorio nuevo en GitHub, igual que antes
pero ahora con subcarpetas incluidas.

## Paso 1 — Repositorio en GitHub

1. Creá un repositorio nuevo en GitHub (podés llamarlo `sistema-de-turnos`).
2. Subí todos los archivos y carpetas de este proyecto manteniendo la
   estructura (`api/`, `lib/`, `db/` tienen que quedar como carpetas, no
   sueltos). Si usás la opción de subir arrastrando archivos desde la web
   de GitHub, podés arrastrar las carpetas completas, GitHub respeta la
   estructura.

## Paso 2 — Crear el proyecto en Vercel

1. Entrá a https://vercel.com con tu cuenta de GitHub.
2. **Add New → Project** → elegí el repositorio recién creado → **Import**.
3. Vercel va a detectar que hay funciones en `/api` automáticamente. No
   hace falta tocar ninguna configuración de build. Tocá **Deploy**.
4. La primera vez el deploy va a fallar (todavía falta conectar la base de
   datos y las variables de entorno) — es esperable, seguí con el paso 3.

## Paso 3 — Agregar la base de datos (Vercel Postgres)

1. Dentro del proyecto en Vercel, andá a la pestaña **Storage**.
2. **Create Database → Postgres** (tiene un plan gratis, alcanza de sobra
   para empezar).
3. Cuando te pregunte, elegí **Connect** para conectarla a este proyecto.
   Esto configura automáticamente la variable `POSTGRES_URL` — no hay que
   escribirla a mano.

## Paso 4 — Crear las tablas

1. Todavía dentro de **Storage → (tu base) → Query** (el editor de SQL
   integrado de Vercel).
2. Abrí el archivo `db/schema.sql` de este proyecto, copiá **todo** el
   contenido, pegalo en el editor de Vercel y ejecutalo.
3. Esto crea todas las tablas y carga un primer negocio de ejemplo con
   slug `miriam`. Si querés otro nombre, después lo editás con:
   ```sql
   update negocios set nombre = 'Nombre real del local', whatsapp = '5493624000000'
   where slug = 'miriam';
   ```

## Paso 5 — Variables de entorno

En **Settings → Environment Variables** del proyecto en Vercel, agregá:

| Nombre | Valor |
|---|---|
| `JWT_SECRET` | Una clave larga y aleatoria (ver `.env.example` para cómo generar una) |
| `NEGOCIO_SLUG` | `miriam` (o el slug que hayas usado en el Paso 4) |

`POSTGRES_URL` no hace falta cargarla, ya la puso Vercel sola en el Paso 3.

Después de guardar las variables, andá a **Deployments** y tocá **Redeploy**
en el último deploy para que las tome.

## Paso 6 — Crear la cuenta de administrador

No hay ninguna cuenta de admin precargada — se crea así, una sola vez:

1. Entrá al sitio público ya publicado y **registrate como si fueras un
   cliente más** (con el email y contraseña que va a usar la persona que
   administre el sistema).
2. Volvé a **Storage → Query** en Vercel y ejecutá (reemplazando el email):
   ```sql
   update usuarios set rol = 'admin' where email = 'el-email-que-usaste@ejemplo.com';
   ```
3. Listo. Ahora entrando a `tu-sitio.vercel.app/admin.html` con ese email y
   esa contraseña, entra como administrador.

## Cómo se accede a cada parte

- **Sitio público**: `tu-sitio.vercel.app`
- **Panel de administración**: `tu-sitio.vercel.app/admin.html` — no tiene
  ningún link visible desde el sitio público, y ahora además pide una
  cuenta real con permiso de administrador (no cualquiera que sepa la URL
  puede entrar, a diferencia de la versión anterior).

## Qué mejoró respecto a la versión anterior

- Los datos ya no viven en el navegador de cada uno: todos ven la misma
  información real, desde cualquier dispositivo.
- Las contraseñas se guardan con hash seguro (bcrypt), no en texto plano.
- Las sesiones son cookies firmadas del lado del servidor — cerrar y abrir
  el navegador no te desloguea.
- El panel de administración exige una cuenta real, no una clave fija en
  el código.

## Qué falta para cuando haya que sumar el segundo negocio

Hoy `NEGOCIO_SLUG` fija un solo negocio por deploy. El esquema de la base
ya está preparado (cada tabla tiene `negocio_id`), así que sumar negocios
nuevos es agregar filas en la tabla `negocios` y, más adelante, resolver el
negocio por dominio en vez de por variable de entorno — no hace falta
volver a diseñar nada de esto.

## Actualizar el sistema más adelante

Cuando haya cambios de código, se suben los archivos nuevos al mismo
repositorio de GitHub y Vercel actualiza el deploy solo. Si hay cambios en
`db/schema.sql` (tablas nuevas), esos sí hay que correrlos a mano una vez
en el editor de Query de Vercel — no se aplican solos.
