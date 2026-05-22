/**
 * components.js
 * Carga e inyecta los componentes HTML (header, footer, cart, filters)
 * en los nodos correspondientes del DOM.
 *
 * Uso en cada página:
 *   <div id="header"></div>
 *   <div id="footer"></div>
 *   <div id="cart"></div>        ← solo en páginas con carrito
 *   <div id="filters"></div>     ← solo en tienda
 *
 *   <script src="/scripts/components.js"></script>
 *
 * Los scripts de página (shop.js, product.js, cart.js) deben cargarse
 * DESPUÉS de este archivo, usando el evento 'components:ready'.
 */

const COMPONENTS_PATH = '/components/';

/**
 * Fetcha un componente HTML y lo inyecta en el nodo destino.
 * Devuelve una promesa que resuelve cuando el HTML está en el DOM.
 */
async function loadComponent(nombre, targetId) {
  const target = document.getElementById(targetId);
  if (!target) return;

  try {
    const res  = await fetch(`${COMPONENTS_PATH}${nombre}.html`);
    const html = await res.text();
    target.innerHTML = html;

    // Mover cont-circle fuera del div#header para que sticky funcione
    if (nombre === 'header') {
      const circle = target.querySelector('#cont-circle');
      if (circle) {
        target.after(circle); // lo coloca justo después de <div id="header">
      }
    }
  } catch (e) {
    console.error(`Error cargando componente "${nombre}":`, e);
  }
}
/**
 * Carga todos los componentes presentes en la página
 * y dispara el evento 'components:ready' cuando termina.
 */
async function initComponents() {
  await Promise.all([
    loadComponent('header',  'header'),
    loadComponent('footer',  'footer'),
    loadComponent('cart',    'cart'),
    loadComponent('filters', 'filters'),
    loadComponent('popup',   'popup-mount'),
    loadComponent('semicircle', 'semicircle'),
    loadComponent('newsletter', 'newsletter'),
  ]);

  // Inicializar semicírculos si el header fue cargado
  if (document.getElementById('cont-circle')) {
    initSemicircles();
  }


// Mostrar popup
 const popup = document.getElementById('popup');
if (popup && !sessionStorage.getItem('popupClosed')) {
  popup.style.display = 'flex';
} 



  // Avisar a los scripts de página que los componentes están listos
  document.dispatchEvent(new Event('components:ready'));
}

// Cerrar popup
function closePopup() {
  const popup = document.getElementById('popup');
  if (popup) popup.style.display = 'none';
  sessionStorage.setItem('popupClosed', 'true');
}

function toggleMenuMobile() {
  const lista = document.getElementById('menu-mobile-lista');
  const btn   = document.querySelector('.menu-mobile-btn');
  const abierto = lista.classList.contains('abierto');
  lista.classList.toggle('abierto', !abierto);
  btn.textContent = abierto ? 'MENÚ' : 'CERRAR';
}

/**
 * Genera los semicírculos del header dinámicamente.
 * Se llama desde initComponents() y en cada resize.
 */
function initSemicircles() {
  function render() {
    const container = document.getElementById('cont-circle');
    if (!container) return;
    container.innerHTML = '';
    const semiHeight = container.offsetHeight || 50;
    const semiWidth  = semiHeight * 2;
    const num        = Math.ceil(window.innerWidth / semiWidth);
    for (let i = 0; i < num; i++) {
      const d = document.createElement('div');
      d.classList.add('semicircle');
      d.style.width  = `${semiWidth}px`;
      d.style.height = `${semiHeight}px`;
      container.appendChild(d);
    }
  }
  render();
  window.addEventListener('resize', render);
}

// Arrancar
initComponents();

// ─── NEWSLETTER ───────────────────────────────────────────────────────────────
async function suscribirse(event) {
  event.preventDefault();
 
  const nombre  = document.getElementById('newsletter-nombre')?.value.trim();
  const email   = document.getElementById('newsletter-email')?.value.trim();
  const btn     = document.getElementById('newsletter-btn');
  const mensaje = document.getElementById('newsletter-mensaje');
 
  if (!nombre || !email) return;
 
  btn.disabled    = true;
  btn.textContent = '...';
  mensaje.textContent = '';
  mensaje.className   = 'newsletter-mensaje';
 
  try {
    const res  = await fetch('/.netlify/functions/suscribir', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ nombre, email })
    });
    const data = await res.json();
 
    if (data.ok) {
      mensaje.textContent = '¡Apuntado! Te escribimos el sábado.';
      mensaje.classList.add('ok');
      document.getElementById('newsletter-form').reset();
      btn.textContent = 'RECIBIR AVISOS';
      btn.disabled    = false;
    } else {
      mensaje.textContent = data.error || 'Algo ha ido mal, inténtalo de nuevo.';
      mensaje.classList.add('error');
      btn.textContent = 'RECIBIR AVISOS';
      btn.disabled    = false;
    }
  } catch {
    mensaje.textContent = 'Error de conexión, inténtalo de nuevo.';
    mensaje.classList.add('error');
    btn.textContent = 'RECIBIR AVISOS';
    btn.disabled    = false;
  }
}
