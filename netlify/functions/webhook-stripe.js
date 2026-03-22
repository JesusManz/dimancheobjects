const stripe       = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getStore } = require('@netlify/blobs');
const fs           = require('fs');
const path         = require('path');

exports.handler = async (event) => {
  const sig    = event.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, secret);
  } catch (err) {
    return { statusCode: 400, body: `Webhook error: ${err.message}` };
  }

  const reservasStore = getStore({
    name:   'reservas',
    siteID: process.env.NETLIFY_SITE_ID,
    token:  process.env.NETLIFY_TOKEN
  });

  const stockStore = getStore({
    name:   'stock',
    siteID: process.env.NETLIFY_SITE_ID,
    token:  process.env.NETLIFY_TOKEN
  });

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const ids     = JSON.parse(session.metadata.ids);

    const stockBlobs   = await stockStore.get('productos').catch(() => null);
    const vendidosBlobs = await stockStore.get('productos-vendidos').catch(() => null);

    const catalogo = stockBlobs
      ? JSON.parse(stockBlobs)
      : JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/productos.json'), 'utf8'));

    const vendidos = vendidosBlobs
      ? JSON.parse(vendidosBlobs)
      : JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/productos-vendidos.json'), 'utf8'));

    const idsSet         = new Set(ids);
    const nuevoStock     = catalogo.filter(p => !idsSet.has(p.id));
    const nuevosVendidos = [
      ...vendidos,
      ...catalogo.filter(p => idsSet.has(p.id)).map(p => ({ ...p, reservado: false }))
    ];

    await Promise.all([
      stockStore.set('productos',          JSON.stringify(nuevoStock)),
      stockStore.set('productos-vendidos', JSON.stringify(nuevosVendidos)),
      ...ids.map(id => reservasStore.delete(id).catch(() => {}))
    ]);
  }

  if (stripeEvent.type === 'checkout.session.expired' ||
      stripeEvent.type === 'payment_intent.payment_failed') {
    const session = stripeEvent.data.object;
    const ids     = JSON.parse(session.metadata?.ids || '[]');
    await Promise.all(ids.map(id => reservasStore.delete(id).catch(() => {})));
  }

  return { statusCode: 200, body: 'ok' };
};