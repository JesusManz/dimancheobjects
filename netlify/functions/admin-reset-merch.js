/**
 * admin-reset-merch.js
 * Sobreescribe el blob 'merch' en Netlify Blobs con el contenido actual de merch.json.
 *
 * USO:
 *   GET  /.netlify/functions/admin-reset-merch?secret=TU_ADMIN_SECRET
 *
 * Añade ADMIN_SECRET a tus env vars en Netlify (Site > Environment variables).
 */

const { getStore } = require('@netlify/blobs');
const fs           = require('fs');
const path         = require('path');

exports.handler = async (event) => {
  // ── Protección por token ──────────────────────────────────────────────────
  const secret = event.queryStringParameters?.secret;
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return { statusCode: 401, body: JSON.stringify({ error: 'No autorizado' }) };
  }

  // ── Leer merch.json del disco ─────────────────────────────────────────────
  let merch;
  try {
    const filePath = path.join(__dirname, '../../data/merch.json');
    merch = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `No se pudo leer merch.json: ${err.message}` })
    };
  }

  // ── Guardar en el blob ────────────────────────────────────────────────────
  const stockStore = getStore({
    name:   'stock',
    siteID: process.env.NETLIFY_SITE_ID,
    token:  process.env.NETLIFY_TOKEN
  });

  await stockStore.set('merch', JSON.stringify(merch));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok:       true,
      mensaje:  `Blob 'merch' actualizado con ${merch.length} productos.`,
      productos: merch.map(p => ({
        id:     p.id,
        nombre: p.nombre,
        tallas: p.tallas
      }))
    })
  };
};