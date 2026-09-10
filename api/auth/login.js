// api/auth/login.js — POST /api/auth/login
"use strict";
const { queryOne } = require("../../lib/db");
const { getNegocio } = require("../../lib/negocio");
const { verifyPassword, signSession, setSessionCookie } = require("../../lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido." });
    return;
  }
  try {
    const negocio = await getNegocio();
    const body = req.body || {};
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!email || !password) {
      res.status(400).json({ error: "Faltan datos." });
      return;
    }

    const usuario = await queryOne(
      "select id, rol, nombre, telefono, email, password_hash from usuarios where negocio_id = $1 and email = $2",
      [negocio.id, email]
    );
    if (!usuario) {
      res.status(401).json({ error: "Email o contraseña incorrectos." });
      return;
    }
    const ok = await verifyPassword(password, usuario.password_hash);
    if (!ok) {
      res.status(401).json({ error: "Email o contraseña incorrectos." });
      return;
    }

    const token = signSession({ id: usuario.id, negocioId: negocio.id, rol: usuario.rol });
    setSessionCookie(req, res, token);
    res.status(200).json({
      usuario: { id: usuario.id, rol: usuario.rol, nombre: usuario.nombre, telefono: usuario.telefono, email: usuario.email }
    });
  } catch (err) {
    console.error("Error en /api/auth/login:", err);
    res.status(500).json({ error: "Error del servidor." });
  }
};
