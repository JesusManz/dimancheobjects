// Función para mezclar arrays aleatoriamente
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get('id');

  if (!productId) return;

  try {
    const res = await fetch('productos.json'); // ruta correcta
    const products = await res.json();

    const producto = products.find(p => p.id === productId);
    if (!producto) {
      document.getElementById('producto').innerHTML = '<p>Producto no encontrado</p>';
      return;
    }

    renderProducto(producto);
    renderOtros(products, productId);

  } catch (err) {
    console.error('Error cargando productos:', err);
    document.getElementById('producto').innerHTML = '<p>Error cargando productos</p>';
  }
}

// Renderiza el producto principal
function renderProducto(p) {
  const container = document.getElementById('producto');

  // Manejo de saltos de línea en la descripción
  const descripcionHTML = p.descripcion ? p.descripcion.replace(/\n/g, '<br>') : '';

  // Galería de imágenes
  const imagenesHTML = p.imagenes && p.imagenes.length > 0 
    ? p.imagenes.map(src => `<img src="${src}" alt="${p.nombre}">`).join('')
    : `<img src="placeholder.jpg" alt="Sin imagen">`;

  let compraHTML = '';
  if (!p.vendido) {
    compraHTML = `
      <p class="precio">${p.precio}€ + envío ${p.envio || 0}€</p>
      <p>
        <a class="one" href="${p.stripeLink}" target="_blank" rel="noopener">Comprar con Stripe ⟶</a><br>
        <a class="one" href="${p.externoLink}" target="_blank" rel="noopener">Comprar en plataforma externa ⟶</a>
      </p>
    `;
  } else {
    compraHTML = `<p class="vendido">VENDIDO</p>`;
  }

  container.innerHTML = `
    <img src="${p.imagenes[0]}" alt="${p.titulo}">
  <h2>${p.nombre}</h2>
  <p>${p.descripcion.replace(/\n/g, '<br>')}</p>
    ${compraHTML}
    ${imagenesHTML}
  `;
}

// Renderiza hasta 3 productos aleatorios diferentes al actual
function renderOtros(products, currentId) {
  const otrosGrid = document.getElementById('otros-grid');
  if (!otrosGrid) return;

  let otros = products.filter(p => p.id !== currentId && !p.vendido);

  if (otros.length === 0) {
    document.getElementById('otros-productos').style.display = 'none';
    return;
  }

  otros = shuffleArray(otros).slice(0, 3); // máximo 3 productos aleatorios

  otrosGrid.innerHTML = otros.map(o => `
    <div class="otros-grid-item">
      <a href="producto.html?id=${o.id}">
        <img class="otros-grid-picture" src="${o.imagenes && o.imagenes[0] ? o.imagenes[0] : 'placeholder.jpg'}" alt="${o.nombre}">
        <p>${o.nombre}</p>
        <p>${o.precio}€</p>
      </a>
    </div>
  `).join('');
}

init();
