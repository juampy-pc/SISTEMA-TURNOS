// api/auth/registro.js — POST /api/auth/registro
"use strict";
const { queryOne } = require("../../lib/db");
const { getNegocio } = require("../../lib/negocio");
const { hashPassword, signSession, setSessionCookie } = require("../../lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido." });
    return;
  }
  try {
    const negocio = await getNegocio();
    const body = req.body || {};
    const nombre = (body.nombre || "").trim();
    const telefono = (body.telefono || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!nombre || !email || !password) {
      res.status(400).json({ error: "Faltan datos obligatorios." });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres." });
      return;
    }

    const existente = await queryOne(
      "select id from usuarios where negocio_id = $1 and email = $2",
      [negocio.id, email]
    );
    if (existente) {
      res.status(409).json({ error: "Ya existe una cuenta con ese email." });
      return;
    }

    const passwordHash = await hashPassword(password);
    const usuario = await queryOne(
      "insert into usuarios (negocio_id, rol, nombre, telefono, email, password_hash) " +
        "values ($1, 'cliente', $2, $3, $4, $5) returning id, rol, nombre, telefono, email",
      [negocio.id, nombre, telefono || null, email, passwordHash]
    );

    const token = signSession({ id: usuario.id, negocioId: negocio.id, rol: "cliente" });
    setSessionCookie(req, res, token);
    res.status(200).json({ usuario: usuario });
  } catch (err) {
    console.error("Error en /api/auth/registro:", err);
    res.status(500).json({ error: "Error del servidor." });
  }
};
