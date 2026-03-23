const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Petición inválida' }) }; }

  const { token } = body;

  if (!token || token !== process.env.ADMIN_TOKEN) {
    return { statusCode: 401, body: JSON.stringify({ error: 'No autorizado' }) };
  }

  try {
    const store = getStore({
      name:   'reservas',
      siteID: process.env.NETLIFY_SITE_ID,
      token:  process.env.NETLIFY_TOKEN
    });

    const { blobs } = await store.list();
    await Promise.all(blobs.map(b => store.delete(b.key)));

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, eliminadas: blobs.length })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};