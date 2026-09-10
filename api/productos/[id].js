// api/productos/[id].js — PATCH /api/productos/:id, DELETE /api/productos/:id
"use strict";
const { query, queryOne } = require("../../lib/db");
const { getNegocio } = require("../../lib/negocio");
const { requireAdmin } = require("../../lib/auth");

var CAMPOS_EDITABLES = {
  nombre: "nombre", categoria: "categoria", precio: "precio",
  costo: "costo", stock: "stock", descripcion: "descripcion", activo: "activo"
};

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
      var sql = "update productos set " + sets.join(", ") + " where negocio_id = $" + idx + " and id = $" + (idx + 1) + " returning *";
      const producto = await queryOne(sql, values);
      if (!producto) {
        res.status(404).json({ error: "Producto no encontrado." });
        return;
      }
      res.status(200).json({ producto: producto });
    } catch (err) {
      console.error("Error en PATCH /api/productos/[id]:", err);
      res.status(500).json({ error: "Error del servidor." });
    }
    return;
  }

  if (req.method === "DELETE") {
    try {
      await query("delete from productos where negocio_id = $1 and id = $2", [negocio.id, id]);
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error("Error en DELETE /api/productos/[id]:", err);
      res.status(500).json({ error: "Error del servidor." });
    }
    return;
  }

  res.status(405).json({ error: "Método no permitido." });
};
