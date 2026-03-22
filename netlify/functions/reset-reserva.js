const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const { token, id } = JSON.parse(event.body || '{}');

  if (!token || token !== process.env.ADMIN_TOKEN) {
    return { statusCode: 401, body: JSON.stringify({ error: 'No autorizado' }) };
  }

  const store = getStore({
    name:   'reservas',
    siteID: process.env.NETLIFY_SITE_ID,
    token:  process.env.NETLIFY_TOKEN
  });

  await store.delete(id);

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};