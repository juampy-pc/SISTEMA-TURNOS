// api/productos/index.js — GET /api/productos, POST /api/productos
"use strict";
const { query, queryOne } = require("../../lib/db");
const { getNegocio } = require("../../lib/negocio");
const { requireAuth, requireAdmin } = require("../../lib/auth");

module.exports = async function handler(req, res) {
  const negocio = await getNegocio();

  if (req.method === "GET") {
    const user = requireAuth(req, res);
    if (!user) return;
    try {
      // A los clientes nunca se les expone el costo del producto, solo al admin.
      const rows = user.rol === "admin"
        ? await query("select * from productos where negocio_id = $1 order by nombre", [negocio.id])
        : await query(
            "select id, nombre, categoria, precio, descripcion, stock, activo from productos where negocio_id = $1 and activo = true order by nombre",
            [negocio.id]
          );
      res.status(200).json({ productos: rows });
    } catch (err) {
      console.error("Error en GET /api/productos:", err);
      res.status(500).json({ error: "Error del servidor." });
    }
    return;
  }

  if (req.method === "POST") {
    const user = requireAdmin(req, res);
    if (!user) return;
    try {
      const body = req.body || {};
      if (!body.nombre) {
        res.status(400).json({ error: "Falta el nombre del producto." });
        return;
      }
      const producto = await queryOne(
        "insert into productos (negocio_id, nombre, categoria, precio, costo, stock, descripcion, activo) " +
          "values ($1,$2,$3,$4,$5,$6,$7,true) returning *",
        [negocio.id, body.nombre, body.categoria || null, Number(body.precio) || 0, Number(body.costo) || 0, Number(body.stock) || 0, body.descripcion || null]
      );
      res.status(200).json({ producto: producto });
    } catch (err) {
      console.error("Error en POST /api/productos:", err);
      res.status(500).json({ error: "Error del servidor." });
    }
    return;
  }

  res.status(405).json({ error: "Método no permitido." });
};
