const socket = io();
const params = new URLSearchParams(window.location.search);

const mesa = Number(params.get("mesa") || 1);
const restaurantId = params.get("restaurantId") || "rest1";

let ultimoEstadoMostrado = "";
let primeraCarga = true;
let menuData = [];
let subtotalActual = 0;
let ultimoEstadoLlamado = "";
let carritoPendiente = [];

document.getElementById("mesaActual").textContent = `Mesa ${mesa}`;

function playBeep() {
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const oscillator = audioContext.createOscillator();
const gainNode = audioContext.createGain();

oscillator.connect(gainNode);
gainNode.connect(audioContext.destination);

oscillator.type = "sine";
oscillator.frequency.value = 880;
gainNode.gain.value = 0.1;

oscillator.start();
oscillator.stop(audioContext.currentTime + 0.2);
}

function mensajeEstado(estado) {
if (estado === "pedido" || estado === "pendiente") return "Pedido recibido en cocina";
if (estado === "preparando") return "Su comida se está preparando";
if (estado === "listo") return "Su comida está lista, espere unos segundos y el personal de mesa llevará su comida";
if (estado === "entregado") return "Pedido entregado";
return "Esperando pedido...";
}

function textoMetodoPago(metodoPago) {
if (metodoPago === "efectivo") return "Efectivo";
if (metodoPago === "transferencia") return "Transferencia";
if (metodoPago === "pse") return "PSE";
if (metodoPago === "tarjeta") return "Tarjeta";
return metodoPago;
}

function agruparPorCategoria(menu) {
const grupos = {};
menu.forEach(item => {
const categoria = item.categoria || "Menú";
if (!grupos[categoria]) grupos[categoria] = [];
grupos[categoria].push(item);
});
return grupos;
}

function obtenerExtras(item) {
if (Array.isArray(item.extras) && item.extras.length > 0) {
return item.extras;
}

return [
{ nombre: "Sin extra", precio: 0 },
{ nombre: "Queso", precio: 3000 },
{ nombre: "Tocineta", precio: 4000 }
];
}

function obtenerGuarniciones(item) {
if (Array.isArray(item.guarniciones) && item.guarniciones.length > 0) {
return item.guarniciones;
}

return ["Papas", "Ensalada", "Puré"];
}

function esProductoDeCarne(item) {
const nombre = (item.nombre || "").toLowerCase();
const categoria = (item.categoria || "").toLowerCase();

return (
nombre.includes("carne") ||
nombre.includes("res") ||
nombre.includes("bistec") ||
nombre.includes("lomo") ||
nombre.includes("churrasco") ||
nombre.includes("punta de anca") ||
categoria.includes("carnes")
);
}

function obtenerDescripcionTermino(valor) {
if (valor === "Azul") {
return "Azul: capa externa bien cocida, centro crudo, suave, blando y jugoso.";
}
if (valor === "Término medio") {
return "Término medio: capa externa bien cocida, centro en un 50% rojo y jugoso.";
}
if (valor === "3/4") {
return "3/4: capa externa bien cocida de color café, centro de color rosa, mucho más firme y seco.";
}
if (valor === "Bien cocido") {
return "Bien cocido: 100% cocida, color café.";
}
return "";
}

function actualizarDescripcionTermino(idProducto) {
const select = document.getElementById(`termino-${idProducto}`);
const descripcion = document.getElementById(`descripcion-termino-${idProducto}`);
if (!select || !descripcion) return;

descripcion.textContent = obtenerDescripcionTermino(select.value);
}

function renderCalificacion(item) {
const calificacion = Number(item.calificacion || 4.8);
const estrellasLlenas = Math.round(calificacion);
let estrellas = "";

for (let i = 1; i <= 5; i++) {
estrellas += i <= estrellasLlenas ? "★" : "☆";
}

return `
<div class="calificacion-producto" style="margin:8px 0 12px; font-size:14px;">
<span style="color:#f5c542;">${estrellas}</span>
<span style="color:#666;"> ${calificacion.toFixed(1)} / 5</span>
</div>
`;
}

