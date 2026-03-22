exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Petición inválida' }) }; }

  const { email, nombre } = body;

  if (!email || !nombre) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Email y nombre son obligatorios' }) };
  }

  // Validación básica de email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Email no válido' }) };
  }

  const AUDIENCE_ID  = '090cf87a-8002-4c23-9728-234fff18474d';
  const RESEND_API   = `https://api.resend.com/audiences/${AUDIENCE_ID}/contacts`;

  try {
    const res = await fetch(RESEND_API, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        email,
        first_name:   nombre,
        unsubscribed: false
      })
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend error:', data);
      return { statusCode: 500, body: JSON.stringify({ error: 'Error al suscribirse' }) };
    }

    return {
      statusCode: 200,
      headers:    { 'Content-Type': 'application/json' },
      body:       JSON.stringify({ ok: true })
    };
  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Error de conexión' }) };
  }
};
