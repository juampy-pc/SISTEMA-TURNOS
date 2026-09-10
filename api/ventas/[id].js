// api/ventas/[id].js — DELETE /api/ventas/:id
"use strict";
const { query, queryOne } = require("../../lib/db");
const { getNegocio } = require("../../lib/negocio");
const { requireAdmin } = require("../../lib/auth");

module.exports = async function handler(req, res) {
  const negocio = await getNegocio();
  const user = requireAdmin(req, res);
  if (!user) return;

  const id = req.query.id;

  if (req.method === "DELETE") {
    try {
      const venta = await queryOne("select * from ventas where negocio_id = $1 and id = $2", [negocio.id, id]);
      if (!venta) {
        res.status(404).json({ error: "Venta no encontrada." });
        return;
      }
      if (venta.producto_id) {
        await query("update productos set stock = stock + $1 where id = $2", [venta.cantidad, venta.producto_id]);
      }
      await query("delete from ventas where negocio_id = $1 and id = $2", [negocio.id, id]);
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error("Error en DELETE /api/ventas/[id]:", err);
      res.status(500).json({ error: "Error del servidor." });
    }
    return;
  }

  res.status(405).json({ error: "Método no permitido." });
};