function asegurarUIConfirmacion() {
if (document.getElementById("modalConfirmacionPedido")) return;

const style = document.createElement("style");
style.textContent = `
.descripcion-termino{
font-size:13px;
line-height:1.5;
color:#555;
margin-top:-6px;
margin-bottom:12px;
}

.indicador-carrito{
position:fixed;
right:16px;
bottom:16px;
z-index:9998;
background:#111827;
color:white;
padding:12px 16px;
border-radius:14px;
box-shadow:0 10px 30px rgba(0,0,0,.25);
font-size:14px;
display:none;
max-width:320px;
}

.modal-confirmacion-overlay{
position:fixed;
inset:0;
background:rgba(0,0,0,.55);
display:none;
align-items:center;
justify-content:center;
z-index:9999;
padding:16px;
}

.modal-confirmacion{
background:white;
color:#111;
width:min(680px, 100%);
border-radius:18px;
padding:24px;
box-shadow:0 20px 60px rgba(0,0,0,.35);
max-height:90vh;
overflow:auto;
}

.modal-confirmacion h3{
margin:0 0 12px;
font-size:22px;
}

.modal-confirmacion p{
margin:0 0 8px;
line-height:1.6;
}

.modal-confirmacion .resumen{
background:#f8fafc;
border:1px solid #e5e7eb;
border-radius:12px;
padding:14px;
margin:14px 0 18px;
white-space:pre-line;
font-size:14px;
line-height:1.6;
}

.modal-confirmacion .resumen-secundario{
background:#fff7ed;
border:1px solid #fed7aa;
border-radius:12px;
padding:14px;
margin:14px 0 18px;
font-size:14px;
line-height:1.6;
white-space:pre-line;
}

.modal-botones{
display:grid;
grid-template-columns:repeat(3, 1fr);
gap:10px;
}

.modal-botones button{
width:100%;
border:none;
border-radius:10px;
padding:12px;
font-size:14px;
font-weight:700;
cursor:pointer;
}

.btn-aceptar{
background:#16a34a;
color:white;
}

.btn-cancelar{
background:#dc2626;
color:white;
}

.btn-anadir{
background:#111827;
color:white;
}
`;
document.head.appendChild(style);

const indicador = document.createElement("div");
indicador.id = "indicadorCarritoPendiente";
indicador.className = "indicador-carrito";
document.body.appendChild(indicador);

const overlay = document.createElement("div");
overlay.id = "modalConfirmacionPedido";
overlay.className = "modal-confirmacion-overlay";
overlay.innerHTML = `
<div class="modal-confirmacion">
<h3 id="modalTituloPedido">Restaurante dice</h3>
<p>Confirmar pedido</p>

<div id="modalResumenPedido" class="resumen"></div>

<div id="modalProductosAnadidos" class="resumen-secundario" style="display:none;"></div>

<div class="modal-botones">
<button id="btnAceptarPedido" class="btn-aceptar">Aceptar</button>
<button id="btnCancelarPedido" class="btn-cancelar">Cancelar</button>
<button id="btnAnadirPedido" class="btn-anadir">Añadir</button>
</div>
</div>
`;
document.body.appendChild(overlay);
}

function actualizarIndicadorCarrito() {
asegurarUIConfirmacion();
const indicador = document.getElementById("indicadorCarritoPendiente");
if (!indicador) return;

if (carritoPendiente.length > 0) {
const texto = carritoPendiente
.map((p, i) => `${i + 1}. ${p.producto} x${p.cantidad}`)
.join(" | ");

indicador.style.display = "block";
indicador.textContent = `Añadidos pendientes (${carritoPendiente.length}): ${texto}`;
} else {
indicador.style.display = "none";
indicador.textContent = "";
}
}

function construirResumenPedido(pedido) {
return [
`Producto: ${pedido.producto}`,
`Cantidad: ${pedido.cantidad}`,
pedido.guarnicion ? `Guarnición: ${pedido.guarnicion}` : "",
pedido.extra && pedido.extra !== "Sin extra" ? `Extra: ${pedido.extra}` : "",
pedido.terminoCarne ? `Término: ${pedido.terminoCarne}` : "",
pedido.observacionesProducto ? `Observaciones del producto: ${pedido.observacionesProducto}` : "",
pedido.observacionesGenerales ? `Observaciones generales: ${pedido.observacionesGenerales}` : "",
`Total: $${pedido.precio}`
].filter(Boolean).join("\n");
}

