// api/auth/logout.js — POST /api/auth/logout
"use strict";
const { clearSessionCookie } = require("../../lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido." });
    return;
  }
  clearSessionCookie(req, res);
  res.status(200).json({ ok: true });
};
