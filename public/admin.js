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

setTimeout(() => {
toast.remove();
}, 3000);

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
if (navigator.vibrate) {
navigator.vibrate(100);
}
}

const socket = io();
let productoEnEdicion = null;
let productosStockActuales = [];

function getRestaurantId() {
const input = document.getElementById("restaurantIdInput");
return input ? input.value.trim() || "rest1" : "rest1";
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

function actualizarLinksRestaurant() {
const restaurantId = getRestaurantId();
const baseUrl = window.location.origin;

const restaurantIdActual = document.getElementById("restaurantIdActual");
const linkMenu = document.getElementById("linkMenu");
const linkCocina = document.getElementById("linkCocina");
const linkMesero = document.getElementById("linkMesero");
const linkAdmin = document.getElementById("linkAdmin");
const linkDashboard = document.getElementById("linkDashboard");

if (restaurantIdActual) {
restaurantIdActual.textContent = restaurantId;
}

const menuUrl = `${baseUrl}/?restaurantId=${restaurantId}&mesa=1`;
const cocinaUrl = `${baseUrl}/cocina.html?restaurantId=${restaurantId}`;
const meseroUrl = `${baseUrl}/mesero.html?restaurantId=${restaurantId}`;
const adminUrl = `${baseUrl}/admin.html?restaurantId=${restaurantId}`;
const dashboardUrl = `${baseUrl}/admin-dashboard.html?restaurant=${restaurantId}&modo=manual`;
const dashboardAutoUrl = `${baseUrl}/admin-dashboard.html?restaurant=${restaurantId}`;
if (linkMenu) {
linkMenu.href = menuUrl;
linkMenu.textContent = menuUrl;
}

if (linkCocina) {
linkCocina.href = cocinaUrl;
linkCocina.textContent = cocinaUrl;
}

if (linkMesero) {
linkMesero.href = meseroUrl;
linkMesero.textContent = meseroUrl;
}
if (linkDashboard) {
linkDashboard.href = dashboardUrl;
linkDashboard.textContent = dashboardUrl;
}

const linkDashboardAuto =
document.getElementById("linkDashboardAuto");

if (linkDashboardAuto) {

linkDashboardAuto.href =
dashboardAutoUrl;

linkDashboardAuto.textContent =
dashboardAutoUrl;

}

if (linkAdmin) {
linkAdmin.href = adminUrl;
linkAdmin.textContent = adminUrl;
}
}


function generarQRs() {
const restaurantId = getRestaurantId();
const baseUrlInput = document.getElementById("baseUrl");
const numeroMesasInput = document.getElementById("numeroMesas");
const qrs = document.getElementById("qrs");

if (!qrs) return;

const baseUrl = (baseUrlInput?.value || window.location.origin).trim();
const numeroMesas = Number(numeroMesasInput?.value || 10);

qrs.innerHTML = "";

for (let mesa = 1; mesa <= numeroMesas; mesa++) {
const url = `${baseUrl}/?restaurantId=${restaurantId}&mesa=${mesa}`;
const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;

qrs.innerHTML += `
<div class="card">
<h3>Mesa ${mesa}</h3>
<img src="${qrUrl}" alt="QR Mesa ${mesa}" style="width:180px;height:180px;">
<p style="word-break: break-all;">${url}</p>
<a href="${url}" target="_blank">Abrir menú</a>
</div>
`;
}
}

function parsearGuarniciones(texto) {
if (!texto || !texto.trim()) return [];
return texto
.split(",")
.map(g => g.trim())
.filter(Boolean);
}

function parsearExtras(texto) {
if (!texto || !texto.trim()) return [];

return texto
.split(",")
.map(parte => {
const [nombre, precio] = parte.split(":");
return {
nombre: (nombre || "").trim(),
precio: Number((precio || "0").trim())
};
})
.filter(extra => extra.nombre);
}

function extrasATexto(extras) {
if (!Array.isArray(extras) || !extras.length) return "";
return extras
.map(extra => `${extra.nombre}:${extra.precio}`)
.join(", ");
}

function guarnicionesATexto(guarniciones) {
if (!Array.isArray(guarniciones) || !guarniciones.length) return "";
return guarniciones.join(", ");
}

async function cargarResumen(restaurantId) {
try {
const res = await fetch(`/api/admin/resumen?restaurantId=${restaurantId}`);
if (!res.ok) return;

const data = await res.json();

const totalVendido = document.getElementById("totalVendido");
const pedidosActivos = document.getElementById("pedidosActivos");

if (totalVendido) {
totalVendido.textContent = `$${data.totalVendido || 0}`;
}

if (pedidosActivos) {
pedidosActivos.textContent = data.pedidosActivos || 0;
}
} catch (error) {
console.log("Resumen admin no disponible:", error);
}
}

async function cargarTopProductos(restaurantId) {
try {
const res = await fetch(`/api/admin/resumen?restaurantId=${restaurantId}`);
if (!res.ok) return;

const data = await res.json();
const topProductos = document.getElementById("topProductos");
if (!topProductos) return;

topProductos.innerHTML = "";

const productos = data.topProductos || [];

if (!productos.length) {
topProductos.innerHTML = `
<div class="card">
<p>No hay datos todavía.</p>
</div>
`;
return;
}

productos.forEach(item => {
topProductos.innerHTML += `
<div class="card">
<h3>${item.producto}</h3>
<p>Vendidos: ${item.cantidad}</p>
</div>
`;
});
} catch (error) {
console.log("Top productos no disponible:", error);
}
}

async function cargarHistorialVentas(restaurantId) {
try {
const res = await fetch(`/api/admin/resumen?restaurantId=${restaurantId}`);
if (!res.ok) return;

const data = await res.json();
const historialVentas = document.getElementById("historialVentas");
if (!historialVentas) return;

historialVentas.innerHTML = "";

const historial = data.historial || [];

if (!historial.length) {
historialVentas.innerHTML = `
<div class="card">
<p>No hay ventas todavía.</p>
</div>
`;
return;
}

historial.forEach(item => {
historialVentas.innerHTML += `
<div class="card">
<h3>${item.producto || "Venta"}</h3>
<p>Mesa: ${item.mesa || "-"}</p>
<p>Valor: $${item.precio || 0}</p>
<p>Estado pago: ${item.estadoPago || "-"}</p>
</div>
`;
});
} catch (error) {
console.log("Historial ventas no disponible:", error);
}
}

async function cargarSolicitudesMesero(restaurantId) {
try {
const res = await fetch(`/api/llamados?restaurantId=${restaurantId}`);
if (!res.ok) return;

const data = await res.json();
const solicitudesMesero = document.getElementById("solicitudesMesero");
if (!solicitudesMesero) return;

solicitudesMesero.innerHTML = "";

const pendientes = data.filter(item => item.estado !== "atendido");

if (!pendientes.length) {
solicitudesMesero.innerHTML = `
<div class="card">
<p>No hay solicitudes de mesero.</p>
</div>
`;
return;
}

pendientes.forEach(item => {
solicitudesMesero.innerHTML += `
<div class="card">
<h3>Mesa ${item.mesa} necesita al mesero ${item.meseroNombre || "sin asignar"}</h3>
<p>${tiempoTranscurrido(item.createdAt)}</p>
<p>Estado: ${
item.estado === "atendiendo"
? "🟡 Atendiendo..."
: "🔴 Pendiente"
}</p>
</div>
`;
});
} catch (error) {
console.log("Solicitudes de mesero no disponibles:", error);
}
}

async function cargarStock(restaurantId) {
try {
const res = await fetch(`/api/menu?restaurantId=${restaurantId}`);
if (!res.ok) return;

const data = await res.json();
productosStockActuales = data;

const stockLista = document.getElementById("stockLista");
if (!stockLista) return;

stockLista.innerHTML = "";

if (!data.length) {
stockLista.innerHTML = `
<div class="card">
<p>No hay productos todavía.</p>
</div>
`;
return;
}

data.forEach(item => {
const descripcion = item.descripcion || "Sin descripción";
const guarniciones = Array.isArray(item.guarniciones) && item.guarniciones.length
? item.guarniciones.join(", ")
: "Sin guarniciones";
const extras = Array.isArray(item.extras) && item.extras.length
? item.extras.map(extra => `${extra.nombre} (+$${extra.precio})`).join(", ")
: "Sin extras";

stockLista.innerHTML += `
<div class="card">
<h3>${item.nombre}</h3>
<p><strong>Categoría:</strong> ${item.categoria}</p>
<p><strong>Descripción:</strong> ${descripcion}</p>
<p><strong>Precio:</strong> $${item.precio}</p>
<p><strong>Guarniciones:</strong> ${guarniciones}</p>
<p><strong>Extras:</strong> ${extras}</p>
<p><strong>Disponible:</strong> ${item.disponible ? "Sí" : "No"}</p>

<button onclick="editarProductoPorId(${item.id})">Editar</button>

<button onclick="cambiarStock(${item.id}, ${!item.disponible})">
${item.disponible ? "Marcar como agotado" : "Marcar como disponible"}
</button>
<button onclick="eliminarProducto(${item.id})">Eliminar</button>
<button onclick="marcarProductoRecomendado('${item.nombre}')">
⭐ Recomendado
</button>
</div>
`;
});
} catch (error) {
console.log("Stock no disponible:", error);
}
}

function editarProductoPorId(id) {
const item = productosStockActuales.find(producto => Number(producto.id) === Number(id));

if (!item) {
alert("No se encontró el producto para editar");
return;
}

editarProducto(item);
}

function editarProducto(item) {
productoEnEdicion = item.id;

document.getElementById("nombreProducto").value = item.nombre || "";
document.getElementById("descripcionProducto").value = item.descripcion || "";
document.getElementById("precioProducto").value = item.precio || "";
document.getElementById("categoriaProducto").value = item.categoria || "Comida";
document.getElementById("guarnicionesProducto").value = guarnicionesATexto(item.guarniciones);
document.getElementById("extrasProducto").value = extrasATexto(item.extras);
document.getElementById("imagenProducto").value = item.imagen || "";
document.getElementById("tiempoProducto").value = item.tiempoBase || 10;
document.getElementById("disponibleProducto").value = item.disponible ? "true" : "false";

document.getElementById("btnGuardarProducto").textContent = "Actualizar producto";
document.getElementById("btnCancelarEdicion").style.display = "inline-block";

window.scrollTo({
top: 0,
behavior: "smooth"
});
}

function limpiarFormularioProducto() {
document.getElementById("nombreProducto").value = "";
document.getElementById("descripcionProducto").value = "";
document.getElementById("precioProducto").value = "";
document.getElementById("categoriaProducto").value = "Comida";
document.getElementById("guarnicionesProducto").value = "";
document.getElementById("extrasProducto").value = "";
document.getElementById("imagenProducto").value = "";
document.getElementById("tiempoProducto").value = 10;
document.getElementById("disponibleProducto").value = "true";
}

function cancelarEdicion() {
productoEnEdicion = null;
limpiarFormularioProducto();

document.getElementById("btnGuardarProducto").textContent = "Guardar producto";
document.getElementById("btnCancelarEdicion").style.display = "none";
}

async function guardarOEditarProducto() {
try {
const restaurantId = getRestaurantId();

const nombreInput = document.getElementById("nombreProducto");
const descripcionInput = document.getElementById("descripcionProducto");
const precioInput = document.getElementById("precioProducto");
const categoriaInput = document.getElementById("categoriaProducto");
const guarnicionesInput = document.getElementById("guarnicionesProducto");
const extrasInput = document.getElementById("extrasProducto");
const imagenInput = document.getElementById("imagenProducto");
const tiempoInput = document.getElementById("tiempoProducto");
const disponibleInput = document.getElementById("disponibleProducto");

if (
!nombreInput ||
!descripcionInput ||
!precioInput ||
!categoriaInput ||
!guarnicionesInput ||
!extrasInput ||
!imagenInput ||
!tiempoInput ||
!disponibleInput
) {
alert("Faltan campos del formulario");
return;
}

const nombre = nombreInput.value.trim();
const descripcion = descripcionInput.value.trim();
const precio = Number(precioInput.value || 0);
const categoria = categoriaInput.value;
const guarniciones = parsearGuarniciones(guarnicionesInput.value);
const extras = parsearExtras(extrasInput.value);
const imagen = imagenInput.value.trim();
const tiempoBase = Number(tiempoInput.value || 10);
const disponible = disponibleInput.value === "true";

if (!nombre) {
alert("Escribe el nombre del producto");
return;
}

if (precio <= 0) {
alert("El precio debe ser mayor a 0");
return;
}

let res;

const payload = {
restaurantId,
nombre,
descripcion,
precio,
categoria,
guarniciones,
extras,
imagen,
tiempoBase,
disponible
};

if (productoEnEdicion) {
res = await fetch(`/api/menu/${productoEnEdicion}?restaurantId=${restaurantId}`, {
method: "PUT",
headers: {
"Content-Type": "application/json"
},
body: JSON.stringify(payload)
});
} else {
res = await fetch("/api/menu", {
method: "POST",
headers: {
"Content-Type": "application/json"
},
body: JSON.stringify(payload)
});
}

const data = await res.json();

if (!res.ok) {
alert(data.error || "No se pudo guardar el producto");
return;
}

alert(productoEnEdicion ? "Producto actualizado correctamente" : "Producto agregado correctamente");

cancelarEdicion();
cargarAdmin();
} catch (error) {
console.log("ERROR GUARDANDO PRODUCTO", error);
alert("Error guardando producto");
}
}

async function cambiarStock(id, disponible) {
try {
const restaurantId = getRestaurantId();

const res = await fetch(`/api/menu/${id}/stock?restaurantId=${restaurantId}`, {
method: "PUT",
headers: {
"Content-Type": "application/json"
},
body: JSON.stringify({ disponible })
});

const data = await res.json();

if (!res.ok) {
alert(data.mensaje || "No se pudo actualizar el stock");
return;
}

cargarAdmin();
} catch (error) {
console.log("Error actualizando stock:", error);
alert("Error actualizando stock");
}
}

async function eliminarProducto(id) {
try {
const restaurantId = getRestaurantId();
const confirmar = confirm("¿Seguro que quieres eliminar este producto?");
if (!confirmar) return;

const res = await fetch(`/api/menu/${id}?restaurantId=${restaurantId}`, {
method: "DELETE"
});

const data = await res.json();

if (!res.ok) {
alert(data.error || "No se pudo eliminar el producto");
return;
}

alert("Producto eliminado correctamente");
cargarAdmin();
} catch (error) {
console.log("ERROR ELIMINANDO PRODUCTO", error);
alert("Error eliminando producto");
}
}

async function agregarPersonal() {
try {
const restaurantId = getRestaurantId();

const nombre = document.getElementById("nombrePersonal").value.trim();
const cargo = document.getElementById("cargoPersonal").value;
const estado = document.getElementById("estadoPersonal").value;
const usuario = document.getElementById("usuarioPersonal").value.trim();
const password = document.getElementById("passwordPersonal").value.trim();

if (!nombre || !usuario || !password) {
alert("Completa nombre, usuario y contraseña");
return;
}

const res = await fetch("/api/personal", {
method: "POST",
headers: {
"Content-Type": "application/json"
},
body: JSON.stringify({
restaurantId,
nombre,
cargo,
estado,
usuario,
password
})
});

const data = await res.json();

if (!res.ok) {
alert(data.error || "No se pudo guardar el personal");
return;
}

alert("Personal agregado correctamente");

document.getElementById("nombrePersonal").value = "";
document.getElementById("cargoPersonal").value = "mesero";
document.getElementById("estadoPersonal").value = "disponible";
document.getElementById("usuarioPersonal").value = "";
document.getElementById("passwordPersonal").value = "";

cargarAdmin();
} catch (error) {
console.log("Error agregando personal:", error);
alert("Error agregando personal");
}
}

async function eliminarPersonal(id) {
try {
const res = await fetch(`/api/personal/${id}`, {
method: "DELETE"
});

const data = await res.json();

if (!res.ok) {
alert(data.error || "No se pudo eliminar el personal");
return;
}

alert("Personal eliminado correctamente");
cargarAdmin();
} catch (error) {
console.log("Error eliminando personal:", error);
alert("Error eliminando personal");
}
}

async function cambiarEstadoPersonal(id, nuevoEstado) {
try {
const res = await fetch(`/api/personal/${id}/estado`, {
method: "PUT",
headers: {
"Content-Type": "application/json"
},
body: JSON.stringify({ estado: nuevoEstado })
});

const data = await res.json();

if (!res.ok) {
alert(data.error || "No se pudo cambiar el estado");
return;
}

cargarAdmin();
} catch (error) {
console.log("Error cambiando estado del personal:", error);
alert("Error cambiando estado");
}
}

async function cargarPersonal(restaurantId) {
try {
const res = await fetch(`/api/personal?restaurantId=${restaurantId}`);
if (!res.ok) return;

const data = await res.json();
const listaPersonal = document.getElementById("listaPersonal");
if (!listaPersonal) return;

listaPersonal.innerHTML = "";

if (!data.length) {
listaPersonal.innerHTML = `
<div class="card">
<p>No hay personal registrado.</p>
</div>
`;
return;
}

data.forEach(persona => {
listaPersonal.innerHTML += `
<div class="card">
<h3>${persona.nombre}</h3>
<p>Cargo: ${persona.cargo}</p>
<p>Estado: ${persona.estado === "disponible" ? "🟢 Disponible" : "🔴 Ocupado"}</p>
<p>Usuario: ${persona.usuario || "-"}</p>
<p>Contraseña: ${persona.password || "-"}</p>

<button onclick="cambiarEstadoPersonal('${persona._id}', '${persona.estado === "disponible" ? "ocupado" : "disponible"}')">
${persona.estado === "disponible" ? "Marcar ocupado" : "Marcar disponible"}
</button>

<button onclick="eliminarPersonal('${persona._id}')">Eliminar</button>
</div>
`;
});
} catch (error) {
console.log("Error cargando personal:", error);
}
}

async function cargarAdmin() {
const restaurantId = getRestaurantId();

actualizarLinksRestaurant();

await cargarResumen(restaurantId);
await cargarTopProductos(restaurantId);
await cargarHistorialVentas(restaurantId);
await cargarSolicitudesMesero(restaurantId);
await cargarStock(restaurantId);
await cargarPersonal(restaurantId);
}

const baseUrlInput = document.getElementById("baseUrl");
if (baseUrlInput) {
baseUrlInput.value = window.location.origin;
}

const params = new URLSearchParams(window.location.search);
const restaurantIdUrl =
params.get("restaurantId") ||
localStorage.getItem("adminRestaurantId") ||
"rest1";

const restaurantIdInput = document.getElementById("restaurantIdInput");
if (restaurantIdInput) {
restaurantIdInput.value = restaurantIdUrl;
}

socket.on("pedido:nuevo", (pedido) => {
if (pedido.restaurantId === getRestaurantId()) {
cargarAdmin();
}
});

socket.on("pedido:actualizado", (pedido) => {
if (pedido.restaurantId === getRestaurantId()) {
cargarAdmin();
}
});

socket.on("menu:actualizado", (payload) => {
if (payload.restaurantId === getRestaurantId()) {
cargarAdmin();
}
});

socket.on("llamado:nuevo", (llamado) => {
if (llamado.restaurantId === getRestaurantId()) {
cargarAdmin();
}
});

socket.on("llamado:actualizado", (llamado) => {
if (llamado.restaurantId === getRestaurantId()) {
cargarAdmin();
}
});

setInterval(() => {
cargarAdmin();
}, 10000);
function guardarDatosDashboard() {
}
const restaurantId = getRestaurantId();

let datosManualDashboard = [];

function getRestaurantIdManual() {
  const input = document.getElementById("restaurantIdInput");
  return input ? input.value || "rest1" : "rest1";
}

function agregarDatoManualDashboard() {
  const producto = document.getElementById("productoManual").value.trim();
  const cantidad = Number(document.getElementById("cantidadManual").value);
  const precio = Number(document.getElementById("precioManual").value);

  if (!producto || cantidad <= 0 || precio <= 0) {
    alert("Completa producto, cantidad y precio correctamente.");
    return;
  }

  datosManualDashboard.push({
    producto,
    ventas: cantidad,
    totalDinero: cantidad * precio,
    precioUnitario: precio
  });

  document.getElementById("productoManual").value = "";
  document.getElementById("cantidadManual").value = "";
  document.getElementById("precioManual").value = "";

  pintarDatosManualDashboard();
}

function pintarDatosManualDashboard() {
  const lista = document.getElementById("listaDatosManual");

  if (!lista) return;

  if (datosManualDashboard.length === 0) {
    lista.innerHTML = "<p>No hay datos manuales agregados.</p>";
    return;
  }

  lista.innerHTML = datosManualDashboard.map((item, index) => `
    <div class="card">
      <strong>${item.producto}</strong>
      <p>Cantidad: ${item.ventas}</p>
      <p>Precio unitario: $${item.precioUnitario.toLocaleString("es-CO")}</p>
      <p>Total: $${item.totalDinero.toLocaleString("es-CO")}</p>
      <button onclick="eliminarDatoManualDashboard(${index})">Eliminar</button>
    </div>
  `).join("");
}

function eliminarDatoManualDashboard(index) {
  datosManualDashboard.splice(index, 1);
  pintarDatosManualDashboard();
}

function guardarDatosManualDashboard() {
  const restaurantId = getRestaurantIdManual();

  if (datosManualDashboard.length === 0) {
    alert("Primero agrega al menos un producto.");
    return;
  }

  localStorage.setItem(
    `dashboard_manual_${restaurantId}`,
    JSON.stringify(datosManualDashboard)
  );

  alert("Datos manuales guardados para el dashboard.");
}

function limpiarDatosManualDashboard() {
  const restaurantId = getRestaurantIdManual();

  datosManualDashboard = [];
  localStorage.removeItem(`dashboard_manual_${restaurantId}`);

  pintarDatosManualDashboard();

  alert("Datos manuales eliminados.");
}

document.addEventListener("DOMContentLoaded", () => {
  const restaurantId = getRestaurantIdManual();

  datosManualDashboard =
    JSON.parse(localStorage.getItem(`dashboard_manual_${restaurantId}`)) || [];

  pintarDatosManualDashboard();
});
function cargarEstrategiasAplicadas() {

const contenedor =
document.getElementById("estrategiasAplicadas");

if (!contenedor) return;

const restaurantId = getRestaurantId();

const estrategias =
JSON.parse(
localStorage.getItem(`estrategias_${restaurantId}`)
) || [];

if (estrategias.length === 0) {

contenedor.innerHTML = `
<div class="card">
No hay estrategias aplicadas.
</div>
`;

return;
}

contenedor.innerHTML = estrategias.map(e => `

<div class="card">

<h3>
Estrategia ${e.numero}
</h3>

<p>
<strong>${e.titulo}</strong>
</p>

<p>
Productos involucrados:
</p>

<ul>
${(e.productos || [])
.map(p => `<li>${p}</li>`)
.join("")}
</ul>

</div>

`).join("");

}

function aplicarDatosEstrategiaMenu() {

const restaurantId = getRestaurantId();

const estrategias =
JSON.parse(
localStorage.getItem(`estrategias_${restaurantId}`)
) || [];

const estrategiaTop =
estrategias.find(e => e.numero == 3);

if (!estrategiaTop) return;

localStorage.setItem(

`masVendidos_${restaurantId}`,

JSON.stringify(
estrategiaTop.productos || []
)

);

}
function cargarProductosRecomendadosAdmin() {
  const contenedor = document.getElementById("productosRecomendadosAdmin");
  if (!contenedor) return;

  const restaurantId = getRestaurantId();

  const productos =
    JSON.parse(localStorage.getItem(`productos_recomendados_${restaurantId}`)) || [];

  if (productos.length === 0) {
    contenedor.innerHTML = `
      <div class="card">
        No hay productos recomendados todavía. Aplica la estrategia “Los más pedidos” desde el dashboard.
      </div>
    `;
    return;
  }

  contenedor.innerHTML = productos.map(producto => `
    <div class="card">
      <h3>${producto}</h3>
      <p>Producto recomendado en el menú.</p>
    </div>
  `).join("");
}
function getRecomendadosKey() {
  return `productos_recomendados_${getRestaurantId()}`;
}

function obtenerProductosRecomendadosAdmin() {
  return JSON.parse(localStorage.getItem(getRecomendadosKey())) || [];
}

function guardarProductosRecomendadosAdmin(lista) {
  localStorage.setItem(getRecomendadosKey(), JSON.stringify(lista));
}

function marcarProductoRecomendado(nombreProducto) {
  let lista = obtenerProductosRecomendadosAdmin();

  if (lista.includes(nombreProducto)) {
    lista = lista.filter(p => p !== nombreProducto);
    alert(`${nombreProducto} quitado de recomendados`);
  } else {
    lista.push(nombreProducto);
    alert(`${nombreProducto} agregado a recomendados`);
  }
  

  guardarProductosRecomendadosAdmin(lista);
  cargarAdmin();
}


document.addEventListener("DOMContentLoaded", cargarProductosRecomendadosAdmin);

actualizarLinksRestaurant();

aplicarDatosEstrategiaMenu();

cargarEstrategiasAplicadas();

cargarAdmin();
const restaurantIdActual =
  new URLSearchParams(window.location.search)
  .get("restaurantId");

const linkLogo =
  document.getElementById("linkLogoRestaurante");

if (linkLogo && restaurantIdActual) {

  linkLogo.href =
    `/admin-restaurante.html?restaurantId=${restaurantIdActual}`;

}

const paramsLogo = new URLSearchParams(window.location.search);
const restaurantIdLogo = paramsLogo.get("restaurantId");

async function cargarLogo() {

  const res = await fetch(
    `/api/restaurants/${restaurantIdLogo}`
  );

  const data = await res.json();

  if (data.ok && data.restaurante.logoUrl) {

    document.body.style.setProperty(
      "--fondo-restaurante",
      `url(${data.restaurante.logoUrl})`
    );

    document.getElementById("logoRestaurante").src =
      data.restaurante.logoUrl;

  }
}

cargarLogo();
function analizarGasto() {
  const nombre = document.getElementById("nombreGasto").value.trim();
  const valor = Number(document.getElementById("valorGasto").value);
  const categoria = document.getElementById("categoriaGasto").value;
  const impacto = document.getElementById("impactoGasto").value;
  const observacion = document.getElementById("observacionGasto").value.trim();

  if (!nombre || !valor || !categoria || !impacto) {
    alert("Completa todos los datos del gasto");
    return;
  }

  const textoAnalisis = `${nombre} ${categoria} ${observacion}`.toLowerCase();

  const esCampanaGanadora =
    textoAnalisis.includes("black friday") ||
    textoAnalisis.includes("tráfico") ||
    textoAnalisis.includes("trafico") ||
    textoAnalisis.includes("roi") ||
    textoAnalisis.includes("retorno") ||
    textoAnalisis.includes("quebró stock") ||
    textoAnalisis.includes("quebro stock") ||
    textoAnalisis.includes("agotó stock") ||
    textoAnalisis.includes("agoto stock") ||
    textoAnalisis.includes("vendimos todo");

  if (impacto === "alto" && esCampanaGanadora) {
    const aumentoSugerido = Math.round(valor * 1.6);
    const presupuestoMinimo = Math.round(valor * 1.25);
    const presupuestoMaximo = Math.round(valor * 2);
    const reservaStock = 35;

    document.getElementById("resultadoControlGasto").innerHTML = `
      <div class="card">
        <h3>Método 4 — Escalamiento controlado de campaña ganadora</h3>

        <p><strong>Gasto analizado:</strong> ${nombre}</p>
        <p><strong>Categoría:</strong> ${categoria}</p>
        <p><strong>Valor registrado:</strong> $${valor.toLocaleString("es-CO")}</p>

        <p><strong>Diagnóstico experto:</strong><br>
        Este gasto no debe tratarse como un costo a reducir. La observación muestra señales de campaña ganadora: aumento fuerte de tráfico, retorno inmediato y agotamiento de inventario. En este escenario, el problema no fue gastar demasiado, sino no haber preparado suficiente capacidad para capturar toda la demanda generada.
        </p>

        <p><strong>Análisis financiero:</strong><br>
        Cuando una campaña genera retorno inmediato y quiebra stock, el gasto se comporta como inversión comercial validada. La decisión prudente no es recortar, sino escalar con protección: aumentar presupuesto, pero acompañado de inventario, medición y límite de pérdida.
        </p>

        <p><strong>Decisión recomendada:</strong><br>
        Escalar la campaña en la siguiente fecha comercial equivalente, no repetirla mecánicamente el próximo mes.
        </p>

        <p><strong>Recomendación estratégica:</strong><br>
        Para una próxima campaña tipo Black Friday, Hot Sale o temporada de descuentos, se recomienda aumentar el presupuesto de $${valor.toLocaleString("es-CO")} a un rango entre $${presupuestoMinimo.toLocaleString("es-CO")} y $${presupuestoMaximo.toLocaleString("es-CO")}. El punto sugerido inicial sería $${aumentoSugerido.toLocaleString("es-CO")}, siempre que el restaurante prepare inventario suficiente y mida ventas por producto.
        </p>

        <p><strong>Impacto proyectado:</strong><br>
        Si el comportamiento se repite, un aumento controlado del presupuesto podría elevar la captación comercial entre un 25% y un 60%. Sin embargo, debe acompañarse con mínimo ${reservaStock}% más de inventario en los productos principales para no perder ventas por agotamiento.
        </p>

        <p><strong>Uso recomendado del dinero adicional:</strong><br>
        60% en el canal que ya demostró conversión, 25% en inventario de los productos que agotaron stock, 10% en refuerzo operativo para atención rápida y 5% en reserva de contingencia.
        </p>

        <p><strong>Control de riesgo:</strong><br>
        No aumentar presupuesto sin límite. El aumento debe estar condicionado a tres indicadores: costo por pedido, unidades vendidas por producto y velocidad de agotamiento. Si alguno cae más del 20%, se debe frenar la inversión.
        </p>

        <p><strong>Observación registrada:</strong><br>
        ${observacion || "Sin observación adicional."}
        </p>
      </div>
    `;
    return;
  }

  const metodos = [
    {
      nombre: "Método 1 — Optimización operativa inteligente",
      aplica: impacto === "bajo",
      reduccion: 35,
      mejoraRotacion: 30,
      mejoraLiquidez: 25,
      tesis: "El gasto no demuestra retorno suficiente frente al dinero invertido.",
      analisis: `El gasto en ${nombre} representa una salida de dinero que no evidencia aumento de ventas, mejora de tiempos, mayor rotación ni eficiencia interna. En términos empresariales, es un gasto que reduce capacidad de maniobra porque consume recursos que podrían trabajar mejor en otra parte del restaurante.`,
      recomendacion: `Se recomienda reducir este gasto de forma controlada y redirigir el dinero hacia productos de alta rotación, insumos esenciales o procesos que generen flujo de caja más rápido. La decisión no debe basarse en gastar menos por gastar menos, sino en usar el dinero donde produzca más valor operativo.`,
      accion: "Reducir, medir y reasignar el gasto."
    },
    {
      nombre: "Método 2 — Validación de retorno financiero",
      aplica: impacto === "medio",
      reduccion: 20,
      mejoraRotacion: 18,
      mejoraLiquidez: 15,
      tesis: "El gasto tiene utilidad parcial, pero todavía no justifica completamente su valor.",
      analisis: `El gasto en ${nombre} puede estar ayudando al restaurante, pero su beneficio no es completamente verificable. Cuando un gasto no demuestra con claridad que mejora ventas, calidad, tiempos o experiencia del cliente, debe tratarse como un gasto bajo observación.`,
      recomendacion: `Se recomienda mantenerlo solo parcialmente durante el próximo mes, reducir su valor y medir si el resultado del restaurante cambia. Si las ventas, tiempos o satisfacción no disminuyen, significa que el restaurante estaba pagando más de lo necesario.`,
      accion: "Reducir parcialmente y comprobar si realmente genera retorno."
    },
    {
      nombre: "Método 3 — Ajuste estratégico de inversión",
      aplica: impacto === "alto",
      reduccion: 8,
      mejoraRotacion: 10,
      mejoraLiquidez: 8,
      tesis: "El gasto sí parece útil, pero puede optimizarse sin perder el beneficio.",
      analisis: `El gasto en ${nombre} genera un resultado visible, por lo que no debe eliminarse. Sin embargo, incluso un gasto útil puede estar sobrepagado si no se comparan proveedores, cantidades, precios, frecuencia de compra o condiciones de negociación.`,
      recomendacion: `Se recomienda conservar este gasto, pero buscar una optimización mínima mediante negociación, compra planificada, mejor proveedor o ajuste de cantidades. El objetivo es mantener el beneficio, pero disminuir el costo.`,
      accion: "Mantener, negociar y optimizar."
    }
  ];

  const metodo = metodos.find(m => m.aplica);
  const ahorro = Math.round(valor * (metodo.reduccion / 100));
  const nuevoGasto = valor - ahorro;

  document.getElementById("resultadoControlGasto").innerHTML = `
    <div class="card">
      <h3>${metodo.nombre}</h3>

      <p><strong>Gasto analizado:</strong> ${nombre}</p>
      <p><strong>Categoría:</strong> ${categoria}</p>
      <p><strong>Valor registrado:</strong> $${valor.toLocaleString("es-CO")}</p>

      <p><strong>Diagnóstico experto:</strong><br>${metodo.tesis}</p>

      <p><strong>Análisis financiero:</strong><br>${metodo.analisis}</p>

      <p><strong>Decisión recomendada:</strong><br>${metodo.accion}</p>

      <p><strong>Recomendación estratégica:</strong><br>${metodo.recomendacion}</p>

      <p><strong>Impacto proyectado:</strong><br>
      Si el próximo mes se aplica una reducción del ${metodo.reduccion}%, el gasto bajaría de
      $${valor.toLocaleString("es-CO")} a $${nuevoGasto.toLocaleString("es-CO")}.
      Esto liberaría aproximadamente $${ahorro.toLocaleString("es-CO")} para ser usado en áreas de mayor rendimiento.
      </p>

      <p><strong>Proyección operativa:</strong><br>
      Si el capital liberado se reasigna correctamente, podría mejorar hasta un ${metodo.mejoraRotacion}% la rotación de productos priorizados y hasta un ${metodo.mejoraLiquidez}% la disponibilidad de dinero operativo mensual.
      </p>

      <p><strong>Uso recomendado del dinero liberado:</strong><br>
      Reasignarlo en un 50% a productos de mayor rotación, 25% a negociación o compra eficiente de insumos, 15% a mejora de tiempos de atención y 10% a reserva operativa para evitar gastos impulsivos.
      </p>

      <p><strong>Observación registrada:</strong><br>
      ${observacion || "Sin observación adicional."}
      </p>
    </div>
  `;
}