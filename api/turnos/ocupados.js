// api/turnos/ocupados.js — GET /api/turnos/ocupados?fecha=YYYY-MM-DD
"use strict";
const { query } = require("../../lib/db");
const { getNegocio } = require("../../lib/negocio");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Método no permitido." });
    return;
  }
  try {
    const negocio = await getNegocio();
    const fecha = (req.query || {}).fecha;
    if (!fecha) {
      res.status(400).json({ error: "Falta la fecha." });
      return;
    }
    const rows = await query(
      "select hora from turnos where negocio_id = $1 and fecha = $2 and estado != 'cancelado'",
      [negocio.id, fecha]
    );
    res.status(200).json({ horas: rows.map(function (r) { return r.hora; }) });
  } catch (err) {
    console.error("Error en GET /api/turnos/ocupados:", err);
    res.status(500).json({ error: "Error del servidor." });
  }
};