function construirResumenCarritoPendiente() {
if (!carritoPendiente.length) return "";

return carritoPendiente.map((pedido, index) => {
return [
`${index + 1}. ${pedido.producto}`,
`Cantidad: ${pedido.cantidad}`,
pedido.guarnicion ? `Guarnición: ${pedido.guarnicion}` : "",
pedido.extra && pedido.extra !== "Sin extra" ? `Extra: ${pedido.extra}` : "",
pedido.terminoCarne ? `Término: ${pedido.terminoCarne}` : "",
`Total: $${pedido.precio}`
].filter(Boolean).join(" | ");
}).join("\n");
}

function mostrarConfirmacionPedido(pedido) {
asegurarUIConfirmacion();

return new Promise(resolve => {
const overlay = document.getElementById("modalConfirmacionPedido");
const resumen = document.getElementById("modalResumenPedido");
const resumenPendientes = document.getElementById("modalProductosAnadidos");
const btnAceptar = document.getElementById("btnAceptarPedido");
const btnCancelar = document.getElementById("btnCancelarPedido");
const btnAnadir = document.getElementById("btnAnadirPedido");

resumen.textContent = construirResumenPedido(pedido);

if (carritoPendiente.length > 0) {
resumenPendientes.style.display = "block";
resumenPendientes.textContent =
`Productos añadidos antes de enviar:\n\n${construirResumenCarritoPendiente()}`;
} else {
resumenPendientes.style.display = "none";
resumenPendientes.textContent = "";
}

overlay.style.display = "flex";

const limpiar = () => {
overlay.style.display = "none";
btnAceptar.onclick = null;
btnCancelar.onclick = null;
btnAnadir.onclick = null;
};

btnAceptar.onclick = () => {
limpiar();
resolve("aceptar");
};

btnCancelar.onclick = () => {
limpiar();
resolve("cancelar");
};

btnAnadir.onclick = () => {
limpiar();
resolve("anadir");
};
});
}

function crearObjetoPedido(item, idProducto) {
const observacionesGenerales = document.getElementById("observaciones").value.trim();
const observacionesProducto = document.getElementById(`obs-${idProducto}`)?.value.trim() || "";
const metodoPago = document.getElementById("metodoPago").value;
const cantidad = Number(document.getElementById(`cantidad-${idProducto}`).value || 1);
const terminoElemento = document.getElementById(`termino-${idProducto}`);
const terminoValor = terminoElemento ? terminoElemento.value : "";
const terminoCarne = terminoValor ? obtenerDescripcionTermino(terminoValor) : "";
const valorExtra = Number(document.getElementById(`extra-${idProducto}`).value || 0);
const guarnicion = document.getElementById(`guarnicion-${idProducto}`)?.value || "";

const extrasDisponibles = obtenerExtras(item);
const extraSeleccionado = extrasDisponibles.find(extra => Number(extra.precio) === valorExtra);
const nombreExtra = extraSeleccionado ? extraSeleccionado.nombre : "Sin extra";

const precioUnitarioFinal = Number(item.precio) + valorExtra;
const precioTotal = precioUnitarioFinal * cantidad;

let observacionesFinales = "";

if (observacionesGenerales) {
observacionesFinales += `General: ${observacionesGenerales}`;
}

if (observacionesProducto) {
observacionesFinales += `${observacionesFinales ? " | " : ""}Producto: ${observacionesProducto}`;
}

if (guarnicion) {
observacionesFinales += `${observacionesFinales ? " | " : ""}Guarnición: ${guarnicion}`;
}

if (nombreExtra && nombreExtra !== "Sin extra") {
observacionesFinales += `${observacionesFinales ? " | " : ""}Extra: ${nombreExtra}`;
}

if (terminoCarne) {
observacionesFinales += `${observacionesFinales ? " | " : ""}Término: ${terminoCarne}`;
}

observacionesFinales += `${observacionesFinales ? " | " : ""}Cantidad: ${cantidad}`;

return {
restaurantId,
mesa,
producto: item.nombre,
observaciones: observacionesFinales,
observacionesGenerales,
observacionesProducto,
categoria: item.categoria,
precio: precioTotal,
cantidad,
metodoPago,
tiempoEstimado: item.tiempoBase,
descripcion: item.descripcion || "",
guarnicion,
extra: nombreExtra,
valorExtra,
terminoCarne
};
}

