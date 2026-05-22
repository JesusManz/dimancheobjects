/**
 * merch-product.js
 * Lee el id de la URL, carga el producto de merch.json y renderiza la página.
 * Incluye selector de talla y gestión de stock por talla.
 * Espera al evento 'components:ready'.
 */

const MERCH_PATH_PRODUCT = '/data/merch.json';

// ─── PARSEAR MARKDOWN MÍNIMO ──────────────────────────────────────────────────
function parsearDescripcion(texto) {
  return texto
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

// ─── ESTADO ───────────────────────────────────────────────────────────────────
let productoMerchActual = null;
let tallaSeleccionada   = null;

// ─── SELECTOR DE TALLA ────────────────────────────────────────────────────────
function renderSelectorTallas(producto) {
  const container = document.getElementById('talla-selector');
  if (!container) return;

  // Si es talla única no mostramos selector
  if (producto.talla_unica) {
    container.style.display = 'none';
    tallaSeleccionada = 'única';
    actualizarBotonAñadir();
    return;
  }

  const tallasOrden = ['S', 'M', 'L', 'XL'];
  const tallas      = Object.keys(producto.tallas).sort(
    (a, b) => tallasOrden.indexOf(a) - tallasOrden.indexOf(b)
  );

  container.innerHTML = `
    <div class="talla-label">TALLA:</div>
    <div class="talla-opciones">
      ${tallas.map(talla => {
        const stock    = producto.tallas[talla];
        const agotada  = stock <= 0;
        return `
          <button
            class="talla-btn${agotada ? ' talla-agotada' : ''}"
            data-talla="${talla}"
            onclick="${agotada ? '' : `seleccionarTalla('${talla}')`}"
            ${agotada ? 'disabled' : ''}>
            ${talla}${agotada ? '' : ''}
          </button>
        `;
      }).join('')}
    </div>
    <p id="talla-error" class="talla-error" style="display:none;">Necesitamos saber tu talla :)</p>
  `;
}



function seleccionarTalla(talla) {
  tallaSeleccionada = talla;

  // Actualizar clases visuales
  document.querySelectorAll('.talla-btn').forEach(btn => {
    btn.classList.toggle('talla-seleccionada', btn.dataset.talla === talla);
  });

  // Ocultar error si lo había
  const errorEl = document.getElementById('talla-error');
  if (errorEl) errorEl.style.display = 'none';

  actualizarBotonAñadir();
}

function actualizarBotonAñadir() {
  const btn = document.getElementById('btn-añadir');
  if (!btn || !productoMerchActual) return;

  const tallasTotales = Object.values(productoMerchActual.tallas).reduce((a, b) => a + b, 0);
  if (tallasTotales <= 0) {
    btn.textContent = 'AGOTADO';
    btn.disabled    = true;
    btn.classList.add('btn-reservado');
  }
}

// ─── TABLA DE TALLAS ──────────────────────────────────────────────────────────
function renderTablaTallas(producto) {
  if (producto.talla_unica || !producto.guia_tallas) return;

  const tallasOrden = ['S', 'M', 'L', 'XL'];
  const tallas = tallasOrden.filter(t => producto.guia_tallas[t]);

  if (tallas.length === 0) return;

  let container = document.getElementById('tabla-tallas');
  if (!container) {
    container = document.createElement('div');
    container.id = 'tabla-tallas';
    const selectorEl = document.getElementById('talla-selector');
    if (selectorEl) selectorEl.insertAdjacentElement('afterend', container);
  }

  container.innerHTML = `
    <details class="tallas-details">
      <summary class="tallas-summary">Guía de tallas</summary>
      <table class="tabla-tallas">
        <thead>
          <tr><th>TALLA</th><th>LARGO</th><th>ANCHO</th></tr>
        </thead>
        <tbody>
          ${tallas.map(talla => {
            const { largo, ancho } = producto.guia_tallas[talla];
            return `<tr>
              <td>${talla}</td>
              <td>${largo} cm</td>
              <td>${ancho} cm</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </details>
  `;
}

// ─── AÑADIR AL CARRITO ────────────────────────────────────────────────────────
function handleAñadirMerch() {
  if (!productoMerchActual) return;

  // Si no es talla única y no hay talla seleccionada, mostrar error
  if (!productoMerchActual.talla_unica && !tallaSeleccionada) {
    const errorEl = document.getElementById('talla-error');
    if (errorEl) errorEl.style.display = 'block';
    return;
  }

  const talla = tallaSeleccionada || 'única';
  añadirMerchAlCarrito(productoMerchActual.id, talla);
}

// ─── RELACIONADOS ─────────────────────────────────────────────────────────────
function cargarRelacionadosMerch(catalogo, idActual) {
  const disponibles = catalogo.filter(p => {
    if (p.id === idActual) return false;
    const totalStock = Object.values(p.tallas).reduce((a, b) => a + b, 0);
    return totalStock > 0;
  });

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
    <a href="/merch/${p.id}" class="relacionado-item">
      <img src="/assets/compressed/${p.imagen.split('/').pop()}" alt="${p.nombre}">
      <span>${p.nombre}</span>
      <span>${p.precio_descuento ?? p.precio}€</span>
    </a>
  `).join('');
}

// ─── CARGAR PRODUCTO ──────────────────────────────────────────────────────────
async function cargarProductoMerch() {
  const params = new URLSearchParams(window.location.search);
  let id       = params.get('id');

  if (!id) {
    // Soporta rutas tipo /merch/camiseta-logo-001
    const partes = window.location.pathname.replace(/^\/|\/$/g, '').split('/');
    id = partes[partes.length - 1];
  }

  const res      = await fetch(MERCH_PATH_PRODUCT);
  const catalogo = await res.json();
  const producto = catalogo.find(p => p.id === id);

  if (!producto) {
    document.body.innerHTML = '<p style="padding:2rem;font-family:helvetica;">Producto no encontrado.</p>';
    return;
  }

  productoMerchActual = producto;

  // Meta
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
      //`Envío nacional desde ${producto.envio.nacional}€ · Internacional desde ${producto.envio.internacional}€`;
      `Envío nacional gratuito · Internacional desde ${producto.envio.internacional}€`;
  }

  // Selector de talla
  renderSelectorTallas(producto);

  // Imágenes
  const imgContainer = document.getElementById('producto-imagenes');
  if (imgContainer) {
    imgContainer.innerHTML = producto.imagenes.map(src =>
      `<img src="/assets/compressed/${src.split('/').pop()}" alt="${producto.nombre}">`
    ).join('');
  }

  // Relacionados
  cargarRelacionadosMerch(catalogo, id);
  // Tallas tabla
  renderTablaTallas(producto);
}


// ─── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('components:ready', () => {
  cargarProductoMerch();
});
