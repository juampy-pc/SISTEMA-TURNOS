// api/auth/me.js — GET /api/auth/me
"use strict";
const { queryOne } = require("../../lib/db");
const { getSessionUser } = require("../../lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Método no permitido." });
    return;
  }
  try {
    const session = getSessionUser(req);
    if (!session) {
      res.status(200).json({ usuario: null });
      return;
    }
    const usuario = await queryOne(
      "select id, rol, nombre, telefono, email from usuarios where id = $1",
      [session.id]
    );
    res.status(200).json({ usuario: usuario });
  } catch (err) {
    console.error("Error en /api/auth/me:", err);
    res.status(500).json({ error: "Error del servidor." });
  }
};
