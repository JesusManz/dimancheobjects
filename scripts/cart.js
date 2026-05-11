/**
 * cart.js
 * Lógica del carrito: estado, cálculos, render del panel y checkout.
 * Soporta dos tipos de item:
 *   - string          → objeto único (productos.json)
 *   - { id, talla, cantidad } → merch (merch.json)
 * Depende de que el componente cart.html esté ya en el DOM
 * (lo garantiza components.js antes de disparar 'components:ready').
 */

// ─── CONSTANTES ────────────────────────────────────────────────────────────────
const TOPE_NACIONAL      = 25;
const TOPE_INTERNACIONAL = 50;
const FACTOR_ACUMULACION = 1.1;
const CHECKOUT_URL       = '.netlify/functions/checkout';
const DATA_PATH          = '/data/productos.json';
const MERCH_PATH         = '/data/merch.json';

// ─── CATÁLOGOS EN MEMORIA ──────────────────────────────────────────────────────
let _catalogo = [];
let _merch    = [];

async function cargarCatalogo() {
  if (_catalogo.length > 0) return _catalogo;
  const res = await fetch(DATA_PATH);
  _catalogo = await res.json();
  return _catalogo;
}

async function cargarMerch() {
  if (_merch.length > 0) return _merch;
  const res = await fetch(MERCH_PATH);
  _merch = await res.json();
  return _merch;
}

// ─── HELPERS DE TIPO ──────────────────────────────────────────────────────────
function esItemMerch(item) {
  return typeof item === 'object' && item !== null;
}

// Devuelve el producto del catálogo correcto según el tipo de item
async function resolverProducto(item) {
  if (esItemMerch(item)) {
    const merch = await cargarMerch();
    return merch.find(p => p.id === item.id) || null;
  } else {
    const catalogo = await cargarCatalogo();
    return catalogo.find(p => p.id === item) || null;
  }
}

// ─── PERSISTENCIA ─────────────────────────────────────────────────────────────
function getCarrito() {
  return JSON.parse(localStorage.getItem('carrito') || '[]');
}

function setCarrito(carrito) {
  localStorage.setItem('carrito', JSON.stringify(carrito));
  renderCarrito();
}

// ─── AÑADIR OBJETO ÚNICO ───────────────────────────────────────────────────────
async function añadirAlCarrito(id) {
  const catalogo = await cargarCatalogo();
  const producto = catalogo.find(p => p.id === id);
  if (!producto || producto.reservado) return;

  const carrito = getCarrito();
  // Comprobar si ya está (los strings son los objetos únicos)
  if (carrito.some(item => !esItemMerch(item) && item === id)) {
    abrirCarrito();
    return;
  }

  carrito.push(id);
  setCarrito(carrito);
  abrirCarrito();
}

// ─── AÑADIR MERCH ─────────────────────────────────────────────────────────────
async function añadirMerchAlCarrito(id, talla) {
  const merch    = await cargarMerch();
  const producto = merch.find(p => p.id === id);
  if (!producto) return;

  const stockTalla = producto.tallas[talla] ?? 0;
  if (stockTalla <= 0) return;

  const carrito    = getCarrito();
  const itemExiste = carrito.find(item => esItemMerch(item) && item.id === id && item.talla === talla);

  if (itemExiste) {
    // No superamos el stock disponible
    if (itemExiste.cantidad < stockTalla) {
      itemExiste.cantidad += 1;
    }
    setCarrito(carrito);
  } else {
    carrito.push({ id, talla, cantidad: 1 });
    setCarrito(carrito);
  }

  abrirCarrito();
}

// ─── ELIMINAR ─────────────────────────────────────────────────────────────────
function eliminarDelCarrito(id, talla) {
  if (talla !== undefined) {
    // Es merch
    setCarrito(getCarrito().filter(item => !(esItemMerch(item) && item.id === id && item.talla === talla)));
  } else {
    // Es objeto único
    setCarrito(getCarrito().filter(item => esItemMerch(item) || item !== id));
  }
}

// ─── CÁLCULO DE ENVÍO ──────────────────────────────────────────────────────────
function calcularEnvio(productos, zona) {
  if (productos.length === 0) return 0;
  const campo = zona === 'internacional' ? 'internacional' : 'nacional';
  const tope  = zona === 'internacional' ? TOPE_INTERNACIONAL : TOPE_NACIONAL;
  // productos aquí es la lista de objetos del catálogo (ya resueltos)
  // para merch, un item con cantidad > 1 cuenta como N líneas de envío
  const suma  = productos.reduce((acc, p) => acc + (p.envio?.[campo] ?? 0), 0);
  const total = productos.length > 1 ? Math.round(suma / FACTOR_ACUMULACION) : suma;
  return Math.min(total, tope);
}