async function enviarPedidoAlServidor(pedido) {
const res = await fetch("/api/pedido", {
method: "POST",
headers: {
"Content-Type": "application/json"
},
body: JSON.stringify({
restaurantId: pedido.restaurantId,
mesa: pedido.mesa,
producto: pedido.producto,
observaciones: pedido.observaciones,
categoria: pedido.categoria,
precio: pedido.precio,
cantidad: pedido.cantidad,
metodoPago: pedido.metodoPago,
tiempoEstimado: pedido.tiempoEstimado,
descripcion: pedido.descripcion,
guarnicion: pedido.guarnicion,
extra: pedido.extra,
valorExtra: pedido.valorExtra
})
});

if (!res.ok) {
throw new Error("No se pudo enviar el pedido");
}
}

async function cargarMenu() {
try {
asegurarUIConfirmacion();
actualizarIndicadorCarrito();

const res = await fetch(`/api/menu?restaurantId=${restaurantId}`);
const menu = await res.json();
menuData = menu;

const contenedor = document.getElementById("menuLista");
contenedor.innerHTML = "";

const grupos = agruparPorCategoria(menu);

Object.keys(grupos).forEach(categoria => {
const categoriaId = categoria.replace(/\s/g, "-");

contenedor.innerHTML += `<h3 class="categoria-titulo">${categoria}</h3>`;
contenedor.innerHTML += `<div class="grid" id="grupo-${categoriaId}"></div>`;

const grupo = document.getElementById(`grupo-${categoriaId}`);

grupos[categoria].forEach(item => {
const extras = obtenerExtras(item);
const guarniciones = obtenerGuarniciones(item);

const opcionesExtras = extras
.map(extra => `<option value="${extra.precio}">${extra.nombre}${extra.precio > 0 ? ` +$${extra.precio}` : ""}</option>`)
.join("");

const opcionesGuarniciones = guarniciones
.map(guarnicion => `<option value="${guarnicion}">${guarnicion}</option>`)
.join("");

grupo.innerHTML += `
<div class="card">
<img src="${item.imagen}" alt="${item.nombre}" class="menu-img">
<h3>${item.nombre}</h3>

${renderCalificacion(item)}

<p>${item.descripcion || "Delicioso producto preparado especialmente para ti."}</p>

<p><strong>Precio base:</strong> $${item.precio}</p>
<p><strong>Tiempo estimado base:</strong> ${item.tiempoBase} min</p>

${
esProductoDeCarne(item)
? `
<label for="termino-${item.id}">Término de cocción</label>
<select id="termino-${item.id}" onchange="actualizarDescripcionTermino(${item.id})">
<option value="">Selecciona</option>
<option value="Azul">Azul</option>
<option value="Término medio">Término medio</option>
<option value="3/4">3/4</option>
<option value="Bien cocido">Bien cocido</option>
</select>
<p id="descripcion-termino-${item.id}" class="descripcion-termino"></p>
`
: ""
}

<label for="cantidad-${item.id}">Cantidad</label>
<select id="cantidad-${item.id}">
<option value="1">1</option>
<option value="2">2</option>
<option value="3">3</option>
<option value="4">4</option>
<option value="5">5</option>
<option value="6">6</option>
<option value="7">7</option>
<option value="8">8</option>
</select>

<label for="extra-${item.id}">Adiciones / extras</label>
<select id="extra-${item.id}">
${opcionesExtras}
</select>

<label for="guarnicion-${item.id}">Guarnición</label>
<select id="guarnicion-${item.id}">
${opcionesGuarniciones}
</select>

<label for="obs-${item.id}">Observaciones del producto</label>
<textarea id="obs-${item.id}" placeholder="Ej: sin cebolla, sin sal"></textarea>

${
item.disponible
? `<button onclick="pedir(${item.id})">Pedir</button>`
: `<button disabled>Agotado</button>`
}
</div>
`;
});
});
} catch (error) {
console.log(error);
alert("Error cargando el menú");
}
}

