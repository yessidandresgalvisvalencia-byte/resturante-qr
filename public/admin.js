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
  const objetivo = document.getElementById("objetivoGasto").value;
  const observacion = document.getElementById("observacionGasto").value.trim();

  if (!nombre || !valor || !categoria || !impacto || !objetivo) {
    alert("Completa todos los datos del gasto");
    return;
  }

  const texto = `${nombre} ${categoria} ${objetivo} ${observacion}`.toLowerCase();

  const contiene = (palabras) =>
    palabras.some(palabra => texto.includes(palabra));

  const esCampanaGanadora = contiene([
    "black friday",
    "hot sale",
    "tráfico",
    "trafico",
    "roi",
    "retorno",
    "vendimos todo",
    "quebró stock",
    "quebro stock",
    "agotó stock",
    "agoto stock",
    "stock agotado",
    "triplicó",
    "triplico",
    "duplicó",
    "duplico"
  ]);

  const esExperienciaCliente = contiene([
    "clientes felices",
    "cliente feliz",
    "satisfacción",
    "satisfaccion",
    "fidelización",
    "fidelizacion",
    "recompra",
    "quejas",
    "espera",
    "fila",
    "atención",
    "atencion",
    "experiencia",
    "tiempo de espera",
    "servicio"
  ]);

  const esInfraestructura = contiene([
    "infraestructura",
    "equipo",
    "equipos",
    "maquinaria",
    "nevera",
    "horno",
    "licuadora",
    "computador",
    "tablet",
    "mobiliario",
    "sillas",
    "mesas",
    "adecuación",
    "adecuacion"
  ]);

  const esOperacionBase =
    objetivo === "operacion" ||
    contiene([
      "arriendo",
      "nómina",
      "nomina",
      "servicios",
      "luz",
      "agua",
      "gas",
      "internet",
      "software",
      "domicilio",
      "transporte",
      "mantenimiento"
    ]);

  let metodo = "";
  let diagnostico = "";
  let analisis = "";
  let decision = "";
  let recomendacion = "";
  let porcentajeCambio = 0;
  let tipoCambio = "reducción";
  let usoDinero = "";
  let controlRiesgo = "";
  let nuevoValor = valor;

  if (impacto === "alto" && esCampanaGanadora && objetivo === "ventas") {
    metodo = "Método 4 — Escalamiento controlado de oportunidad validada";
    tipoCambio = "aumento";
    porcentajeCambio = 60;
    nuevoValor = Math.round(valor * 1.6);

    diagnostico =
      "El gasto muestra señales de oportunidad validada: generó demanda, retorno inmediato o agotamiento de stock. No debe tratarse como un gasto a recortar.";

    analisis =
      `El gasto en ${nombre} funcionó como una inversión comercial comprobada. Cuando el mercado responde con tráfico, ventas o quiebre de inventario, el problema no es haber gastado, sino no haber preparado suficiente capacidad para capturar toda la demanda.`;

    decision =
      "Escalar en la próxima fecha comercial equivalente, no repetir mecánicamente en un mes normal.";

    recomendacion =
      `Aumentar el presupuesto de forma controlada de $${valor.toLocaleString("es-CO")} a cerca de $${nuevoValor.toLocaleString("es-CO")}, pero solo para eventos equivalentes como Black Friday, temporada de descuentos o campañas con demanda comparable.`;

    usoDinero =
      "60% al canal que ya convirtió, 25% a inventario de productos ganadores, 10% a refuerzo operativo y 5% a reserva de contingencia.";

    controlRiesgo =
      "Si el costo por pedido sube más del 20%, si la rotación cae o si el stock no alcanza, se debe frenar la inversión. Escalar sin medición sería especulación, no estrategia.";
  }

  else if (esExperienciaCliente && objetivo === "fidelizacion") {
    metodo = "Método 5 — Protección de retención y experiencia";
    tipoCambio = "ajuste";
    porcentajeCambio = impacto === "bajo" ? 10 : impacto === "medio" ? 5 : 0;
    nuevoValor = Math.round(valor * (1 - porcentajeCambio / 100));

    diagnostico =
      "Este gasto pertenece a experiencia de cliente. Aunque no siempre aumenta el ticket inmediato, puede proteger recompra, reputación y retención.";

    analisis =
      `El gasto en ${nombre} no debe evaluarse solo por ventas inmediatas. Si reduce filas, tiempos de espera, quejas o mejora satisfacción, puede estar defendiendo ingresos futuros. Recortarlo sin medir retención puede generar ahorro aparente y pérdida comercial posterior.`;

    decision =
      porcentajeCambio > 0
        ? "Ajustar de forma leve y medir experiencia antes de recortar fuerte."
        : "Mantener y medir indicadores de fidelización.";

    recomendacion =
      `Antes de reducir este gasto, mide quejas, tiempo de espera, calificaciones, recompra y comentarios de clientes. Si esos indicadores mejoran, el gasto debe mantenerse o rediseñarse, no eliminarse.`;

    usoDinero =
      "40% a experiencia directa del cliente, 25% a reducción de tiempos, 20% a capacitación o servicio y 15% a medición de satisfacción.";

    controlRiesgo =
      "No recortar más del 10% sin comparar indicadores de satisfacción. El ahorro inmediato puede destruir valor si aumenta la pérdida de clientes.";
  }

  else if (esInfraestructura) {
    metodo = "Método 6 — Evaluación de activo operativo";
    tipoCambio = "amortización";
    porcentajeCambio = 0;
    nuevoValor = valor;

    diagnostico =
      "Este gasto parece ser infraestructura o equipo. No debe juzgarse como gasto mensual simple, sino como activo operativo que debe producir eficiencia durante varios periodos.";

    analisis =
      `El gasto en ${nombre} debe evaluarse por uso, duración, ahorro de tiempo, reducción de errores o aumento de capacidad. Si el equipo permite producir más, atender más rápido o bajar desperdicio, su valor debe medirse en varios meses, no solo en el día de compra.`;

    decision =
      "Mantener, medir uso real y calcular recuperación del valor.";

    recomendacion =
      "Divide el valor del gasto entre los meses de uso esperado. Luego compara si el ahorro de tiempo, aumento de producción o reducción de desperdicio supera esa cuota mensual.";

    usoDinero =
      "70% debe justificarse por capacidad productiva, 20% por reducción de tiempos y 10% por mantenimiento preventivo.";

    controlRiesgo =
      "Si el equipo no se usa de forma recurrente o no reduce costos, se convierte en capital inmovilizado. Debe tener responsable, frecuencia de uso y métrica de recuperación.";
  }

  else if (esOperacionBase) {
    metodo = "Método 7 — Control de gasto estructural";
    tipoCambio = "renegociación";
    porcentajeCambio = impacto === "bajo" ? 12 : impacto === "medio" ? 8 : 5;
    nuevoValor = Math.round(valor * (1 - porcentajeCambio / 100));

    diagnostico =
      "Este gasto parece operativo o fijo. No debe eliminarse de forma agresiva, pero sí revisarse porque puede volverse una carga silenciosa.";

    analisis =
      `El gasto en ${nombre} sostiene la operación base del restaurante. En estos casos, la estrategia no es cortar sin criterio, sino renegociar, comparar proveedores, controlar consumo y evitar que el costo fijo crezca más rápido que las ventas.`;

    decision =
      "Renegociar, controlar consumo y buscar eficiencia gradual.";

    recomendacion =
      `Buscar una mejora del ${porcentajeCambio}% mediante negociación, cambio de proveedor, consumo eficiente o revisión de frecuencia.`;

    usoDinero =
      "50% del ahorro debe ir a liquidez operativa, 30% a insumos críticos y 20% a reserva para pagos fijos.";

    controlRiesgo =
      "No comprometer la continuidad operativa. Si el recorte afecta servicio, tiempos o calidad, debe revertirse.";
  }

  else if (impacto === "bajo") {
    metodo = "Método 1 — Corrección de gasto sin retorno";
    tipoCambio = "reducción";
    porcentajeCambio =
      categoria === "Publicidad" ? 25 :
      categoria === "Personal" ? 12 :
      categoria === "Equipos" ? 10 :
      categoria === "Insumos" ? 30 :
      35;

    nuevoValor = Math.round(valor * (1 - porcentajeCambio / 100));

    diagnostico =
      "El gasto no demuestra retorno suficiente frente al dinero invertido.";

    analisis =
      `El gasto en ${nombre} consume recursos sin evidenciar ventas, eficiencia, rotación o protección de clientes. En este caso, conservarlo igual sería permitir que el dinero se quede en una actividad de bajo rendimiento.`;

    decision =
      "Reducir, medir y reasignar.";

    recomendacion =
      `Aplicar una reducción del ${porcentajeCambio}% y reasignar ese dinero a productos, procesos o canales con mejor rendimiento verificable.`;

    usoDinero =
      "50% a productos de alta rotación, 25% a insumos críticos, 15% a mejora operativa y 10% a reserva de caja.";

    controlRiesgo =
      "Si después del recorte no bajan las ventas ni la satisfacción, confirma que el gasto era prescindible.";
  }

  else if (impacto === "medio") {
    metodo = "Método 2 — Validación de retorno financiero";
    tipoCambio = "reducción controlada";
    porcentajeCambio =
      categoria === "Publicidad" ? 15 :
      categoria === "Personal" ? 7 :
      categoria === "Equipos" ? 5 :
      categoria === "Insumos" ? 18 :
      20;

    nuevoValor = Math.round(valor * (1 - porcentajeCambio / 100));

    diagnostico =
      "El gasto tiene utilidad parcial, pero todavía no justifica completamente su valor.";

    analisis =
      `El gasto en ${nombre} puede estar ayudando, pero no demuestra con claridad que el beneficio supere el costo. Debe conservarse bajo prueba, no como gasto automático.`;

    decision =
      "Reducir parcialmente y comprobar retorno.";

    recomendacion =
      `Reducirlo en ${porcentajeCambio}% durante un periodo de prueba. Si el resultado no empeora, el restaurante estaba pagando más de lo necesario.`;

    usoDinero =
      "45% a actividades con retorno medible, 30% a operación esencial, 15% a servicio al cliente y 10% a reserva.";

    controlRiesgo =
      "No eliminar hasta confirmar con datos. La reducción debe ser reversible si afecta ventas, tiempos o calidad.";
  }

  else {
    metodo = "Método 3 — Optimización de gasto útil";
    tipoCambio = "optimización";
    porcentajeCambio =
      categoria === "Publicidad" ? 10 :
      categoria === "Personal" ? 5 :
      categoria === "Equipos" ? 5 :
      categoria === "Insumos" ? 8 :
      8;

    nuevoValor = Math.round(valor * (1 - porcentajeCambio / 100));

    diagnostico =
      "El gasto sí parece útil, pero puede optimizarse sin perder el beneficio.";

    analisis =
      `El gasto en ${nombre} genera un resultado visible. No debe eliminarse, pero sí revisarse para pagar mejor, comprar mejor o ejecutar con mayor eficiencia.`;

    decision =
      "Mantener, comparar y optimizar.";

    recomendacion =
      `Buscar una optimización de ${porcentajeCambio}% mediante negociación, mejor planificación, medición del canal o ajuste de cantidades.`;

    usoDinero =
      "60% debe conservarse en la actividad que funciona, 20% puede destinarse a prueba de mejora, 10% a medición y 10% a reserva.";

    controlRiesgo =
      "No tocar lo que funciona sin medir. Optimizar no significa recortar por tacañería, sino conservar resultado pagando mejor.";
  }

  const diferencia = Math.abs(valor - nuevoValor);

  document.getElementById("resultadoControlGasto").innerHTML = `
    <div class="card">
      <h3>${metodo}</h3>

      <p><strong>Gasto analizado:</strong> ${nombre}</p>
      <p><strong>Categoría:</strong> ${categoria}</p>
      <p><strong>Objetivo del gasto:</strong> ${
        objetivo === "ventas" ? "Ventas inmediatas" :
        objetivo === "operacion" ? "Operación base" :
        "Fidelización a largo plazo"
      }</p>
      <p><strong>Valor registrado:</strong> $${valor.toLocaleString("es-CO")}</p>

      <p><strong>Diagnóstico experto:</strong><br>${diagnostico}</p>

      <p><strong>Análisis financiero:</strong><br>${analisis}</p>

      <p><strong>Decisión recomendada:</strong><br>${decision}</p>

      <p><strong>Recomendación estratégica:</strong><br>${recomendacion}</p>

      <p><strong>Impacto proyectado:</strong><br>
      Tipo de acción: ${tipoCambio}. Porcentaje sugerido: ${porcentajeCambio}%.
      Valor proyectado: $${nuevoValor.toLocaleString("es-CO")}.
      Diferencia estimada: $${diferencia.toLocaleString("es-CO")}.
      </p>

      <p><strong>Distribución sugerida:</strong><br>${usoDinero}</p>

      <p><strong>Control de riesgo:</strong><br>${controlRiesgo}</p>

      <p><strong>Observación registrada:</strong><br>
      ${observacion || "Sin observación adicional."}
      </p>
    </div>
  `;
}
function formatoCOP(valor) {
  return "$" + Math.round(valor).toLocaleString("es-CO");
}

