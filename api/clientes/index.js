// api/clientes/index.js — GET /api/clientes
"use strict";
const { query } = require("../../lib/db");
const { getNegocio } = require("../../lib/negocio");
const { requireAdmin } = require("../../lib/auth");

module.exports = async function handler(req, res) {
  const negocio = await getNegocio();
  const user = requireAdmin(req, res);
  if (!user) return;

  if (req.method === "GET") {
    try {
      const rows = await query(
        "select id, nombre, telefono, email from usuarios where negocio_id = $1 and rol = 'cliente' order by nombre",
        [negocio.id]
      );
      res.status(200).json({ clientes: rows });
    } catch (err) {
      console.error("Error en GET /api/clientes:", err);
      res.status(500).json({ error: "Error del servidor." });
    }
    return;
  }

  res.status(405).json({ error: "Método no permitido." });
};
