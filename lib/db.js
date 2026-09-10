// lib/db.js
// Conexión a Postgres. En Vercel, la variable POSTGRES_URL la completa
// automáticamente el propio Vercel cuando conectás la base desde el
// dashboard (Storage → Postgres → Connect Project). En desarrollo local
// se puede usar DATABASE_URL en su lugar.
"use strict";
const { Pool, types } = require("pg");

// Por defecto, node-postgres convierte las columnas "date" en objetos Date
// de JavaScript, lo que agrega horas y zona horaria y rompe comparaciones
// de texto como "2026-09-01" >= "2026-01-01". Acá se desactiva esa
// conversión para que las fechas viajen siempre como texto plano.
types.setTypeParser(1082, function (val) { return val; });

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "Falta configurar la base de datos: no está definida la variable de entorno POSTGRES_URL (ni DATABASE_URL)."
  );
}

// Vercel Postgres requiere SSL; en desarrollo local contra un Postgres sin
// SSL, se desactiva automáticamente.
const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 5
});

async function query(text, params) {
  const result = await pool.query(text, params);
  return result.rows;
}

async function queryOne(text, params) {
  const rows = await query(text, params);
  return rows[0] || null;
}

module.exports = { pool, query, queryOne };