async function pedir(idProducto) {
try {
const item = menuData.find(p => p.id === idProducto);
if (!item) return;

if (!item.disponible) {
alert("Este producto está agotado");
return;
}

const pedidoActual = crearObjetoPedido(item, idProducto);
const accion = await mostrarConfirmacionPedido(pedidoActual);

if (accion === "cancelar") return;

if (accion === "anadir") {
carritoPendiente.push(pedidoActual);
actualizarIndicadorCarrito();
alert(`Producto añadido. Llevas ${carritoPendiente.length} producto(s) pendiente(s).`);
return;
}

const pedidosAEnviar = [...carritoPendiente, pedidoActual];

for (const pedido of pedidosAEnviar) {
await enviarPedidoAlServidor(pedido);
}

carritoPendiente = [];
actualizarIndicadorCarrito();

alert(`Pedido enviado a cocina ✅ (${pedidosAEnviar.length} producto(s))`);
await cargarMesa();
} catch (error) {
console.log(error);
alert("Error enviando pedido");
}
}

async function llamarMesero(meseroId) {
try {
const res = await fetch("/api/llamar-mesero", {
method: "POST",
headers: {
"Content-Type": "application/json"
},
body: JSON.stringify({
restaurantId,
mesa,
mensaje: "Mesa necesita atención",
meseroId
})
});

const data = await res.json();

if (!res.ok) {
alert(data.error || "No se pudo llamar al mesero");
return;
}

ultimoEstadoLlamado = "pendiente";
alert(`Se avisó al mesero ${data.llamado?.meseroNombre || ""}`);
cargarMeseros();
} catch (error) {
console.log(error);
alert("Error llamando al mesero");
}
}

async function cargarMeseros() {
try {
const res = await fetch(`/api/personal/meseros?restaurantId=${restaurantId}`);
if (!res.ok) {
console.log("Error cargando meseros");
return;
}

const meseros = await res.json();
const listaMeseros = document.getElementById("listaMeseros");
if (!listaMeseros) return;

listaMeseros.innerHTML = "";

if (!meseros.length) {
listaMeseros.innerHTML = `
<div class="card">
<p>No hay meseros registrados.</p>
</div>
`;
return;
}

meseros.forEach(m => {
listaMeseros.innerHTML += `
<div class="card">
<h3>${m.nombre}</h3>
<p>${m.estado === "disponible" ? "🟢 Disponible" : "🔴 Ocupado"}</p>
<button onclick="llamarMesero('${m._id}')" ${m.estado === "ocupado" ? "disabled" : ""}>
${m.estado === "ocupado" ? "Ocupado" : "Llamar"}
</button>
</div>
`;
});
} catch (error) {
console.log("Error cargando meseros:", error);
}
}

async function revisarEstadoLlamado() {
try {
const res = await fetch(`/api/llamados/mesa/${mesa}?restaurantId=${restaurantId}`);
if (!res.ok) return;

const data = await res.json();
if (!data.ok || !data.llamado) return;

const estadoActual = data.llamado.estado || "";

if (ultimoEstadoLlamado === "pendiente" && estadoActual === "atendiendo") {
alert("El mesero ya se está dirigiendo a tu lugar.");
}

ultimoEstadoLlamado = estadoActual;
} catch (error) {
console.log("Error revisando estado del llamado:", error);
}
}

async function marcarAtendido() {
try {
const res = await fetch(`/api/llamados/mesa/${mesa}/atendido?restaurantId=${restaurantId}`, {
method: "PUT",
headers: {
"Content-Type": "application/json"
}
});

const data = await res.json();

if (!res.ok) {
alert(data.error || "No se pudo marcar como atendido");
return;
}

ultimoEstadoLlamado = "atendido";
alert("Atención marcada como recibida");
} catch (error) {
console.log(error);
alert("Error marcando atención");
}
}

function calcularTotales(subtotal) {
const porcentaje = Number(document.getElementById("propinaSelect").value || 0);
const valorPropina = Math.round(subtotal * (porcentaje / 100));
const total = subtotal + valorPropina;

document.getElementById("subtotalMesa").textContent = `Subtotal: $${subtotal}`;
document.getElementById("valorPropina").textContent = `Propina: $${valorPropina}`;
document.getElementById("totalMesa").textContent = `Total: $${total}`;
}

