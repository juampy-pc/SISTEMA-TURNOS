// api/turnos/index.js — GET /api/turnos, POST /api/turnos
"use strict";
const { query, queryOne } = require("../../lib/db");
const { getNegocio } = require("../../lib/negocio");
const { requireAuth } = require("../../lib/auth");

module.exports = async function handler(req, res) {
  const negocio = await getNegocio();

  if (req.method === "GET") {
    const user = requireAuth(req, res);
    if (!user) return;
    try {
      const rows = user.rol === "admin"
        ? await query("select * from turnos where negocio_id = $1 order by fecha, hora", [negocio.id])
        : await query("select * from turnos where negocio_id = $1 and cliente_id = $2 order by fecha, hora", [negocio.id, user.id]);
      res.status(200).json({ turnos: rows });
    } catch (err) {
      console.error("Error en GET /api/turnos:", err);
      res.status(500).json({ error: "Error del servidor." });
    }
    return;
  }

  if (req.method === "POST") {
    const user = requireAuth(req, res);
    if (!user) return;
    try {
      const body = req.body || {};
      const servicio = body.servicio;
      const fecha = body.fecha;
      const hora = body.hora;
      if (!servicio || !fecha || !hora) {
        res.status(400).json({ error: "Faltan datos del turno." });
        return;
      }
      // Un cliente solo puede crear turnos para sí mismo. Un admin puede
      // asignarlo a un cliente con cuenta (clienteId) o a un nombre suelto
      // (clienteNombre), para turnos cargados a mano sin cuenta online.
      const clienteId = user.rol === "admin" ? (body.clienteId || null) : user.id;
      const clienteNombre = user.rol === "admin" ? (body.clienteNombre || null) : null;

      const turno = await queryOne(
        "insert into turnos (negocio_id, cliente_id, cliente_nombre, servicio, fecha, hora, estado, notas) " +
          "values ($1,$2,$3,$4,$5,$6,'pendiente',$7) returning *",
        [negocio.id, clienteId, clienteNombre, servicio, fecha, hora, body.notas || null]
      );
      res.status(200).json({ turno: turno });
    } catch (err) {
      console.error("Error en POST /api/turnos:", err);
      res.status(500).json({ error: "Error del servidor." });
    }
    return;
  }

  res.status(405).json({ error: "Método no permitido." });
};
