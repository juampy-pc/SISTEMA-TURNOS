// api/auth/[action].js
// Unifica registro, login, logout y me en un solo archivo (una sola
// función serverless) para no pasarnos del límite de 12 funciones del
// plan gratis de Vercel. Cada acción se distingue por la URL:
//   POST /api/auth/registro
//   POST /api/auth/login
//   POST /api/auth/logout
//   GET  /api/auth/me
"use strict";
const { queryOne } = require("../../lib/db");
const { getNegocio } = require("../../lib/negocio");
const {
  hashPassword,
  verifyPassword,
  signSession,
  getSessionUser,
  setSessionCookie,
  clearSessionCookie
} = require("../../lib/auth");

module.exports = async function handler(req, res) {
  const action = req.query.action;

  if (action === "registro" && req.method === "POST") return registro(req, res);
  if (action === "login" && req.method === "POST") return login(req, res);
  if (action === "logout" && req.method === "POST") return logout(req, res);
  if (action === "me" && req.method === "GET") return me(req, res);

  res.status(404).json({ error: "No encontrado." });
};

async function registro(req, res) {
  try {
    const negocio = await getNegocio();
    const body = req.body || {};
    const nombre = (body.nombre || "").trim();
    const telefono = (body.telefono || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!nombre || !email || !password || !telefono) {
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
}

async function login(req, res) {
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
}

async function logout(req, res) {
  clearSessionCookie(req, res);
  res.status(200).json({ ok: true });
}

async function me(req, res) {
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
}
