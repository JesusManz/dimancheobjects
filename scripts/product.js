/**
 * product.js
 * Lee el id de la URL, carga el producto del JSON y renderiza la página.
 * Espera al evento 'components:ready'.
 */

const DATA_PATH_PRODUCT = 'data/productos.json';

// ─── PARSEAR MARKDOWN MÍNIMO ──────────────────────────────────────────────────
// Soporta **negrita** y saltos de línea con \n
function parsearDescripcion(texto) {
  return texto
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

// ─── RELACIONADOS ─────────────────────────────────────────────────────────────
function cargarRelacionados(catalogo, idActual) {
  const disponibles = catalogo.filter(p => p.id !== idActual && !p.reservado);

  // Fisher-Yates shuffle
  for (let i = disponibles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [disponibles[i], disponibles[j]] = [disponibles[j], disponibles[i]];
  }

  const seleccionados = disponibles.slice(0, 3);
  if (seleccionados.length === 0) return;

  const section = document.getElementById('relacionados-section');
  const grid    = document.getElementById('relacionados');
  if (!section || !grid) return;

  section.style.display = 'block';
  grid.innerHTML = seleccionados.map(p => `
    <a href="/${p.id}" class="relacionado-item">
      <img src="/assets/compressed/${p.imagen.split('/').pop()}" alt="${p.nombre}">
      <span>${p.nombre}</span>
      <span>${p.precio_descuento ?? p.precio}€</span>
    </a>
  `).join('');
}

// ─── CARGAR PRODUCTO ──────────────────────────────────────────────────────────
let productoActual = null;

async function cargarProducto() {
  const id      = window.location.pathname.replace(/^\//, '').split('/')[0];
  const res     = await fetch(DATA_PATH_PRODUCT);
  const catalogo = await res.json();
  const producto = catalogo.find(p => p.id === id);

  if (!producto) {
    document.body.innerHTML = '<p style="padding:2rem;font-family:helvetica;">Producto no encontrado.</p>';
    return;
  }

  productoActual = producto;

  // Meta dinámico
  document.title = `${producto.nombre} — Dimanche Objects`;

  // Nombre
  const nombreEl = document.getElementById('producto-nombre');
  if (nombreEl) nombreEl.textContent = producto.nombre;

  // Descripción
  const descEl = document.getElementById('producto-descripcion');
  if (descEl) descEl.innerHTML = parsearDescripcion(producto.descripcion || '');

  // Precio
  const precioEl = document.getElementById('producto-precio');
  if (precioEl) {
    precioEl.innerHTML = producto.precio_descuento
      ? `<span class="precio-original">${producto.precio}€</span>
         <span class="precio-descuento">${producto.precio_descuento}€</span>`
      : `<span class="precio">${producto.precio}€</span>`;
  }

  // Info envío
  const envioEl = document.getElementById('producto-envio-info');
  if (envioEl) {
    envioEl.textContent =
      `Envío nacional desde ${producto.envio.nacional}€ · Internacional desde ${producto.envio.internacional}€`;
  }

  // Botón añadir
  const btn = document.getElementById('btn-añadir');
  if (btn && producto.reservado) {
    btn.textContent = 'RESERVADO';
    btn.disabled    = true;
    btn.classList.add('btn-reservado');
  }

  // Imágenes
  const imgContainer = document.getElementById('producto-imagenes');
  if (imgContainer) {
    imgContainer.innerHTML = producto.imagenes.map(src =>
      `<img src="/assets/compressed/${src.split('/').pop()}" alt="${producto.nombre}">`
    ).join('');
  }

  // Relacionados
  cargarRelacionados(catalogo, id);
}

// Exponer para el botón inline del HTML
function handleAñadir() {
  if (productoActual && !productoActual.reservado) {
    añadirAlCarrito(productoActual.id);
  }
}

// ─── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('components:ready', () => {
  cargarProducto();
});