async function verFactura() {
try {
const porcentaje = Number(document.getElementById("propinaSelect").value || 0);
const res = await fetch(`/api/factura/mesa/${mesa}?restaurantId=${restaurantId}&propina=${porcentaje}`);
const data = await res.json();

const box = document.getElementById("facturaBox");
if (!box) return;

let html = `<h3>Factura Mesa ${data.mesa}</h3>`;

if (!data.pedidos || data.pedidos.length === 0) {
html += `<p>No hay pedidos en la factura.</p>`;
} else {
data.pedidos.forEach(p => {
html += `
<p>
${p.producto} - $${p.precio}
${p.observaciones ? `<br><small>${p.observaciones}</small>` : ""}
</p>
`;
});
}

html += `
<hr>
<p>Subtotal: $${data.subtotal}</p>
<p>Propina (${data.propina}%): $${data.valorPropina}</p>
<p><strong>Total: $${data.total}</strong></p>
`;

box.innerHTML = html;
box.scrollIntoView({ behavior: "smooth" });
} catch (error) {
console.log(error);
}
}

async function cargarMesa() {
try {
const res = await fetch(`/api/pedidos/mesa/${mesa}?restaurantId=${restaurantId}`);
const data = await res.json();

const pedidos = data.pedidos;
subtotalActual = data.subtotal;

calcularTotales(subtotalActual);

const lista = document.getElementById("misPedidos");
lista.innerHTML = "";

if (pedidos.length === 0) {
document.getElementById("estadoPedido").textContent = "Esperando pedido...";
document.getElementById("tiempoPedido").textContent = "";
lista.innerHTML = `<div class="card"><p>No hay pedidos todavía.</p></div>`;
document.getElementById("facturaBox").innerHTML = "<p>Aún no hay factura.</p>";
return;
}

pedidos.forEach(p => {
lista.innerHTML += `
<div class="card">
<h3>${p.producto}</h3>
<p>Precio: $${p.precio}</p>
<p>Estado: ${p.estado}</p>
<p>Pago: ${textoMetodoPago(p.metodoPago)} - ${p.estadoPago}</p>
${p.observaciones ? `<p><strong>Detalle:</strong> ${p.observaciones}</p>` : ""}
</div>
`;
});

const ultimo = pedidos[0];
document.getElementById("estadoPedido").textContent = mensajeEstado(ultimo.estado);
document.getElementById("tiempoPedido").textContent =
ultimo.estado === "preparando" ? `Tiempo estimado: ${ultimo.tiempoEstimado} minutos` : "";

if (!primeraCarga && ultimo.estado !== ultimoEstadoMostrado) {
if (ultimo.estado === "preparando") {
playBeep();
alert("🔔 Su comida se está preparando");
}

if (ultimo.estado === "listo") {
playBeep();
alert("🔔 Su comida está lista, espere unos segundos y el personal de mesa llevará su comida");
}
}

ultimoEstadoMostrado = ultimo.estado;
primeraCarga = false;

await verFactura();
} catch (error) {
console.log(error);
}
}

document.getElementById("propinaSelect").addEventListener("change", () => {
calcularTotales(subtotalActual);
verFactura();
});

socket.on("pedido:nuevo", pedido => {
if (pedido.restaurantId === restaurantId) {
cargarMesa();
}
});

socket.on("pedido:actualizado", pedido => {
if (pedido.restaurantId === restaurantId) {
cargarMesa();
}
});

socket.on("menu:actualizado", payload => {
if (payload.restaurantId === restaurantId) {
cargarMenu();
}
});

setInterval(() => {
revisarEstadoLlamado();
}, 5000);

socket.on("llamado:actualizado", llamado => {
if (llamado.restaurantId === restaurantId && Number(llamado.mesa) === Number(mesa)) {
revisarEstadoLlamado();
}
});

socket.on("llamado:nuevo", llamado => {
if (llamado.restaurantId === restaurantId) {
cargarMeseros();
}
});

socket.on("llamado:actualizado", llamado => {
if (llamado.restaurantId === restaurantId) {
cargarMeseros();
}
});

cargarMenu();
cargarMesa();
cargarMeseros();
