# Open: plan para la versión funcional (v1)

Fecha: 12/10/2026. Análisis hecho sobre `main` (después del PR #6) contra el spec `docs/superpowers/specs/2026-10-07-sistema-turnos-saas-design.md`. Mira cinco perspectivas: arquitectura, experiencia de uso, riesgos, alcance y diseño visual.

**Definición de "versión funcional":** un negocio piloto real (por ejemplo, una barbería con 2 profesionales) usa Open todos los días durante 2 semanas sin volver al cuaderno ni a WhatsApp para agendar. Para eso tiene que poder:

- recibir pedidos desde su página;
- confirmarlos;
- mover o cancelar turnos;
- cobrar;
- ver cuánto facturó.

Todo desde el celular.

---

## 1. Estado actual

| Área | Estado | Notas |
|---|---|---|
| Registro, login, negocio, roles y empleados | ✅ Hecho | Faltan recuperar contraseña del dueño y confirmar el email. |
| Servicios, recursos, horarios y bloqueos | ✅ Hecho | Los bloqueos son de días completos, no de horas. |
| Agenda del día y alta manual de turnos | ✅ Hecho | Faltan mover o editar un turno, la vista de semana y las columnas por profesional. |
| Clientes: ficha, historial, duplicados y unir | ✅ Hecho | |
| Reserva pública con confirmación y dispositivo confiable | ✅ Hecho | El cliente no puede cancelar su propio turno. |
| Mi negocio (marca y logo) y página pública | ✅ Hecho | |
| Productos, stock y ventas | ✅ Hecho | |
| Identidad visual Open | ✅ Hecho | Este PR suma la agenda de hoy, el selector de días y los estados vacíos. |
| **Inicio con indicadores** (sub-proyecto 5) | 🟡 Parcial | Este PR suma "Hoy" con indicadores. |
| **Métricas** (sub-proyecto 5) | ❌ Falta | El permiso `ver_ingresos` existe, pero no hay pantalla. |
| **Profesional ve su propia agenda** | 🐞 Bug | Ver más abajo. Se arregla en este PR. |

### Bug encontrado

Según las reglas de acceso de la base de datos, un empleado con rol **Profesional** ve solo los turnos de los recursos con `recursos.miembro_id` igual a su usuario. La app no tenía ninguna pantalla para hacer ese vínculo, así que **un Profesional veía la agenda vacía**.

- **Arreglo:** en Profesionales/Canchas ahora se elige "Quién atiende".
- **Migración:** no hace falta; el permiso de la columna ya existía.

---

## 2. Qué falta, priorizado (MoSCoW)

### Must: sin esto no hay piloto

1. **Mover y editar un turno:** cambiar hora, profesional o servicio, validando huecos. Hoy hay que cancelar y crear otro, y el cliente queda duplicado en el historial.
2. **Recordatorio por WhatsApp a un toque:** botón en cada turno de mañana que abre `wa.me` con el mensaje armado. Sin API, sin costo.
3. **El cliente cancela su turno:** link firmado en la pantalla final y en el mensaje de WhatsApp.
4. **Métricas básicas:**
   - ingresos del día, la semana y el mes (turnos cobrados más ventas);
   - turnos por estado;
   - tasa de "no vino";
   - servicios más pedidos;
   - solo con `ver_ingresos`.
5. **Recuperar contraseña del dueño:** flujo de Supabase Auth con email.
6. **Producción:**
   - rotar la contraseña de la base y el token de Vercel que quedaron expuestos;
   - activar backups;
   - configurar el SMTP propio de Supabase (el gratuito limita los emails por hora).

### Should: en las 2 semanas del piloto

7. **Vista semana en la agenda** y filtro por profesional.
8. **Bloqueos por horas**, por ejemplo "hoy de 13 a 15 no atiendo".
9. **Página pública:** mostrar el precio y la duración en cada servicio. La seña y el pago quedan para v2.
10. **PWA:** `manifest` e ícono para "Agregar a pantalla de inicio".
11. **Avisos en el panel** cuando entra un pedido nuevo (refresco o Realtime).

### Could: después del piloto

12. Exportar clientes y ventas a CSV.
13. Más rubros: consultorio y estética (son plantillas nuevas).
14. Retícula de relojes en la portada pública (elemento gráfico de la marca).

### Won't en v1

Quedan afuera:

- pagos online y señas con Mercado Pago;
- API oficial de WhatsApp;
- caja completa;
- cuentas de clientes;
- dominios propios;
- app nativa.

---

## 3. Riesgos

| Riesgo | Severidad | Mitigación |
|---|---|---|
| Migraciones aplicadas a mano en el SQL Editor | Alta | Seguir el protocolo: "Copy raw file", `notify pgrst`, ⚠️ en cada PR. A futuro, `supabase db push` desde CI. |
| Secretos expuestos en chats anteriores | Alta | Rotar la contraseña de la base y revocar el token de Vercel **antes del piloto**. |
| Sin backups ni monitoreo | Media | Activar los backups de Supabase y los logs de Vercel, y conectar un servicio de alertas cuando haya clientes que paguen. |
| Spam en la página pública | Media | El rate limit por IP y por teléfono ya existe, y la confirmación manual frena el resto. |
| Doble reserva | Baja | La restricción de exclusión en Postgres lo impide aunque las reservas lleguen al mismo tiempo. |
| Zona horaria | Baja | Todo se calcula con `negocios.zona_horaria`. Revisarlo si entra un negocio fuera de AR. |

---

## 4. Secuencia de PRs

Cada PR es chico y se puede mergear solo. El ⚠️ indica que necesita migración.

| # | PR | Migración | Listo cuando… |
|---|---|---|---|
| 7 | **Este PR:** pulido visual, "Hoy" en Inicio, selector de días y vínculo Profesional ↔ recurso | No | Un Profesional ve sus turnos; el Inicio muestra los turnos de hoy y los indicadores. |
| 8 | Mover y editar turno | ⚠️ Sí (función `mover_turno`) | Mover un turno a un hueco libre en ≤ 3 toques; en un hueco ocupado, avisa. |
| 9 | Recordatorio por WhatsApp y cancelación por el cliente | ⚠️ Sí (token de cancelación) | El cliente cancela desde el link y el turno queda `cancelado`. |
| 10 | Métricas | No (consultas con RLS) | Ingresos y turnos por período, solo con `ver_ingresos`. |
| 11 | Recuperar contraseña y ajustes de producción | No | El dueño recupera el acceso por email. |
| 12 | Vista semana y bloqueos por horas | ⚠️ Sí | |
| 13 | PWA y avisos de pedidos nuevos | No | |

**Piloto:** arranca después del PR 11.

**Qué medir en el piloto:**

- % de turnos que llegan desde la página pública;
- tiempo entre el pedido y la confirmación;
- tasa de "no vino" antes y después de los recordatorios;
- cuántos días por semana entra el dueño al panel.

---

## 5. Decisiones de producto (confirmadas el 12/10/2026)

- **Bloqueos:** por horas, con la opción de bloquear el día completo (PR 12).
- **Precio 0:** significa "a consultar"; la página pública lo muestra así.
- **Turnos manuales:** nacen confirmados.
- **Cancelación por el cliente:** se puede hasta la anticipación mínima del negocio (PR 9).
- **Estructura del panel:**
  - **Menú principal:** el trabajo del día (Inicio, Turnos, Clientes, Productos, Stock).
  - **Configuración:** todo lo que se configura, con sus secciones:
    - Mi negocio;
    - Servicios;
    - Profesionales/Canchas;
    - Horarios y bloqueos;
    - Reservas;
    - Empleados.

  Las secciones nuevas que sean configuración van ahí.
