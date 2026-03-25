const fs   = require('fs');
const path = require('path');

const BASE_URL = 'https://dimancheobjects.com';

const PAGINAS_ESTATICAS = [
  { url: '/',         priority: '1.0', changefreq: 'weekly'  },
  { url: '/tienda',   priority: '0.9', changefreq: 'weekly'  },
  { url: '/vendidos', priority: '0.5', changefreq: 'weekly'  },
  { url: '/about',    priority: '0.4', changefreq: 'monthly' },
  { url: '/blog',     priority: '0.4', changefreq: 'weekly'  },
  { url: '/new',      priority: '0.8', changefreq: 'weekly'  },
  { url: '/legal',    priority: '0.2', changefreq: 'monthly' },
];

exports.handler = async (event) => {
  try {
    const catalogo = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../data/productos.json'), 'utf8')
    );
    const vendidos = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../data/productos-vendidos.json'), 'utf8')
    );

    const hoy = new Date().toISOString().split('T')[0];

    const todosLosProductos = [...catalogo, ...vendidos];

    const urlsProductos = todosLosProductos.map(p => `
  <url>
    <loc>${BASE_URL}/${p.id}</loc>
    <lastmod>${hoy}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${catalogo.find(c => c.id === p.id) ? '0.8' : '0.5'}</priority>
  </url>`).join('');

    const urlsEstaticas = PAGINAS_ESTATICAS.map(p => `
  <url>
    <loc>${BASE_URL}${p.url}</loc>
    <lastmod>${hoy}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('');

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsEstaticas}
${urlsProductos}
</urlset>`;

    return {
      statusCode: 200,
      headers:    {
        'Content-Type':  'application/xml',
        'Cache-Control': 'public, max-age=3600'
      },
      body: sitemap
    };

  } catch (err) {
    return {
      statusCode: 500,
      body:       `Error generando sitemap: ${err.message}`
    };
  }
};