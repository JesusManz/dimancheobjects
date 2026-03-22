const { getStore } = require('@netlify/blobs');
const fs   = require('fs');
const path = require('path');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Petición inválida' }) }; }

  const { token, id } = body;

  if (!token || token !== process.env.ADMIN_TOKEN) {
    return { statusCode: 401, body: JSON.stringify({ error: 'No autorizado' }) };
  }

  if (!id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Falta el id' }) };
  }

  const stockStore = getStore({
    name:   'stock',
    siteID: process.env.NETLIFY_SITE_ID,
    token:  process.env.NETLIFY_TOKEN
  });

const stockBlobs    = await stockStore.get('productos').catch(() => null);
const vendidosBlobs = await stockStore.get('productos-vendidos').catch(() => null);

const catalogo = stockBlobs
  ? JSON.parse(stockBlobs)
  : JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/productos.json'), 'utf8'));

const vendidos = vendidosBlobs
  ? JSON.parse(vendidosBlobs)
  : JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/productos-vendidos.json'), 'utf8'));

  const producto = catalogo.find(p => p.id === id);
  if (!producto) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Producto no encontrado' }) };
  }

  const nuevoStock     = catalogo.filter(p => p.id !== id);
  const nuevosVendidos = [...vendidos, { ...producto, reservado: false }];

  await Promise.all([
    stockStore.set('productos',          JSON.stringify(nuevoStock)),
    stockStore.set('productos-vendidos', JSON.stringify(nuevosVendidos))
  ]);

  return {
    statusCode: 200,
    headers:    { 'Content-Type': 'application/json' },
    body:       JSON.stringify({ ok: true, nombre: producto.nombre })
  };
};