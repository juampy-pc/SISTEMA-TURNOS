// api/negocio.js — GET /api/negocio
"use strict";
const { getNegocio } = require("../lib/negocio");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Método no permitido." });
    return;
  }
  try {
    const negocio = await getNegocio();
    res.status(200).json({ negocio: { nombre: negocio.nombre, whatsapp: negocio.whatsapp } });
  } catch (err) {
    console.error("Error en /api/negocio:", err);
    res.status(500).json({ error: "Error del servidor." });
  }
};
