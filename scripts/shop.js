/**
 * shop.js
 * Carga el catálogo, renderiza la grid de productos y gestiona los filtros.
 * Espera al evento 'components:ready' para que los filtros estén en el DOM.
 */

const DATA_PATH_SHOP = '/data/productos.json';
let todosLosProductos = [];

// ─── RENDER DE TARJETAS ───────────────────────────────────────────────────────
function renderProductos(lista) {
  const container = document.getElementById('productos');
  if (!container) return;

  container.innerHTML = lista.map(p => {
    const reservado = p.reservado;
    return `
      <div class="column"
           data-categorias="${p.categorias.join(' ')}"
           data-precio="${p.precio}"
           data-precio-descuento="${p.precio_descuento || ''}">
        <a href="/${p.id}">
          <img class="column-picture" src="assets/compressed/${p.imagen.split('/').pop()}" alt="${p.nombre}">
        </a>
        <a class="one" href="/${p.id}">${p.nombre}</a>
        <div class="precio-container">
          ${p.precio_descuento
            ? `<span class="precio-original">${p.precio}€</span>
               <span class="precio-descuento">${p.precio_descuento}€</span>`
            : `<span class="precio">${p.precio}€</span>`
          }
        </div>
        <button
          class="btn-añadir${reservado ? ' btn-reservado' : ''}"
          onclick="${reservado ? '' : `añadirAlCarrito('${p.id}')`}"
          ${reservado ? 'disabled' : ''}>
          ${reservado ? 'RESERVADO' : 'AÑADIR AL CARRITO'}
        </button>
      </div>
    `;
  }).join('');
}

// ─── FILTROS ──────────────────────────────────────────────────────────────────
function filtrarCategoria(cat) {
  const filtrados = cat === 'all'
    ? todosLosProductos
    : todosLosProductos.filter(p => p.categorias.includes(cat));
  renderProductos(filtrados);
}

function filtrarPrecio() {
  const min = parseFloat(document.getElementById('filtro-precio-min')?.value) || 0;
  const max = parseFloat(document.getElementById('filtro-precio-max')?.value) || Infinity;
  const filtrados = todosLosProductos.filter(p => {
    const precio = p.precio_descuento ?? p.precio;
    return precio >= min && precio <= max;
  });
  renderProductos(filtrados);
}

function toggleFiltros() {
  const filtros = document.getElementById('filters-container');
  const btn     = document.getElementById('toggle-filtros');
  if (!filtros || !btn) return;
  const abierto = filtros.style.display === 'flex';
  filtros.style.display = abierto ? 'none' : 'flex';
  btn.textContent       = abierto ? 'Filtrar objetos ▾' : 'Ocultar filtros ×';
}

// ─── POPUP ────────────────────────────────────────────────────────────────────
function closePopup() {
  document.getElementById('popup').style.display = 'none';
  sessionStorage.setItem('popupClosed', 'true');
}

function initPopup() {
  const popup = document.getElementById('popup');
  if (!popup) return;
  if (!sessionStorage.getItem('popupClosed')) {
    popup.style.display = 'flex';  // change to flex to display popup, change to none para ocultarlo
  }
}

// ─── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('components:ready', async () => {
  const res = await fetch(DATA_PATH_SHOP);
  todosLosProductos = (await res.json()).filter(p => !p.categorias.includes('nuevo'));
  renderProductos(todosLosProductos);
  initPopup();
});