// api/turnos/[id].js — PATCH /api/turnos/:id
"use strict";
const { queryOne } = require("../../lib/db");
const { getNegocio } = require("../../lib/negocio");
const { requireAdmin } = require("../../lib/auth");

var CAMPOS_EDITABLES = { fecha: "fecha", hora: "hora", servicio: "servicio", estado: "estado", notas: "notas" };

module.exports = async function handler(req, res) {
  const negocio = await getNegocio();
  const user = requireAdmin(req, res);
  if (!user) return;

  const id = req.query.id;

  if (req.method === "PATCH") {
    try {
      const body = req.body || {};
      var sets = [];
      var values = [];
      var idx = 1;
      Object.keys(CAMPOS_EDITABLES).forEach(function (key) {
        if (Object.prototype.hasOwnProperty.call(body, key)) {
          sets.push(CAMPOS_EDITABLES[key] + " = $" + idx);
          values.push(body[key]);
          idx++;
        }
      });
      if (!sets.length) {
        res.status(400).json({ error: "No se envió ningún dato para actualizar." });
        return;
      }
      values.push(negocio.id, id);
      var sql = "update turnos set " + sets.join(", ") + " where negocio_id = $" + idx + " and id = $" + (idx + 1) + " returning *";
      const turno = await queryOne(sql, values);
      if (!turno) {
        res.status(404).json({ error: "Turno no encontrado." });
        return;
      }
      res.status(200).json({ turno: turno });
    } catch (err) {
      console.error("Error en PATCH /api/turnos/[id]:", err);
      res.status(500).json({ error: "Error del servidor." });
    }
    return;
  }

  res.status(405).json({ error: "Método no permitido." });
};
