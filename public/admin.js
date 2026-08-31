function mostrarToast(mensaje, tipo = "info") {
  let container = document.getElementById("toastContainer");

  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${tipo}`;
  toast.innerText = mensaje;
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);

  sonidoNotificacion();
  vibrar();
}

function sonidoNotificacion() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = 660;
    gain.gain.value = 0.05;

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {}
}

function vibrar() {
  if (navigator.vibrate) navigator.vibrate(100);
}

const socket = io();

function getRestaurantId() {
  const params = new URLSearchParams(window.location.search);

  const restaurantId =
    params.get("restaurantId") ||
    localStorage.getItem("adminRestaurantId");

  if (!restaurantId) {
    throw new Error("GRUK: no existe restaurantId para la sesión actual");
  }

  return restaurantId.trim();
}

function tiempoTranscurrido(fecha) {
  const ahora = new Date();
  const creada = new Date(fecha);
  const segundos = Math.floor((ahora - creada) / 1000);

  if (segundos < 60) return `Hace ${segundos} segundos`;

  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `Hace ${minutos} minuto${minutos !== 1 ? "s" : ""}`;

  const horas = Math.floor(minutos / 60);
  return `Hace ${horas} hora${horas !== 1 ? "s" : ""}`;
}

function formatoCOP(valor) {
  return "$" + Math.round(Number(valor || 0)).toLocaleString("es-CO");
}

function toggleMenuGRUK() {
  const menu = document.getElementById("menuAdminGRUK");
  if (menu) menu.classList.toggle("abierto");
}

function cargarCSSModuloGRUK(nombreModulo) {
  const modulosConCSS = new Set([
    "centro-control",
    "configuracion",
    "finanzas",
    "inventario",
    "laboral",
    "reportes",
    "restaurante"
  ]);

  if (!modulosConCSS.has(nombreModulo)) {
    return;
  }

  const id = `css-${nombreModulo}`;

  if (document.getElementById(id)) {
    return;
  }

  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `/css/${nombreModulo}.css`;

  document.head.appendChild(link);
}
function cargarScriptModuloGRUK(nombreModulo) {
  return new Promise((resolve) => {
    const scripts = {
      "centro-control": "/js/centro-control.js",
      restaurante: "/js/restaurante.js",
      inventario: "/js/inventario.js",
      recetas: "/js/recetas.js",
      reportes: "/js/reportes.js",
      configuracion: "/js/configuracion.js",
      finanzas: "/finanzas.js"
    };

    const src = scripts[nombreModulo];

    if (!src) {
      resolve();
      return;
    }

    const yaExiste = document.querySelector(`script[src="${src}"]`);

    if (yaExiste) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.id = `script-${nombreModulo}`;
    script.src = src;
    script.onload = resolve;
    script.onerror = resolve;

    document.body.appendChild(script);
  });
}
async function cargarModuloGRUK(nombreModulo) {
  const contenedor = document.getElementById("contenidoPrincipalGRUK");

  if (!contenedor) {
    console.error("No existe contenidoPrincipalGRUK");
    return;
  }

  contenedor.dataset.moduloActual = nombreModulo;

  contenedor.innerHTML = `
    <div class="card">
      <p>Cargando módulo...</p>
    </div>
  `;


  try {
    cargarCSSModuloGRUK(nombreModulo);

    const res = await fetch(`/modulos/${nombreModulo}.html`);
    const html = await res.text();
    

    contenedor.innerHTML = html;
    await cargarScriptModuloGRUK(nombreModulo);
    await inicializarModuloGRUK(nombreModulo);

    const menu = document.getElementById("menuAdminGRUK");
    if (menu) menu.classList.remove("abierto");

  } catch (error) {
    console.error("Error cargando módulo:", error);

    contenedor.innerHTML = `
      <div class="card">
        <p>No se pudo cargar el módulo ${nombreModulo}.</p>
      </div>
    `;
  }
}

async function inicializarModuloGRUK(nombreModulo) {
  if (nombreModulo === "centro-control" && typeof inicializarCentroControlGRUK === "function") {
    await inicializarCentroControlGRUK();
  }
  if (nombreModulo === "recetas" && typeof inicializarRecetasGRUK === "function") {
  await inicializarRecetasGRUK();
}
if (nombreModulo === "costos" && typeof inicializarCostosGRUK === "function") {
  await inicializarCostosGRUK();
}

if (nombreModulo === "deudas" && typeof inicializarDeudasGRUK === "function") {
  inicializarDeudasGRUK();
}
if (nombreModulo === "mensajes" && typeof inicializarMensajesGRUK === "function") {
  await inicializarMensajesGRUK();
}
  if (nombreModulo === "restaurante" && typeof inicializarRestauranteGRUK === "function") {
    await inicializarRestauranteGRUK();
  }

  if (nombreModulo === "inventario" && typeof inicializarInventarioGRUK === "function") {
    await inicializarInventarioGRUK();
  }

  if (nombreModulo === "reportes" && typeof inicializarReportesGRUK === "function") {
    inicializarReportesGRUK();
  }

  if (nombreModulo === "configuracion" && typeof inicializarConfiguracionGRUK === "function") {
    inicializarConfiguracionGRUK();
  }

  if (nombreModulo === "finanzas" && typeof calcularFinanzasGRUK === "function") {
    const contenedor = document.getElementById("resultadoFinanzasGRUK");

    if (contenedor && typeof generarBloqueFinancieroGRUK === "function") {
      const f = await calcularFinanzasGRUK(getRestaurantId());
      contenedor.innerHTML = generarBloqueFinancieroGRUK(f);
    }
  }
}

function refrescarModuloActualGRUK() {
  const contenedor = document.getElementById("contenidoPrincipalGRUK");
  if (!contenedor) return;

  const moduloActual = contenedor.dataset.moduloActual;

  if (moduloActual) {
    inicializarModuloGRUK(moduloActual);
  }
}

socket.on("pedido:nuevo", (pedido) => {
  if (pedido.restaurantId === getRestaurantId()) {
    refrescarModuloActualGRUK();
  }
});

socket.on("pedido:actualizado", (pedido) => {
  if (pedido.restaurantId === getRestaurantId()) {
    refrescarModuloActualGRUK();
  }
});

socket.on("menu:actualizado", (payload) => {
  if (payload.restaurantId === getRestaurantId()) {
    refrescarModuloActualGRUK();
  }
});

socket.on("llamado:nuevo", (llamado) => {
  if (llamado.restaurantId === getRestaurantId()) {
    refrescarModuloActualGRUK();
  }
});

socket.on("llamado:actualizado", (llamado) => {
  if (llamado.restaurantId === getRestaurantId()) {
    refrescarModuloActualGRUK();
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  const adminRestaurantId =
    localStorage.getItem("adminRestaurantId") ||
    new URLSearchParams(window.location.search).get("restaurantId");

  const grukAuthToken =
    localStorage.getItem("grukAuthToken");

  if (!adminRestaurantId || !grukAuthToken) {
    window.location.href = "/login.html";
    return;
  }

  await cargarModuloGRUK("centro-control");
});