function formatoCOP(valor) {
  return "$" + Math.round(valor).toLocaleString("es-CO");
}

function normalizarMiles(valor) {
  const numero = Number(valor);

  if (!numero) return 0;

  if (numero > 0 && numero < 1000) {
    return numero * 1000;
  }

  return numero;
}

function calcularPrecioInteligente() {
  const producto = document.getElementById("productoPrecio").value.trim();

  const materiaPrima = normalizarMiles(
    document.getElementById("costoMateriaPrima").value
  );

  const costoOperativo = normalizarMiles(
    document.getElementById("costoOperativo").value
  );

  const precioActual = normalizarMiles(
    document.getElementById("precioActualVenta").value
  );

  const tiempo = Number(document.getElementById("tiempoPreparacion").value);
  const tipo = document.getElementById("tipoProductoPrecio").value;
  const demanda = document.getElementById("demandaProducto").value;

  if (!producto || !materiaPrima || !costoOperativo || !precioActual || !tiempo) {
    alert("Completa todos los campos");
    return;
  }

  const costoBase = materiaPrima + costoOperativo;

  const costoTrabajo =
    tiempo >= 45 ? 18000 :
    tiempo >= 30 ? 12000 :
    tiempo >= 20 ? 8000 :
    tiempo >= 10 ? 5000 :
    3000;

  const costoTotal = costoBase + costoTrabajo;

  let margenMinimo = 0.25;
  let margenRecomendado = 0.45;
  let margenPremium = 0.65;

  if (tipo === "ancla") {
    margenMinimo = 0.18;
    margenRecomendado = 0.30;
    margenPremium = 0.38;
  }

  if (tipo === "estrella") {
    margenMinimo = 0.35;
    margenRecomendado = 0.52;
    margenPremium = 0.70;
  }

  if (tipo === "diamante") {
    margenMinimo = 0.45;
    margenRecomendado = 0.68;
    margenPremium = 0.95;
  }

  if (demanda === "alta") {
    margenRecomendado += 0.05;
    margenPremium += 0.08;
  }

  if (demanda === "baja") {
    margenRecomendado -= 0.08;
    margenPremium -= 0.10;
  }

  const precioMinimo = Math.round(costoTotal / (1 - margenMinimo));
  const precioRecomendado = Math.round(costoTotal / (1 - margenRecomendado));
  const precioPremium = Math.round(costoTotal / (1 - margenPremium));

  const margenActual =
    precioActual > 0
      ? ((precioActual - costoTotal) / precioActual) * 100
      : 0;

  let semaforo = "";
  let decision = "";
  let accion = "";
  let interpretacion = "";

  if (precioActual < precioMinimo) {
    semaforo = "🔴 Rojo de emergencia — precio por debajo del mínimo sostenible";
    decision = "Subir precio de forma inmediata";
    accion = `Subir mínimo hasta ${formatoCOP(precioMinimo)}.`;

    interpretacion = `
      El precio actual no rescata correctamente el costo de materia prima,
      operación y tiempo de preparación. Bajo esta estructura, el restaurante
      está vendiendo por debajo del nivel mínimo necesario para proteger margen.

      GRUK recomienda corregir el precio de inmediato. No se trata de subir por
      ambición, sino de evitar que el producto consuma trabajo, inventario y
      tiempo sin devolver suficiente valor económico.
    `;
  } else if (precioActual >= precioMinimo && precioActual < precioRecomendado) {
    semaforo = "🟡 Amarillo — precio conservador";
    decision = "Subir gradualmente";
    accion = `Mover el precio hacia ${formatoCOP(precioRecomendado)}.`;

    interpretacion = `
      El precio actual ya cubre la base mínima, pero todavía no captura todo el
      valor económico del producto. Hay espacio para mejorar margen sin romper
      la lógica comercial, especialmente si el producto tiene buena aceptación.
    `;
  } else if (precioActual >= precioRecomendado && precioActual <= precioPremium) {
    semaforo = "🟢 Verde — precio estratégicamente sano";
    decision = "Mantener y medir";
    accion = "No subir todavía. Medir aceptación, rotación y recompra.";

    interpretacion = `
      El precio actual está dentro del rango óptimo calculado. Aquí la mejor
      decisión no es subir por subir, sino defender el equilibrio entre margen,
      demanda y percepción de valor.
    `;
  } else {
    semaforo = "🟣 Morado — precio premium alto";
    decision = "Validar percepción de valor";
    accion = "Mantener solo si la demanda sigue estable y el cliente percibe valor superior.";

    interpretacion = `
      El precio actual supera el rango premium calculado. Puede funcionar si el
      producto tiene reputación, presentación fuerte y demanda sostenida. Si no,
      existe riesgo de perder rotación.
    `;
  }

  document.getElementById("resultadoPrecioInteligente").innerHTML = `
    <div class="card">
      <h3>Diagnóstico estratégico de precio</h3>

      <p><strong>Producto:</strong> ${producto}</p>

      <p><strong>Costo materia prima normalizado:</strong> ${formatoCOP(materiaPrima)}</p>
      <p><strong>Costo operativo normalizado:</strong> ${formatoCOP(costoOperativo)}</p>
      <p><strong>Costo trabajo/tiempo estimado:</strong> ${formatoCOP(costoTrabajo)}</p>
      <p><strong>Costo total estratégico:</strong> ${formatoCOP(costoTotal)}</p>

      <p><strong>Precio actual:</strong> ${formatoCOP(precioActual)}</p>

      <p><strong>Precio mínimo sostenible:</strong> ${formatoCOP(precioMinimo)}</p>
      <p><strong>Precio rentable recomendado:</strong> ${formatoCOP(precioRecomendado)}</p>
      <p><strong>Precio premium estratégico:</strong> ${formatoCOP(precioPremium)}</p>

      <p><strong>Semáforo GRUK:</strong><br>${semaforo}</p>

      <p><strong>Margen actual estimado:</strong><br>
      ${margenActual.toFixed(1)}%
      </p>

      <p><strong>Decisión recomendada:</strong><br>
      ${decision}
      </p>

      <p><strong>Acción sugerida:</strong><br>
      ${accion}
      </p>

      <p><strong>Interpretación GRUK:</strong><br>
      ${interpretacion}
      </p>
    </div>
  `;
}

window.calcularPrecioInteligente = calcularPrecioInteligente;