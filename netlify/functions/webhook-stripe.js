const stripe     = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getStore } = require('@netlify/blobs');
const fs           = require('fs');
const path         = require('path');
const { Resend }   = require('resend');
const resend       = new Resend(process.env.RESEND_API_KEY);

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

    const stockBlobs    = await stockStore.get('productos').catch(() => null);
    const vendidosBlobs = await stockStore.get('productos-vendidos').catch(() => null);

    const catalogo = stockBlobs
      ? JSON.parse(stockBlobs)
      : JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/productos.json'), 'utf8'));

    const vendidos = vendidosBlobs
      ? JSON.parse(vendidosBlobs)
      : JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/productos-vendidos.json'), 'utf8'));

    const idsSet             = new Set(ids);
    const nuevoStock         = catalogo.filter(p => !idsSet.has(p.id));
    const productosComprados = catalogo.filter(p => idsSet.has(p.id));
    const nuevosVendidos     = [
      ...vendidos,
      ...productosComprados.map(p => ({ ...p, reservado: false }))
    ];

    await Promise.all([
      stockStore.set('productos',          JSON.stringify(nuevoStock)),
      stockStore.set('productos-vendidos', JSON.stringify(nuevosVendidos)),
      ...ids.map(id => reservasStore.delete(id).catch(() => {}))
    ]);

    // Datos del cliente y totales
    const emailCliente  = session.customer_details?.email;
    const nombre        = session.customer_details?.name;
    const direccion     = session.collected_information?.shipping_details?.address;
    const telefono      = session.customer_details?.phone;
    const totalCobrado  = (session.amount_total / 100).toFixed(2);
    const envioTotal    = session.shipping_cost?.amount_total != null
      ? (session.shipping_cost.amount_total / 100).toFixed(2)
      : null;
    const subtotal      = envioTotal != null
      ? ((session.amount_total - session.shipping_cost.amount_total) / 100).toFixed(2)
      : null;

    // Email de confirmación al cliente
    if (emailCliente) {
      await resend.emails.send({
        from:    'Dimanche Objects <tienda@dimancheobjects.com>',
        to:      emailCliente,
        subject: '¡Tu pedido está confirmado!',
        html: `
          <div style="font-family: helvetica, sans-serif; max-width: 500px; margin: 0 auto; color: #282828;">
            <img src="https://dimancheobjects.com/assets/compressed/toldo-dimanche-email.png"
              alt="Dimanche Objects"
              style="width: 100%; display: block; margin: 0 auto 24px;">
            <h1 style="font-size: 16px; font-weight: 800; color: #ff2f00ff;">¡Gracias por tu compra, ${nombre}!</h1>
            <p style="font-size: 13px; line-height: 20px;">Hemos recibido tu pedido y lo prepararemos con cariño.</p>

            <h2 style="font-size: 13px; font-weight: 700; margin-top: 24px;">Tu pedido:</h2>
            ${productosComprados.map(p => `
              <div style="margin-bottom: 12px; border-bottom: 1px solid #e8e8e8; padding-bottom: 12px;">
                <p style="font-size: 13px; font-weight: 700; margin: 0;">${p.nombre}</p>
                <p style="font-size: 13px; color: #ff2f00ff; margin: 0;">${p.precio_descuento ?? p.precio}€</p>
              </div>
            `).join('')}

            ${envioTotal != null ? `
              <div style="margin-top: 8px; border-top: 1px solid #282828; padding-top: 12px;">
                <p style="font-size: 13px; margin: 0;">Subtotal: <strong>${subtotal}€</strong></p>
                <p style="font-size: 13px; margin: 4px 0;">Envío: <strong>${envioTotal}€</strong></p>
                <p style="font-size: 14px; font-weight: 800; color: #ff2f00ff; margin: 8px 0 0;">Total: ${totalCobrado}€</p>
              </div>
            ` : `
              <div style="margin-top: 8px; border-top: 1px solid #282828; padding-top: 12px;">
                <p style="font-size: 14px; font-weight: 800; color: #ff2f00ff; margin: 0;">Total: ${totalCobrado}€</p>
              </div>
            `}

            <h2 style="font-size: 13px; font-weight: 700; margin-top: 24px;">Dirección de envío:</h2>
            <p style="font-size: 13px; line-height: 20px;">
              ${direccion?.line1 ?? ''}<br>
              ${direccion?.line2 ? direccion.line2 + '<br>' : ''}
              ${direccion?.postal_code ?? ''} ${direccion?.city ?? ''}<br>
              ${direccion?.country ?? ''}<br>
              ${telefono ?? 'Sin teléfono'}
            </p>
           

            <p style="font-size: 13px; line-height: 20px; margin-top: 24px;">
              Te escribiremos cuando lo enviemos. Si tienes cualquier duda escríbenos a
              <a href="mailto:dimancheobjects@gmail.com" style="color: #ff2f00ff;">dimancheobjects@gmail.com</a>
            </p>
          </div>
        `
      });
    }

    // Email de notificación al admin
    await resend.emails.send({
      from:    'Dimanche Objects <tienda@dimancheobjects.com>',
      to:      'dimancheobjects@gmail.com',
      subject: `Nueva venta — ${productosComprados.map(p => p.nombre).join(', ')}`,
      html: `
        <div style="font-family: helvetica, sans-serif; max-width: 500px; margin: 0 auto; color: #282828;">
          <h1 style="font-size: 16px; font-weight: 800; color: #ff2f00ff;">Nueva venta por la web tron!</h1>

          <h2 style="font-size: 13px; font-weight: 700; margin-top: 24px;">Cliente:</h2>
          <p style="font-size: 13px; margin: 0;">${nombre ?? 'Sin nombre'}</p>
          <p style="font-size: 13px; margin: 4px 0;">${emailCliente ?? 'Sin email'}</p>
          <p style="font-size: 13px; margin: 4px 0;">${telefono ?? 'Sin teléfono'}</p>
          <h2 style="font-size: 13px; font-weight: 700; margin-top: 24px;">Productos vendidos:</h2>
          ${productosComprados.map(p => `
            <div style="margin-bottom: 12px; border-bottom: 1px solid #e8e8e8; padding-bottom: 12px;">
              <p style="font-size: 13px; font-weight: 700; margin: 0;">${p.nombre}</p>
              <p style="font-size: 13px; color: #ff2f00ff; margin: 0;">${p.precio_descuento ?? p.precio}€</p>
            </div>
          `).join('')}

          <div style="margin-top: 8px; border-top: 1px solid #282828; padding-top: 12px;">
            ${envioTotal != null ? `
              <p style="font-size: 13px; margin: 0;">Subtotal: <strong>${subtotal}€</strong></p>
              <p style="font-size: 13px; margin: 4px 0;">Envío: <strong>${envioTotal}€</strong></p>
            ` : ''}
            <p style="font-size: 14px; font-weight: 800; color: #ff2f00ff; margin: 8px 0 0;">Total cobrado: ${totalCobrado}€</p>
          </div>

          <h2 style="font-size: 13px; font-weight: 700; margin-top: 24px;">Dirección de envío:</h2>
          <p style="font-size: 13px; line-height: 20px;">
            ${direccion?.line1 ?? ''}<br>
            ${direccion?.line2 ? direccion.line2 + '<br>' : ''}
            ${direccion?.postal_code ?? ''} ${direccion?.city ?? ''}<br>
            ${direccion?.country ?? ''}
          </p>
         
        </div>
      `
    });
  }

  if (stripeEvent.type === 'checkout.session.expired' ||
      stripeEvent.type === 'payment_intent.payment_failed') {
    const session = stripeEvent.data.object;
    const ids     = JSON.parse(session.metadata?.ids || '[]');
    await Promise.all(ids.map(id => reservasStore.delete(id).catch(() => {})));
  }

  return { statusCode: 200, body: 'ok' };
};