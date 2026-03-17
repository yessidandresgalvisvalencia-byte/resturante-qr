const socket = io();
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
let productoEnEdicion = null;
let productosStockActuales = [];

function getRestaurantId() {
const input = document.getElementById("restaurantIdInput");
return input ? input.value.trim() || "rest1" : "rest1";
}

function actualizarLinksRestaurant() {
const restaurantId = getRestaurantId();
const baseUrl = window.location.origin;

const restaurantIdActual = document.getElementById("restaurantIdActual");
const linkMenu = document.getElementById("linkMenu");
const linkCocina = document.getElementById("linkCocina");
const linkMesero = document.getElementById("linkMesero");
const linkAdmin = document.getElementById("linkAdmin");

if (restaurantIdActual) {
restaurantIdActual.textContent = restaurantId;
}

const menuUrl = `${baseUrl}/?restaurantId=${restaurantId}&mesa=1`;
const cocinaUrl = `${baseUrl}/cocina.html?restaurantId=${restaurantId}`;
const meseroUrl = `${baseUrl}/mesero.html?restaurantId=${restaurantId}`;
const adminUrl = `${baseUrl}/admin.html?restaurantId=${restaurantId}`;

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
const res = await fetch(`/api/admin/top-productos?restaurantId=${restaurantId}`);
if (!res.ok) return;

const data = await res.json();
const topProductos = document.getElementById("topProductos");
if (!topProductos) return;

topProductos.innerHTML = "";

if (!data.length) {
topProductos.innerHTML = `
<div class="card">
<p>No hay datos todavía.</p>
</div>
`;
return;
}

data.forEach(item => {
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
const res = await fetch(`/api/admin/historial-ventas?restaurantId=${restaurantId}`);
if (!res.ok) return;

const data = await res.json();
const historialVentas = document.getElementById("historialVentas");
if (!historialVentas) return;

historialVentas.innerHTML = "";

if (!data.length) {
historialVentas.innerHTML = `
<div class="card">
<p>No hay ventas todavía.</p>
</div>
`;
return;
}

data.forEach(item => {
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
stockLista.innerHTML += `
<div class="card">
<h3>${item.nombre}</h3>
<p>Categoría: ${item.categoria}</p>
<p>Precio: $${item.precio}</p>
<p>Disponible: ${item.disponible ? "Sí" : "No"}</p>

<button onclick="editarProductoPorId(${item.id})">Editar</button>

<button onclick="cambiarStock(${item.id}, ${!item.disponible})">
${item.disponible ? "Marcar como agotado" : "Marcar como disponible"}
</button>

<button onclick="eliminarProducto(${item.id})">Eliminar</button>
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
document.getElementById("precioProducto").value = item.precio || "";
document.getElementById("categoriaProducto").value = item.categoria || "Comida";
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
document.getElementById("precioProducto").value = "";
document.getElementById("categoriaProducto").value = "Comida";
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
const precioInput = document.getElementById("precioProducto");
const categoriaInput = document.getElementById("categoriaProducto");
const imagenInput = document.getElementById("imagenProducto");
const tiempoInput = document.getElementById("tiempoProducto");
const disponibleInput = document.getElementById("disponibleProducto");

if (!nombreInput || !precioInput || !categoriaInput || !imagenInput || !tiempoInput || !disponibleInput) {
alert("Faltan campos del formulario");
return;
}

const nombre = nombreInput.value.trim();
const precio = Number(precioInput.value || 0);
const categoria = categoriaInput.value;
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

if (productoEnEdicion) {
res = await fetch(`/api/menu/${productoEnEdicion}?restaurantId=${restaurantId}`, {
method: "PUT",
headers: {
"Content-Type": "application/json"
},
body: JSON.stringify({
nombre,
precio,
categoria,
imagen,
tiempoBase,
disponible
})
});
} else {
res = await fetch("/api/menu", {
method: "POST",
headers: {
"Content-Type": "application/json"
},
body: JSON.stringify({
restaurantId,
nombre,
precio,
categoria,
imagen,
tiempoBase,
disponible
})
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

    if (!nombre) {
      alert("Escribe el nombre del personal");
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
        estado
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
  await cargarPersonal(restaurantId)
}

const baseUrlInput = document.getElementById("baseUrl");
if (baseUrlInput) {
baseUrlInput.value = window.location.origin;
}

const params = new URLSearchParams(window.location.search);
const restaurantIdUrl = params.get("restaurantId") || "rest1";

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

actualizarLinksRestaurant();
cargarAdmin();