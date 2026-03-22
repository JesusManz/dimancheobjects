const { getStore } = require('@netlify/blobs');
const fs   = require('fs');
const path = require('path');

exports.handler = async (event) => {
  const { token } = JSON.parse(event.body || '{}');

  if (!token || token !== process.env.ADMIN_TOKEN) {
    return { statusCode: 401, body: JSON.stringify({ error: 'No autorizado' }) };
  }

  const store = getStore({
    name:   'stock',
    siteID: process.env.NETLIFY_SITE_ID,
    token:  process.env.NETLIFY_TOKEN
  });

  const productos = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'data/productos.json'), 'utf8')
  );
  const vendidos = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'data/productos-vendidos.json'), 'utf8')
  );

  await Promise.all([
    store.set('productos',          JSON.stringify(productos)),
    store.set('productos-vendidos', JSON.stringify(vendidos))
  ]);

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, productos: productos.length, vendidos: vendidos.length })
  };
};