const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Carpeta donde están los HTML
const carpeta = __dirname;

const salida = []; // Aquí guardaremos todos los objetos

fs.readdirSync(carpeta).forEach(file => {
  if (file.endsWith('.html')) {
    const id = path.basename(file, '.html');
    const ruta = path.join(carpeta, file);
    const html = fs.readFileSync(ruta, 'utf8');
    const $ = cheerio.load(html);

    // nombre y titulo (primer <h2>)
    const titulo = $('h2').first().text().trim();

    // descripción: concatenar todos los <p>
    const descripcion = $('p').map((i, el) => $(el).text().trim()).get().join('\n');

    // precio: busca el primer número en los <p>
    // Ajusta la regex si tu formato de precio es distinto
    const precioMatch = descripcion.match(/(\d+(?:[.,]\d+)?)/);
    const precio = precioMatch ? parseFloat(precioMatch[1].replace(',', '.')) : null;

    // vendido: true si el texto total contiene "vendido"
    const vendido = /vendido/i.test($.text());

    // imágenes
    const imagenes = $('img').map((i, el) => $(el).attr('src')).get();

    // objeto final
    const item = {
      id: id,
      nombre: titulo,
      titulo: titulo,
      descripcion: descripcion,
      categorias: ["cocina", "herramienta", "diseno", "vintage"], // ajusta a tus necesidades
      precio: precio || 0,
      envio: 5,
      stripeLink: "https://buy.stripe.com/tu-link-de-stripe",     // edita si necesitas otro
      externoLink: "https://www.vinted.fr/member/166738557",      // edita si necesitas otro
      vendido: vendido,
      imagenes: imagenes,
      url: "/" + id
    };

    salida.push(item);
  }
});

// Guardar en un archivo JSON
fs.writeFileSync('productosimagen.json', JSON.stringify(salida, null, 2), 'utf8');
console.log(`✅ Generado productos.json con ${salida.length} elementos`);
