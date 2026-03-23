/**
 * cart.js
 * Lógica del carrito: estado, cálculos, render del panel y checkout.
 * Depende de que el componente cart.html esté ya en el DOM
 * (lo garantiza components.js antes de disparar 'components:ready').
 */

// ─── CONSTANTES ────────────────────────────────────────────────────────────────
const TOPE_NACIONAL      = 25;
const TOPE_INTERNACIONAL = 50;
const FACTOR_ACUMULACION = 1.3;
const CHECKOUT_URL       = '.netlify/functions/checkout';
const DATA_PATH          = 'data/productos.json';

// ─── CATÁLOGO EN MEMORIA ───────────────────────────────────────────────────────
let _catalogo = [];

async function cargarCatalogo() {
  if (_catalogo.length > 0) return _catalogo;
  const res  = await fetch(DATA_PATH);
  _catalogo  = await res.json();
  return _catalogo;
}

// ─── PERSISTENCIA ─────────────────────────────────────────────────────────────
function getCarrito() {
  return JSON.parse(localStorage.getItem('carrito') || '[]');
}

function setCarrito(carrito) {
  localStorage.setItem('carrito', JSON.stringify(carrito));
  renderCarrito();
}

// ─── AÑADIR / ELIMINAR ─────────────────────────────────────────────────────────
async function añadirAlCarrito(id) {
  const catalogo = await cargarCatalogo();
  const producto = catalogo.find(p => p.id === id);
  if (!producto || producto.reservado) return;

  const carrito = getCarrito();
  if (carrito.includes(id)) { abrirCarrito(); return; }

  carrito.push(id);
  setCarrito(carrito);
  abrirCarrito();
}

function eliminarDelCarrito(id) {
  setCarrito(getCarrito().filter(i => i !== id));
}

// ─── CÁLCULO DE ENVÍO ──────────────────────────────────────────────────────────
function calcularEnvio(productos, zona) {
  if (productos.length === 0) return 0;
  const campo = zona === 'internacional' ? 'internacional' : 'nacional';
  const tope  = zona === 'internacional' ? TOPE_INTERNACIONAL : TOPE_NACIONAL;
  const suma = productos.reduce((acc, p) => acc + (p.envio?.[campo] ?? 0), 0);
  const total = productos.length > 1 ? Math.round(suma / FACTOR_ACUMULACION) : suma;
  return Math.min(total, tope);
}

// ─── RENDER DEL PANEL ─────────────────────────────────────────────────────────
async function renderCarrito() {
  const carrito  = getCarrito();
  const catalogo = await cargarCatalogo();
  const zona     = localStorage.getItem('zona') || 'nacional';

  const productos = carrito.map(id => catalogo.find(p => p.id === id)).filter(Boolean);
  const subtotal  = productos.reduce((acc, p) => acc + (p.precio_descuento ?? p.precio), 0);
  const envio     = calcularEnvio(productos, zona);
  const total     = subtotal + envio;

  // Lista
  const listaEl = document.getElementById('carrito-lista');
  if (listaEl) {
    listaEl.innerHTML = productos.length === 0
      ? '<p class="carrito-vacio">Tu carrito está vacío.</p>'
      : productos.map(p => `
          <div class="carrito-item">
            <img src="assets/compressed/${p.imagen.split('/').pop()}" alt="${p.nombre}">
            <div class="carrito-item-info">
              <span class="carrito-item-nombre">${p.nombre}</span>
              <span class="carrito-item-precio">${p.precio_descuento ?? p.precio}€</span>
            </div>
            <button class="carrito-item-eliminar" onclick="eliminarDelCarrito('${p.id}')">✕</button>
          </div>
        `).join('');
  }

  // Totales
  const envioEl = document.getElementById('carrito-envio');
  const totalEl = document.getElementById('carrito-total');
  const zonaEl  = document.getElementById('carrito-zona');
  const badge   = document.getElementById('carrito-badge');

  if (envioEl) envioEl.textContent  = `${envio}€`;
  if (totalEl) totalEl.textContent  = `${total}€`;
  if (zonaEl)  zonaEl.value         = zona;
  if (badge) {
    badge.textContent   = carrito.length;
    badge.style.display = carrito.length > 0 ? 'inline-flex' : 'none';
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

  try {
    const res  = await fetch(CHECKOUT_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ids: carrito, zona })
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
  const limpio   = getCarrito().filter(id => {
    const p = catalogo.find(p => p.id === id);
    return p && !p.reservado;
  });
  setCarrito(limpio);
}

// ─── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('components:ready', () => {
  sincronizarCarrito();
});
