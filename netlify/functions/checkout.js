const stripe       = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getStore } = require('@netlify/blobs');
const fs           = require('fs');
const path         = require('path');

const TOPE_NACIONAL                     = 25;
const TOPE_INTERNACIONAL                = 50;
const FACTOR_ACUMULACION               = 1.3;
const MINIMO_ENVIO_GRATIS_NACIONAL      = 150;
const MINIMO_ENVIO_GRATIS_INTERNACIONAL = 300;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Petición inválida' }) }; }

  const { ids, zona } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0 ||
      !['nacional', 'internacional'].includes(zona)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Datos incorrectos' }) };
  }

  const stockStore = getStore({
    name:   'stock',
    siteID: process.env.NETLIFY_SITE_ID,
    token:  process.env.NETLIFY_TOKEN
  });

  const stockBlobs = await stockStore.get('productos').catch(() => null);
  const catalogo   = stockBlobs
    ? JSON.parse(stockBlobs)
    : JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/productos.json'), 'utf8'));

  const reservasStore = getStore({
    name:   'reservas',
    siteID: process.env.NETLIFY_SITE_ID,
    token:  process.env.NETLIFY_TOKEN
  });

  const productos = [];
  for (const id of ids) {
    const p = catalogo.find(p => p.id === id);
    if (!p) {
      return { statusCode: 400, body: JSON.stringify({ error: `Producto ${id} no encontrado` }) };
    }
    const reservado = await reservasStore.get(id).catch(() => null);
    if (reservado) {
      return { statusCode: 409, body: JSON.stringify({ error: `"${p.nombre}" ya no está disponible` }) };
    }
    productos.push(p);
  }

  for (const p of productos) {
    await reservasStore.set(p.id, 'reservado');
  }

  const campo        = zona === 'internacional' ? 'internacional' : 'nacional';
  const tope         = zona === 'internacional' ? TOPE_INTERNACIONAL : TOPE_NACIONAL;
  const minimoGratis = zona === 'internacional'
    ? MINIMO_ENVIO_GRATIS_INTERNACIONAL
    : MINIMO_ENVIO_GRATIS_NACIONAL;

  const subtotal = productos.reduce((acc, p) => acc + (p.precio_descuento ?? p.precio), 0);
  const suma     = productos.reduce((acc, p) => acc + p.envio[campo], 0);
  const envio    = subtotal >= minimoGratis ? 0 : (productos.length > 1
    ? Math.min(Math.round(suma / FACTOR_ACUMULACION), tope)
    : Math.min(suma, tope));

  const lineItems = productos.map(p => ({
    price_data: {
      currency:     'eur',
      unit_amount:  Math.round((p.precio_descuento ?? p.precio) * 100),
      product_data: { name: p.nombre }
    },
    quantity: 1
  }));

  if (envio > 0) {
    lineItems.push({
      price_data: {
        currency:     'eur',
        unit_amount:  envio * 100,
        product_data: { name: `Envío ${zona === 'nacional' ? 'España peninsular' : 'Europa / Internacional'}` }
      },
      quantity: 1
    });
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types:  ['card'],
    line_items:            lineItems,
    mode:                  'payment',
    allow_promotion_codes: true,
    shipping_address_collection: {
      allowed_countries: ['ES', 'FR', 'DE', 'IT', 'PT', 'NL', 'BE', 'AT', 'PL']
    },
    success_url: 'https://dimancheobjects.com/gracias',
    cancel_url:  'https://dimancheobjects.com/tienda',
    expires_at:  Math.floor(Date.now() / 1000) + (30 * 60),
    metadata:    { ids: JSON.stringify(ids), zona }
  });

  return {
    statusCode: 200,
    headers:    { 'Content-Type': 'application/json' },
    body:       JSON.stringify({ url: session.url })
  };
};