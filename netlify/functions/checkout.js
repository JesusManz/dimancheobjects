const stripe       = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getStore } = require('@netlify/blobs');
const fs           = require('fs');
const path         = require('path');

const TOPE_NACIONAL                     = 25;
const TOPE_INTERNACIONAL                = 50;
const FACTOR_ACUMULACION               = 1.1;
const MINIMO_ENVIO_GRATIS_NACIONAL      = 150;
const MINIMO_ENVIO_GRATIS_INTERNACIONAL = 300;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Petición inválida' }) }; }

  const { ids = [], merch = [], zona } = body;

  if (!Array.isArray(ids) || !Array.isArray(merch) ||
      (ids.length === 0 && merch.length === 0) ||
      !['nacional', 'internacional'].includes(zona)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Datos incorrectos' }) };
  }

  // ── Stores ────────────────────────────────────────────────────────────────
  const stockStore = getStore({
    name:   'stock',
    siteID: process.env.NETLIFY_SITE_ID,
    token:  process.env.NETLIFY_TOKEN
  });

  const reservasStore = getStore({
    name:   'reservas',
    siteID: process.env.NETLIFY_SITE_ID,
    token:  process.env.NETLIFY_TOKEN
  });

  // ── Catálogo de objetos únicos ─────────────────────────────────────────────
  const stockBlobs = await stockStore.get('productos').catch(() => null);
  const catalogo   = stockBlobs
    ? JSON.parse(stockBlobs)
    : JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/productos.json'), 'utf8'));

  // ── Catálogo de merch (con stock actualizado) ──────────────────────────────
  const merchBlobs   = await stockStore.get('merch').catch(() => null);
  const catalogoMerch = merchBlobs
    ? JSON.parse(merchBlobs)
    : JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/merch.json'), 'utf8'));

  // ── Validar objetos únicos ─────────────────────────────────────────────────
  const productosUnicos = [];
  for (const id of ids) {
    const p = catalogo.find(p => p.id === id);
    if (!p) {
      return { statusCode: 400, body: JSON.stringify({ error: `Producto ${id} no encontrado, es posible que ya se haya vendido.` }) };
    }
    const reservado = await reservasStore.get(id).catch(() => null);
    if (reservado) {
      return { statusCode: 409, body: JSON.stringify({ error: `"${p.nombre}" ya no está disponible` }) };
    }
    productosUnicos.push(p);
  }

  // ── Validar merch ─────────────────────────────────────────────────────────
  // merch es array de { id, talla, cantidad }
  const productosMerch = [];
  for (const item of merch) {
    const p = catalogoMerch.find(p => p.id === item.id);
    if (!p) {
      return { statusCode: 400, body: JSON.stringify({ error: `Producto de merch ${item.id} no encontrado.` }) };
    }
    const stockTalla = p.tallas[item.talla] ?? 0;
    if (stockTalla < item.cantidad) {
      return {
        statusCode: 409,
        body: JSON.stringify({
          error: `Solo quedan ${stockTalla} unidades de "${p.nombre}" en talla ${item.talla}.`
        })
      };
    }
    productosMerch.push({ ...p, talla: item.talla, cantidad: item.cantidad });
  }

  // ── Reservar objetos únicos (bloqueo temporal 30 min) ─────────────────────
  for (const p of productosUnicos) {
    await reservasStore.set(p.id, 'reservado');
  }

  // ── Calcular envío ────────────────────────────────────────────────────────
  const campo        = zona === 'internacional' ? 'internacional' : 'nacional';
  const tope         = zona === 'internacional' ? TOPE_INTERNACIONAL : TOPE_NACIONAL;
  const minimoGratis = zona === 'internacional'
    ? MINIMO_ENVIO_GRATIS_INTERNACIONAL
    : MINIMO_ENVIO_GRATIS_NACIONAL;

  // Expandir merch por cantidad para el cálculo de envío acumulado
  const todosParaEnvio = [
    ...productosUnicos,
    ...productosMerch.flatMap(p => Array(p.cantidad).fill(p))
  ];

  const subtotal = [
    ...productosUnicos.map(p => p.precio_descuento ?? p.precio),
    ...productosMerch.map(p => (p.precio_descuento ?? p.precio) * p.cantidad)
  ].reduce((a, b) => a + b, 0);

  const sumaEnvio = todosParaEnvio.reduce((acc, p) => acc + (p.envio[campo] ?? 0), 0);
  const envio     = subtotal >= minimoGratis ? 0 : (todosParaEnvio.length > 1
    ? Math.min(Math.round(sumaEnvio / FACTOR_ACUMULACION), tope)
    : Math.min(sumaEnvio, tope));

  // ── Line items de Stripe ──────────────────────────────────────────────────
  const lineItems = [
    ...productosUnicos.map(p => ({
      price_data: {
        currency:     'eur',
        unit_amount:  Math.round((p.precio_descuento ?? p.precio) * 100),
        product_data: { name: p.nombre }
      },
      quantity: 1
    })),
    ...productosMerch.map(p => ({
      price_data: {
        currency:     'eur',
        unit_amount:  Math.round((p.precio_descuento ?? p.precio) * 100),
        product_data: { name: `${p.nombre} — Talla ${p.talla}` }
      },
      quantity: p.cantidad
    }))
  ];

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

  // ── Crear sesión ──────────────────────────────────────────────────────────
  const session = await stripe.checkout.sessions.create({
    payment_method_types:  ['card'],
    line_items:            lineItems,
    mode:                  'payment',
    allow_promotion_codes: true,
    phone_number_collection: { enabled: true },
    shipping_address_collection: {
      allowed_countries: ['ES', 'FR', 'DE', 'IT', 'PT', 'NL', 'BE', 'AT', 'PL']
    },
    success_url: 'https://dimancheobjects.com/gracias',
    cancel_url:  'https://dimancheobjects.com/tienda',
    expires_at:  Math.floor(Date.now() / 1000) + (30 * 60),
    metadata:    {
      ids:   JSON.stringify(ids),
      merch: JSON.stringify(merch),  // [{ id, talla, cantidad }]
      zona
    }
  });

  return {
    statusCode: 200,
    headers:    { 'Content-Type': 'application/json' },
    body:       JSON.stringify({ url: session.url })
  };
};