// ─── RENDER DEL PANEL ─────────────────────────────────────────────────────────
async function renderCarrito() {
  const carrito = getCarrito();
  const zona    = localStorage.getItem('zona') || 'nacional';

  // Resolver todos los productos en paralelo
  const productosResueltos = await Promise.all(
    carrito.map(async item => {
      const producto = await resolverProducto(item);
      return { item, producto };
    })
  );

  // Filtrar los que no se encontraron
  const validos = productosResueltos.filter(({ producto }) => producto !== null);

  // Para el cálculo de envío expandimos por cantidad (merch)
  const productosParaEnvio = validos.flatMap(({ item, producto }) => {
    const cantidad = esItemMerch(item) ? item.cantidad : 1;
    return Array(cantidad).fill(producto);
  });

  const subtotal = validos.reduce((acc, { item, producto }) => {
    const precio   = producto.precio_descuento ?? producto.precio;
    const cantidad = esItemMerch(item) ? item.cantidad : 1;
    return acc + precio * cantidad;
  }, 0);

  const envio = calcularEnvio(productosParaEnvio, zona);
  const total = subtotal + envio;

  // ── Lista ──
  const listaEl = document.getElementById('carrito-lista');
  if (listaEl) {
    listaEl.innerHTML = validos.length === 0
      ? '<p class="carrito-vacio">Tu carrito está vacío.</p>'
      : validos.map(({ item, producto }) => {
          const esMerch  = esItemMerch(item);
          const precio   = producto.precio_descuento ?? producto.precio;
          const cantidad = esMerch ? item.cantidad : 1;
          const talla    = esMerch ? item.talla : null;

          const deleteCall = esMerch
            ? `eliminarDelCarrito('${item.id}', '${item.talla}')`
            : `eliminarDelCarrito('${item.id}')`;

          return `
            <div class="carrito-item">
              <img src="assets/compressed/${producto.imagen.split('/').pop()}" alt="${producto.nombre}">
              <div class="carrito-item-info">
                <span class="carrito-item-nombre">${producto.nombre}</span>
                ${talla ? `<span class="carrito-item-talla">Talla: ${talla}</span>` : ''}
                <span class="carrito-item-precio">${(precio * cantidad).toFixed(2).replace('.00', '')}€${cantidad > 1 ? ` (${cantidad}×${precio}€)` : ''}</span>
              </div>
              <button class="carrito-item-eliminar" onclick="${deleteCall}">✕</button>
            </div>
          `;
        }).join('');
  }

  // ── Totales y badge ──
  const envioEl = document.getElementById('carrito-envio');
  const totalEl = document.getElementById('carrito-total');
  const zonaEl  = document.getElementById('carrito-zona');
  const badge   = document.getElementById('carrito-badge');

  const totalItems = carrito.reduce((acc, item) => acc + (esItemMerch(item) ? item.cantidad : 1), 0);

  if (envioEl) envioEl.textContent  = `${envio}€`;
  if (totalEl) totalEl.textContent  = `${total.toFixed(2).replace('.00', '')}€`;
  if (zonaEl)  zonaEl.value         = zona;
  if (badge) {
    badge.textContent   = totalItems;
    badge.style.display = totalItems > 0 ? 'inline-flex' : 'none';
  }
}

// ─── ZONA DE ENVÍO ─────────────────────────────────────────────────────────────
function cambiarZona(zona) {
  localStorage.setItem('zona', zona);
  renderCarrito();
}

// ─── ABRIR / CERRAR ───────────────────────────────────────────────────────────
function abrirCarrito() {
  document.getElementById('carrito-panel')?.classList.add('abierto');
  document.getElementById('carrito-overlay')?.classList.add('activo');
}

function cerrarCarrito() {
  document.getElementById('carrito-panel')?.classList.remove('abierto');
  document.getElementById('carrito-overlay')?.classList.remove('activo');
}

// ─── PAGAR ─────────────────────────────────────────────────────────────────────
async function pagar() {
  const carrito = getCarrito();
  if (carrito.length === 0) return;

  const zona = localStorage.getItem('zona') || 'nacional';
  const btn  = document.getElementById('carrito-pagar');
  btn.disabled    = true;
  btn.textContent = 'Procesando...';

  // Separar objetos únicos de merch
  const ids      = carrito.filter(item => !esItemMerch(item));
  const merchItems = carrito.filter(item => esItemMerch(item));

  try {
    const res  = await fetch(CHECKOUT_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ids, merch: merchItems, zona })
    });
    const data = await res.json();

    if (data.url) {
      window.location.href = data.url;
    } else {
      alert(data.error || 'Algo ha ido mal, recarga la página.');
      btn.disabled    = false;
      btn.textContent = 'COMPRAR';
      await sincronizarCarrito();
    }
  } catch {
    alert('Error de conexión, inténtalo de nuevo.');
    btn.disabled    = false;
    btn.textContent = 'COMPRAR';
  }
}

// ─── SINCRONIZAR CON STOCK REAL ───────────────────────────────────────────────
async function sincronizarCarrito() {
  const catalogo = await cargarCatalogo();
  const merch    = await cargarMerch();

  const limpio = getCarrito().filter(item => {
    if (esItemMerch(item)) {
      const producto = merch.find(p => p.id === item.id);
      if (!producto) return false;
      const stockTalla = producto.tallas[item.talla] ?? 0;
      return stockTalla > 0;
    } else {
      const producto = catalogo.find(p => p.id === item);
      return producto && !producto.reservado;
    }
  });

  setCarrito(limpio);
}

// ─── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('components:ready', () => {
  sincronizarCarrito();
});
