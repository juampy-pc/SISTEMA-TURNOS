// api/ventas/index.js — GET /api/ventas, POST /api/ventas
"use strict";
const { query, queryOne } = require("../../lib/db");
const { getNegocio } = require("../../lib/negocio");
const { requireAdmin } = require("../../lib/auth");

module.exports = async function handler(req, res) {
  const negocio = await getNegocio();
  const user = requireAdmin(req, res);
  if (!user) return;

  if (req.method === "GET") {
    try {
      const q = req.query || {};
      var sql = "select * from ventas where negocio_id = $1";
      var values = [negocio.id];
      if (q.desde) { values.push(q.desde); sql += " and fecha >= $" + values.length; }
      if (q.hasta) { values.push(q.hasta); sql += " and fecha <= $" + values.length; }
      sql += " order by fecha desc, created_at desc";
      const rows = await query(sql, values);
      res.status(200).json({ ventas: rows });
    } catch (err) {
      console.error("Error en GET /api/ventas:", err);
      res.status(500).json({ error: "Error del servidor." });
    }
    return;
  }

  if (req.method === "POST") {
    try {
      const body = req.body || {};
      if (!body.productoId || !body.cantidad || !body.fecha) {
        res.status(400).json({ error: "Faltan datos de la venta." });
        return;
      }
      const cantidad = Math.max(1, Number(body.cantidad));
      const producto = await queryOne("select * from productos where negocio_id = $1 and id = $2", [negocio.id, body.productoId]);
      if (!producto) {
        res.status(404).json({ error: "Producto no encontrado." });
        return;
      }
      var clienteNombre = null;
      if (body.clienteId) {
        const cliente = await queryOne("select nombre from usuarios where negocio_id = $1 and id = $2", [negocio.id, body.clienteId]);
        clienteNombre = cliente ? cliente.nombre : null;
      }
      const venta = await queryOne(
        "insert into ventas (negocio_id, producto_id, producto_nombre, cantidad, precio_unitario, costo_unitario, fecha, cliente_id, cliente_nombre) " +
          "values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *",
        [negocio.id, producto.id, producto.nombre, cantidad, producto.precio, producto.costo, body.fecha, body.clienteId || null, clienteNombre]
      );
      await query("update productos set stock = greatest(0, stock - $1) where id = $2", [cantidad, producto.id]);
      res.status(200).json({ venta: venta });
    } catch (err) {
      console.error("Error en POST /api/ventas:", err);
      res.status(500).json({ error: "Error del servidor." });
    }
    return;
  }

  res.status(405).json({ error: "Método no permitido." });
};
