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

function normalizarCosto(valor) {
  const numero = Number(valor);

  if (!numero) return 0;

  return numero;
}

function normalizarPrecio(valor) {
  const numero = Number(valor);

  if (!numero) return 0;

  if (numero > 0 && numero < 1000) {
    return numero * 1000;
  }

  return numero;
}

function calcularPrecioInteligente() {
  const producto = document.getElementById("productoPrecio").value.trim();

  const materiaPrima = normalizarCosto(
    document.getElementById("costoMateriaPrima").value
  );

  const costoOperativo = normalizarCosto(
    document.getElementById("costoOperativo").value
  );

  const precioActual = normalizarPrecio(
    document.getElementById("precioActualVenta").value
  );

  const tiempo = Number(document.getElementById("tiempoPreparacion").value);
  const tipo = document.getElementById("tipoProductoPrecio").value;
  const demanda = document.getElementById("demandaProducto").value;

  if (!producto || !materiaPrima || !costoOperativo || !precioActual || !tiempo) {
    alert("Completa todos los campos");
    return;
  }

  const textoProducto = producto.toLowerCase();

  const esBebidaBasica =
    textoProducto.includes("tinto") ||
    textoProducto.includes("cafe") ||
    textoProducto.includes("café") ||
    textoProducto.includes("agua") ||
    textoProducto.includes("aromatica") ||
    textoProducto.includes("aromática");

  const esEntradaBasica =
    textoProducto.includes("empanada") ||
    textoProducto.includes("pan") ||
    textoProducto.includes("arepa") ||
    textoProducto.includes("papita") ||
    textoProducto.includes("papas pequeñas") ||
    textoProducto.includes("entrada");

  const esPostre =
    textoProducto.includes("postre") ||
    textoProducto.includes("volcan") ||
    textoProducto.includes("volcán") ||
    textoProducto.includes("arequipe") ||
    textoProducto.includes("brownie") ||
    textoProducto.includes("torta") ||
    textoProducto.includes("helado") ||
    textoProducto.includes("flan");

  const esPlatoFuerte =
    textoProducto.includes("carne") ||
    textoProducto.includes("punta") ||
    textoProducto.includes("anca") ||
    textoProducto.includes("costilla") ||
    textoProducto.includes("lomo") ||
    textoProducto.includes("pollo") ||
    textoProducto.includes("filete") ||
    textoProducto.includes("parrilla") ||
    textoProducto.includes("asado") ||
    textoProducto.includes("asada");

  const puedeSerGancho =
    tipo === "ancla" &&
    (esBebidaBasica || esEntradaBasica) &&
    !esPostre &&
    !esPlatoFuerte;

  const costoBase = materiaPrima + costoOperativo;

  const costoTrabajo =
    tiempo >= 45 ? 18000 :
    tiempo >= 30 ? 12000 :
    tiempo >= 20 ? 8000 :
    tiempo >= 10 ? 5000 :
    tiempo >= 5 ? 1500 :
    500;

  const costoTotal = costoBase + costoTrabajo;

  let margenMinimo = 0.25;
  let margenRecomendado = 0.45;
  let margenPremium = 0.65;

  if (tipo === "ancla") {
    margenMinimo = 0.05;
    margenRecomendado = 0.18;
    margenPremium = 0.30;
  }

  if (tipo === "estrella") {
    margenMinimo = 0.35;
    margenRecomendado = 0.52;
    margenPremium = 0.70;
  }

  if (tipo === "diamante") {
    margenMinimo = 0.45;
    margenRecomendado = 0.68;
    margenPremium = 0.88;
  }

  if (demanda === "alta" && !puedeSerGancho) {
    margenRecomendado += 0.05;
    margenPremium += 0.08;
  }

  if (demanda === "baja") {
    margenRecomendado -= 0.08;
    margenPremium -= 0.10;
  }

  margenMinimo = Math.min(Math.max(margenMinimo, 0.03), 0.85);
  margenRecomendado = Math.min(Math.max(margenRecomendado, 0.08), 0.88);
  margenPremium = Math.min(Math.max(margenPremium, 0.12), 0.90);

  const precioMinimo = Math.round(costoTotal / (1 - margenMinimo));
  const precioRecomendado = Math.round(costoTotal / (1 - margenRecomendado));
  const precioPremium = Math.round(costoTotal / Math.max(0.08, 1 - margenPremium));

  const margenActual =
    precioActual > 0
      ? ((precioActual - costoTotal) / precioActual) * 100
      : 0;

  const utilidadActual = precioActual - costoTotal;

  const desviacionPremium =
    precioPremium > 0 ? precioActual / precioPremium : 999;

  const posibleErrorDigitacion =
    desviacionPremium >= 5;

  const perdidaPorVenta =
    Math.max(0, costoTotal - precioActual);

  const destruccionMensual =
    perdidaPorVenta * 30;

  let semaforo = "";
  let decision = "";
  let accion = "";
  let interpretacion = "";

  if (posibleErrorDigitacion) {
    semaforo = "⚠️ Alerta crítica de digitación";
    decision = "Revisar inmediatamente el precio ingresado";
    accion = "El precio actual parece contener ceros adicionales o un error humano.";

    interpretacion = `
      ¡Cuidado! El precio actual de ${formatoCOP(precioActual)}
      supera exageradamente el límite premium calculado de ${formatoCOP(precioPremium)}.

      GRUK detecta una desviación extrema incompatible con el comportamiento normal del mercado.
      Esto probablemente no es una estrategia premium: parece un error de digitación.
    `;
  }

  else if (precioActual < costoTotal && puedeSerGancho) {
    semaforo = "🔵 Azul — producto gancho subsidiado";
    decision = "Mantener solo si genera venta cruzada comprobada";
    accion = "No subir automáticamente. Validar si arrastra compras rentables.";

    interpretacion = `
      ${producto} está por debajo de su costo total, pero puede cumplir una función estratégica como producto gancho de entrada.

      Este precio solo tiene sentido si atrae tráfico al inicio del consumo y empuja compras de mayor margen: repostería, entradas rentables, platos fuertes, combos o bebidas complementarias.

      Si no existe venta cruzada real, el subsidio deja de ser estrategia y se convierte en pérdida.
    `;
  }

  else if (precioActual < costoTotal && (esPostre || esPlatoFuerte)) {
    semaforo = "🔴 Rojo de emergencia — cuello de botella operativo";
    decision = "Suspender subsidio y subir precio de inmediato";
    accion = `Subir mínimo hasta ${formatoCOP(precioMinimo)}.`;

    interpretacion = `
      ¡Alerta de cuello de botella operativo!

      ${producto} no debe tratarse como producto gancho. Los postres y platos fuertes no funcionan como anzuelo de entrada cuando están por debajo del costo: consumen tiempo de cocina, retrasan operación y destruyen margen en una fase crítica del servicio.

      Cada venta destruye aproximadamente ${formatoCOP(perdidaPorVenta)} de margen operativo.

      Si se mantiene esta estructura, el restaurante podría perder más de
      ${formatoCOP(destruccionMensual)} mensuales por sostener un precio que no rescata materia prima, operación ni tiempo productivo.

      GRUK recomienda suspender el subsidio y corregir el precio hacia el mínimo sostenible de ${formatoCOP(precioMinimo)}.
    `;
  }

  else if (precioActual < costoTotal) {
    semaforo = "🔴 Rojo de emergencia — pérdida real por unidad";
    decision = "Subir precio de forma inmediata";
    accion = `Subir mínimo hasta ${formatoCOP(precioMinimo)}.`;

    interpretacion = `
      El precio actual está por debajo del costo total estratégico. Aquí sí existe pérdida real por unidad.

      Cada venta destruye aproximadamente ${formatoCOP(perdidaPorVenta)} de margen operativo.

      Si el ritmo continúa, el restaurante podría perder más de
      ${formatoCOP(destruccionMensual)} mensuales únicamente por mantener este precio.
    `;
  }

  else if (precioActual >= costoTotal && precioActual < precioMinimo) {
    semaforo = "🟡 Amarillo — cubre costos, pero no genera utilidad suficiente";
    decision = "Subir gradualmente hacia una utilidad real";
    accion = `Mover el precio hacia ${formatoCOP(precioRecomendado)}.`;

    interpretacion = `
      El precio actual de ${formatoCOP(precioActual)} cubre los costos básicos y deja una utilidad aproximada de ${formatoCOP(utilidadActual)} por unidad, equivalente a un margen estimado de ${margenActual.toFixed(1)}%.

      Sin embargo, sigue por debajo del mínimo sostenible calculado de ${formatoCOP(precioMinimo)}. Esto significa que el producto no está quebrando al restaurante, pero trabaja casi únicamente para pagar materia prima, operación y tiempo.

      GRUK recomienda subir gradualmente hacia ${formatoCOP(precioRecomendado)} para que el plato deje de estar en zona de supervivencia y empiece a producir utilidad real.
    `;
  }

  else if (precioActual >= precioMinimo && precioActual < precioRecomendado) {
    semaforo = "🟡 Amarillo — precio conservador";
    decision = "Subir gradualmente";
    accion = `Mover el precio hacia ${formatoCOP(precioRecomendado)}.`;

    interpretacion = `
      El precio actual ya supera el mínimo sostenible, pero todavía no captura todo el valor económico del producto.

      Hay espacio para mejorar margen sin romper la lógica comercial, especialmente si el producto tiene buena aceptación.
    `;
  }

  else if (precioActual >= precioRecomendado && precioActual <= precioPremium) {
    semaforo = "🟢 Verde — precio estratégicamente sano";
    decision = "Mantener y medir";
    accion = "No subir todavía. Medir aceptación, rotación y recompra.";

    interpretacion = `
      El precio actual está dentro del rango óptimo calculado.

      Aquí la mejor decisión no es subir por subir, sino defender el equilibrio entre margen, demanda y percepción de valor.
    `;
  }

  else {
    semaforo = "🟣 Morado — precio premium alto";
    decision = "Validar percepción de valor";
    accion = "Mantener solo si la demanda sigue estable y el cliente percibe valor superior.";

    interpretacion = `
      El precio actual supera el rango premium calculado.

      Puede funcionar solo si existe reputación, presentación fuerte, experiencia superior y demanda sostenida. Si no existen esas condiciones, el precio puede destruir rotación.
    `;
  }

  document.getElementById("resultadoPrecioInteligente").innerHTML = `
    <div class="card">
      <h3>Diagnóstico estratégico de precio</h3>

      <p><strong>Producto:</strong> ${producto}</p>

      <p><strong>Costo materia prima:</strong> ${formatoCOP(materiaPrima)}</p>
      <p><strong>Costo operativo:</strong> ${formatoCOP(costoOperativo)}</p>
      <p><strong>Costo trabajo/tiempo estimado:</strong> ${formatoCOP(costoTrabajo)}</p>
      <p><strong>Costo total estratégico:</strong> ${formatoCOP(costoTotal)}</p>

      <p><strong>Precio actual:</strong> ${formatoCOP(precioActual)}</p>
      <p><strong>Utilidad actual por unidad:</strong> ${formatoCOP(utilidadActual)}</p>

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
async function guardarInventario(){

try{

const restaurantId =
localStorage.getItem(
"adminRestaurantId"
);

const body = {

restaurantId,

nombre:
document.getElementById(
"inventarioNombre"
).value,

categoria:
document.getElementById(
"inventarioCategoria"
).value,

cantidad:Number(
document.getElementById(
"inventarioCantidad"
).value
),

unidad:
document.getElementById(
"inventarioUnidad"
).value,

proveedor:
document.getElementById(
"inventarioProveedor"
).value,

fechaCompra:
document.getElementById(
"inventarioCompra"
).value,

fechaVencimiento:
document.getElementById(
"inventarioVencimiento"
).value

};

const res =
await fetch(
"/api/inventario",
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify(body)
}
);

const data =
await res.json();

if(!data.ok){
alert("Error guardando");
return;
}

alert("Inventario guardado");

cargarInventario();

}catch(error){

console.log(error);

}

}

async function cargarInventario(){

try{

const restaurantId =
localStorage.getItem(
"adminRestaurantId"
);

const res =
await fetch(
`/api/inventario/${restaurantId}`
);

const data =
await res.json();

if(!data.ok) return;

const contenedor =
document.getElementById(
"inventarioLista"
);

contenedor.innerHTML = "";

const productosOrdenados =
data.productos.sort((a,b)=>{
return a.diasRestantes - b.diasRestantes;
});

productosOrdenados.forEach(producto=>{

let color = "#16a34a";

if(producto.estado === "proximo"){
color = "#f59e0b";
}

if(producto.estado === "vencido"){
color = "#dc2626";
}

contenedor.innerHTML += `

<div class="card">

<h3>${producto.nombre}</h3>

<p>
<strong>Categoría:</strong>
${producto.categoria}
</p>

<p>
<strong>Cantidad:</strong>
${producto.cantidad}
${producto.unidad}
</p>

<p>
<strong>Proveedor:</strong>
${producto.proveedor}
</p>

<p>
<strong>Vence:</strong>
${
producto.fechaVencimiento
? producto.fechaVencimiento.split("T")[0]
: ""
}
</p>

<p style="color:${color};font-weight:900;">

${
producto.estado === "vigente"

? "✅ Vigente"

: producto.estado === "proximo"

? "⚠️ Próximo a vencer"

: "❌ Vencido"
}

</p>

<p>
<strong>Días restantes:</strong>
${producto.diasRestantes}
</p>

<p>
<strong>Recomendación:</strong>

${
producto.estado === "vencido"

? "No usar. Revisar y retirar del inventario."

: producto.estado === "proximo"

? "Usar primero este producto en preparaciones del día o promociones controladas."

: "Mantener en inventario. No es prioridad de consumo."
}
</p>
<button onclick="anularInventario('${producto._id}')">
Anular producto
</button>

</div>

`;

});

}catch(error){

console.log(error);

}

}

cargarInventario();
async function anularInventario(id){

const motivo =
prompt("Escribe el motivo de anulación:");

if(!motivo){
alert("Debes escribir un motivo");
return;
}

const usuario =
localStorage.getItem("adminUsuario") || "admin";

const res =
await fetch(
`/api/inventario/anular/${id}`,
{
method:"PUT",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
motivo,
usuario
})
}
);

const data =
await res.json();

if(!data.ok){
alert(data.error || "No se pudo anular");
return;
}

alert("Producto anulado con trazabilidad");

cargarInventario();

}
async function generarReporteEjecutivo() {
  const restaurantId =
    localStorage.getItem("adminRestaurantId") ||
    new URLSearchParams(window.location.search).get("restaurantId");

  const periodo =
    document.getElementById("periodoReporte")?.value || "mensual";

  const totalVendido =
    document.getElementById("totalVendido")?.innerText || "$0";

  const pedidosActivos =
    document.getElementById("pedidosActivos")?.innerText || "0";

  const fecha =
    new Date().toLocaleDateString("es-CO");

  const estrategias =
    JSON.parse(localStorage.getItem(`estrategias_${restaurantId}`)) || [];

  let inventario = [];
  let datosVentas = [];

  try {
    const resInventario = await fetch(`/api/inventario/${restaurantId}`);
    const dataInventario = await resInventario.json();

    if (dataInventario.ok) {
      inventario = dataInventario.productos || [];
    }
  } catch (error) {
    console.log("No se pudo cargar inventario:", error);
  }

  try {

  let resVentas =
    await fetch(`/estadisticas/pareto?restaurantId=${restaurantId}`);

  if (!resVentas.ok) {

    resVentas =
      await fetch(`/estadisticas/pareto?restaurant=${restaurantId}`);

  }

  if (resVentas.ok) {

    datosVentas =
      await resVentas.json();

  } else {

    datosVentas = [];

  }

} catch (error) {

  console.log(
    "No se pudo cargar ventas:",
    error
  );

  datosVentas = [];
}



const ventasOrdenadas =
  datosVentas
    .map(p => ({
      producto: p.producto || "Producto sin nombre",
      categoria: p.categoria || "",
      precioUnitarioActual: Number(p.precioUnitarioActual || 0),
      ventas: Number(p.ventas || 0),
      totalDinero: Number(p.totalCalculado || 0)
    }))
    .filter(p => p.ventas > 0)
    .sort((a, b) => b.ventas - a.ventas);

  const productoMasVendido =
    ventasOrdenadas[0] || null;

  const totalPedidosReporte =
    ventasOrdenadas.reduce((acc, p) => acc + p.ventas, 0);

  const totalDineroReporte =
    ventasOrdenadas.reduce((acc, p) => acc + p.totalDinero, 0);

  const ticketPromedio =
    totalPedidosReporte > 0
      ? totalDineroReporte / totalPedidosReporte
      : 0;

  const productosTop =
    ventasOrdenadas.slice(0, 5);

  const productosBajaRotacion =
    ventasOrdenadas.filter(p => p.ventas <= 2);

  const inventarioRiesgo =
    inventario.filter(p =>
      p.estado === "proximo" ||
      p.estado === "vencido"
    );

  const inventarioOrdenado =
    inventario
      .slice()
      .sort((a, b) => Number(a.diasRestantes || 0) - Number(b.diasRestantes || 0))
      .slice(0, 8);

  const labelsTop =
    productosTop.map(p => p.producto);

  const dataTopVentas =
    productosTop.map(p => p.ventas);

  const dataTopDinero =
    productosTop.map(p => p.totalDinero);

  const labelsInventario =
    inventarioOrdenado.map(p => p.nombre);

  const dataInventarioDias =
    inventarioOrdenado.map(p => Number(p.diasRestantes || 0));

  const productoMasVendidoTexto =
    productoMasVendido
      ? `${productoMasVendido.producto} con ${productoMasVendido.ventas} pedidos`
      : "No hay producto líder registrado";

  const participacionTop =
    productoMasVendido && totalPedidosReporte > 0
      ? ((productoMasVendido.ventas / totalPedidosReporte) * 100).toFixed(1)
      : 0;

  const diagnosticoVentas =
    productoMasVendido
      ? `El producto más vendido fue ${productoMasVendido.producto}, concentrando aproximadamente el ${participacionTop}% de los pedidos. Si esta concentración continúa, el restaurante debe evitar depender de un solo producto y convertir esa demanda en venta cruzada hacia platos de mayor margen.`
      : "No hay suficientes datos para diagnosticar el comportamiento de ventas.";

  const diagnosticoInventario =
    inventarioRiesgo.length > 0
      ? `El inventario presenta ${inventarioRiesgo.length} producto(s) vencidos o próximos a vencer. Si esta situación continúa, el restaurante puede perder capital por desperdicio y afectar su margen operativo. Se recomienda aplicar FEFO: primero en vencer, primero en usarse.`
      : "El inventario no muestra alertas críticas de vencimiento. Esto indica una operación más controlada y menor riesgo de desperdicio.";

  const diagnosticoGraham =
    `Desde una lógica de largo plazo, GRUK recomienda no tomar decisiones solo por volumen de ventas. El restaurante debe proteger su margen de seguridad: vender más solo es sano si aumenta caja real, controla inventario y evita productos que roten mucho pero dejen poca utilidad.`;

  const reporte = `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte Ejecutivo GRUK</title>

<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<style>
body{
font-family:Arial, sans-serif;
padding:40px;
color:#111827;
line-height:1.6;
}

h1{
font-size:32px;
margin-bottom:5px;
}

h2{
margin-top:35px;
border-bottom:2px solid #111827;
padding-bottom:6px;
}

.card{
border:1px solid #ddd;
border-radius:12px;
padding:18px;
margin:14px 0;
page-break-inside:avoid;
}

.alerta{
background:#fff7ed;
border-left:6px solid #f97316;
}

.peligro{
background:#fef2f2;
border-left:6px solid #dc2626;
}

.exito{
background:#f0fdf4;
border-left:6px solid #16a34a;
}

.grafica{
height:360px;
margin:20px 0;
}

table{
width:100%;
border-collapse:collapse;
margin-top:12px;
}

th,td{
border:1px solid #ddd;
padding:10px;
text-align:left;
}

th{
background:#111827;
color:white;
}

@media print{
button{
display:none;
}
}
</style>
</head>

<body>

<h1>Reporte Ejecutivo GRUK</h1>
<p><strong>Restaurante ID:</strong> ${restaurantId}</p>
<p><strong>Periodo seleccionado:</strong> ${periodo}</p>
<p><strong>Fecha de generación:</strong> ${fecha}</p>

<h2>1. Resumen general</h2>

<div class="card exito">
<p><strong>Total vendido visible en panel:</strong> ${totalVendido}</p>
<p><strong>Total calculado por ventas:</strong> $${totalDineroReporte.toLocaleString("es-CO")}</p>
<p><strong>Total pedidos:</strong> ${totalPedidosReporte}</p>
<p><strong>Pedidos activos:</strong> ${pedidosActivos}</p>
<p><strong>Ticket promedio estimado:</strong> $${Math.round(ticketPromedio).toLocaleString("es-CO")}</p>
<p><strong>Producto más vendido:</strong> ${productoMasVendidoTexto}</p>
</div>

<h2>2. Gráfica de productos más vendidos</h2>

<div class="card">
<div class="grafica">
<canvas id="graficaTopProductos"></canvas>
</div>

<p><strong>Lectura GRUK:</strong><br>
${diagnosticoVentas}
</p>

<p>
Si el mercado mantiene esta reacción, GRUK recomienda usar el producto líder como entrada comercial, pero no permitir que absorba toda la estrategia. La demanda debe convertirse en combos, productos complementarios y platos con mayor margen.
</p>
</div>

<h2>3. Gráfica de ingresos por producto</h2>

<div class="card">
<div class="grafica">
<canvas id="graficaIngresosProductos"></canvas>
</div>

<p><strong>Lectura GRUK:</strong><br>
Esta gráfica permite comparar si los productos más vendidos son también los que más dinero generan. Si un producto vende mucho pero genera poco ingreso, funciona como producto de tráfico; si vende menos pero genera más dinero, puede ser un producto de acumulación rentable.
</p>

<p>
La estrategia de largo plazo debe proteger los productos que fortalecen caja, no solo los que generan volumen. Esto responde al margen de seguridad: crecer sin utilidad real puede debilitar el negocio aunque las ventas aparenten subir.
</p>
</div>

<h2>4. Gráfica de inventario y vencimientos</h2>

<div class="card">
<div class="grafica">
<canvas id="graficaInventario"></canvas>
</div>

<p><strong>Lectura GRUK:</strong><br>
${diagnosticoInventario}
</p>

<p>
Si los productos próximos a vencer aumentan, el restaurante está inmovilizando capital en inventario que no rota. A largo plazo, eso reduce liquidez y puede convertir ventas aparentemente sanas en pérdidas ocultas.
</p>
</div>

<h2>5. Tabla de productos más vendidos</h2>

<table>
<thead>
<tr>
<th>Producto</th>
<th>Categoría</th>
<th>Precio unitario actual</th>
<th>Cantidad vendida</th>
<th>Total calculado</th>
</tr>
</thead>

<tbody>
${
productosTop.length > 0

?

productosTop.map(p => `
<tr>
<td>${p.producto}</td>

<td>${p.categoria}</td>

<td>
$${p.precioUnitarioActual.toLocaleString("es-CO")}
</td>

<td>${p.ventas}</td>

<td>
$${p.totalDinero.toLocaleString("es-CO")}
</td>
</tr>
`).join("")

:

`
<tr>
<td colspan="5">
No hay datos disponibles.
</td>
</tr>
`
}
</tbody>
</table>

<h2>6. Productos de baja rotación</h2>

${
productosBajaRotacion.length > 0
? `
<div class="card alerta">
<ul>
${productosBajaRotacion.map(p => `
<li><strong>${p.producto}</strong>: ${p.ventas} venta(s)</li>
`).join("")}
</ul>
<p>
GRUK recomienda revisar foto, precio, descripción, ubicación y posible venta cruzada. Si después de una prueba no mejora, puede estar ocupando espacio visual y capital sin retorno.
</p>
</div>
`
: `
<div class="card exito">
<p>No se detectan productos críticos de baja rotación.</p>
</div>
`
}

<h2>7. Inventario en riesgo</h2>

${
inventarioRiesgo.length > 0
? `
<div class="card peligro">
<ul>
${inventarioRiesgo.map(p => `
<li>
<strong>${p.nombre}</strong> — ${p.categoria} —
${p.estado === "vencido" ? "Vencido" : "Próximo a vencer"} —
Días restantes: ${p.diasRestantes}
</li>
`).join("")}
</ul>
<p>
Prioridad: usar primero los productos próximos a vencer. Los vencidos deben retirarse o revisarse antes de uso.
</p>
</div>
`
: `
<div class="card exito">
<p>No hay inventario crítico por vencimiento.</p>
</div>
`
}

<h2>8. Estrategias aplicadas</h2>

${
estrategias.length > 0
? `
<table>
<thead>
<tr>
<th>N°</th>
<th>Estrategia</th>
<th>Productos</th>
<th>Fecha</th>
</tr>
</thead>
<tbody>
${estrategias.map(e => `
<tr>
<td>${e.numero}</td>
<td>${e.titulo}</td>
<td>${(e.productos || []).join(", ")}</td>
<td>${e.fecha ? new Date(e.fecha).toLocaleDateString("es-CO") : ""}</td>
</tr>
`).join("")}
</tbody>
</table>
`
: `
<div class="card alerta">
<p>No hay estrategias aplicadas registradas.</p>
</div>
`
}

<h2>9. Estrategia de largo plazo GRUK</h2>

<div class="card">
<p>
${diagnosticoGraham}
</p>

<p>
Si el restaurante continúa como está, debe observar tres señales: dependencia excesiva de un producto, acumulación de inventario próximo a vencer y diferencia entre productos que venden mucho y productos que realmente generan caja.
</p>

<p>
La estrategia recomendada es construir un portafolio balanceado: productos ancla para atraer tráfico, productos estrella para fortalecer caja, productos premium para aumentar ticket y control estricto del inventario para evitar capital muerto.
</p>
</div>

<script>
const labelsTop = ${JSON.stringify(labelsTop)};
const dataTopVentas = ${JSON.stringify(dataTopVentas)};
const dataTopDinero = ${JSON.stringify(dataTopDinero)};
const labelsInventario = ${JSON.stringify(labelsInventario)};
const dataInventarioDias = ${JSON.stringify(dataInventarioDias)};

new Chart(document.getElementById("graficaTopProductos"), {
  type: "bar",
  data: {
    labels: labelsTop,
    datasets: [{
      label: "Cantidad vendida",
      data: dataTopVentas
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false
  }
});

new Chart(document.getElementById("graficaIngresosProductos"), {
  type: "bar",
  data: {
    labels: labelsTop,
    datasets: [{
      label: "Ingresos generados",
      data: dataTopDinero
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false
  }
});

new Chart(document.getElementById("graficaInventario"), {
  type: "bar",
  data: {
    labels: labelsInventario,
    datasets: [{
      label: "Días restantes para vencer",
      data: dataInventarioDias
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false
  }
});

setTimeout(() => {
  window.print();
}, 900);
</script>

</body>
</html>
`;

  const ventana = window.open("", "_blank");

  ventana.document.open();
  ventana.document.write(reporte);
  ventana.document.close();
}

window.generarReporteEjecutivo =
generarReporteEjecutivo;