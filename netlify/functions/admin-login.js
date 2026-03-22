const crypto = require('crypto');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Petición inválida' }) }; }

  const { password } = body;

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    await new Promise(r => setTimeout(r, 800));
    return { statusCode: 401, body: JSON.stringify({ error: 'Contraseña incorrecta' }) };
  }

  const token = crypto
    .createHmac('sha256', process.env.ADMIN_SECRET || 'dimanche-secret')
    .update(password)
    .digest('hex');

  return {
    statusCode: 200,
    headers:    { 'Content-Type': 'application/json' },
    body:       JSON.stringify({ token })
  };
};
