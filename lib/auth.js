// lib/auth.js
"use strict";
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const COOKIE_NAME = "st_session";
const SESSION_DAYS = 30;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "Falta configurar la variable de entorno JWT_SECRET (una clave secreta larga y aleatoria para firmar las sesiones)."
    );
  }
  return secret;
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function signSession(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: SESSION_DAYS + "d" });
}

function verifySession(token) {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch (e) {
    return null;
  }
}

function parseCookies(req) {
  const header = req.headers && req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(";").forEach(function (part) {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    out[key] = decodeURIComponent(val);
  });
  return out;
}

function isLocalRequest(req) {
  const host = (req.headers && req.headers.host) || "";
  return host.indexOf("localhost") === 0 || host.indexOf("127.0.0.1") === 0;
}

function setSessionCookie(req, res, token) {
  const secureFlag = isLocalRequest(req) ? "" : " Secure;";
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  res.setHeader(
    "Set-Cookie",
    COOKIE_NAME + "=" + encodeURIComponent(token) +
      "; Path=/; HttpOnly;" + secureFlag + " SameSite=Lax; Max-Age=" + maxAge
  );
}

function clearSessionCookie(req, res) {
  const secureFlag = isLocalRequest(req) ? "" : " Secure;";
  res.setHeader(
    "Set-Cookie",
    COOKIE_NAME + "=; Path=/; HttpOnly;" + secureFlag + " SameSite=Lax; Max-Age=0"
  );
}

// Devuelve { id, negocioId, rol, nombre, email } a partir de la cookie de
// sesión, o null si no hay sesión válida. No consulta la base de datos:
// la sesión es autocontenida (JWT), así que esto es rápido y no agrega
// carga a la base en cada pedido.
function getSessionUser(req) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  return verifySession(token);
}

// Para usar al principio de un endpoint que requiere estar logueado.
// Si no hay sesión válida, responde 401 y devuelve null (el handler debe
// cortar ahí mismo, sin seguir ejecutando el resto del endpoint).
function requireAuth(req, res) {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "No autenticado." });
    return null;
  }
  return user;
}

// Igual que requireAuth, pero además exige rol de administrador.
function requireAdmin(req, res) {
  const user = requireAuth(req, res);
  if (!user) return null;
  if (user.rol !== "admin") {
    res.status(403).json({ error: "No autorizado." });
    return null;
  }
  return user;
}

module.exports = {
  hashPassword,
  verifyPassword,
  signSession,
  verifySession,
  getSessionUser,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  requireAdmin
};
