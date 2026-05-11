/**
 * merch-shop.js
 * Carga el catálogo de merch y renderiza la grid de productos.
 * Espera al evento 'components:ready' para que el DOM esté listo.
 */

const MERCH_PATH_SHOP = '/data/merch.json';
let todosLosMerch = [];

// ─── RENDER DE TARJETAS ───────────────────────────────────────────────────────
function renderMerch(lista) {
  const container = document.getElementById('productos');
  if (!container) return;

  container.innerHTML = lista.map(p => {
    const tallasTotales  = Object.values(p.tallas).reduce((a, b) => a + b, 0);
    const hayStock       = tallasTotales > 0;
    const tallaDisponible = p.talla_unica
      ? (p.tallas['única'] > 0 ? 'única' : null)
      : null; // en talla_unica=false el usuario elige en la página de producto

    return `
      <div class="column"
           data-categorias="${p.categorias.join(' ')}"
           data-precio="${p.precio}"
           data-precio-descuento="${p.precio_descuento || ''}">
        <a href="/merch/${p.id}">
          <img class="column-picture" src="assets/compressed/${p.imagen.split('/').pop()}" alt="${p.nombre}">
        </a>
        <a class="one" href="/merch/${p.id}">${p.nombre}</a>
        <div class="precio-container">
          ${p.precio_descuento
            ? `<span class="precio-original">${p.precio}€</span>
               <span class="precio-descuento">${p.precio_descuento}€</span>`
            : `<span class="precio">${p.precio}€</span>`
          }
        </div>
        ${p.talla_unica
          ? `<button
               class="btn-añadir${!hayStock ? ' btn-reservado' : ''}"
               onclick="${hayStock ? `añadirMerchAlCarrito('${p.id}', 'única')` : ''}"
               ${!hayStock ? 'disabled' : ''}>
               ${hayStock ? 'AÑADIR AL CARRITO' : 'AGOTADO'}
             </button>`
          : `<a href="/merch/${p.id}">
               <button class="btn-añadir${!hayStock ? ' btn-reservado' : ''}" ${!hayStock ? 'disabled' : ''}>
                 ${hayStock ? 'ELEGIR TALLA' : 'AGOTADO'}
               </button>
             </a>`
        }
      </div>
    `;
  }).join('');
}

// ─── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('components:ready', async () => {
  const res        = await fetch(MERCH_PATH_SHOP);
  todosLosMerch    = await res.json();
  renderMerch(todosLosMerch);
});
