// lib/negocio.js
// Por ahora el sistema es mono-negocio por instancia: cada deploy en
// Vercel atiende a un solo negocio, identificado por la variable de
// entorno NEGOCIO_SLUG. El día que haya varios negocios en la misma
// base de datos, este es el único lugar que hay que tocar para resolver
// el negocio por subdominio o dominio en lugar de por variable de entorno.
"use strict";
const { queryOne } = require("./db");

let cached = null;
let cachedAt = 0;
const TTL_MS = 60 * 1000;

async function getNegocio() {
  const slug = process.env.NEGOCIO_SLUG;
  if (!slug) {
    throw new Error("Falta configurar la variable de entorno NEGOCIO_SLUG (ej: 'miriam').");
  }
  const now = Date.now();
  if (cached && cached.slug === slug && now - cachedAt < TTL_MS) {
    return cached;
  }
  const negocio = await queryOne(
    "select id, slug, nombre, whatsapp, activo from negocios where slug = $1",
    [slug]
  );
  if (!negocio) {
    throw new Error(
      "No existe ningún negocio con slug '" + slug + "'. Revisá la tabla 'negocios' y la variable NEGOCIO_SLUG."
    );
  }
  cached = negocio;
  cachedAt = now;
  return negocio;
}

module.exports = { getNegocio };
