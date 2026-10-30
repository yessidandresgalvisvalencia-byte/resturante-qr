// Staff views must authenticate both HTTP and Socket.IO; restaurantId in URL
// is a locator only and never grants access to another company or site.
const cocinaToken = localStorage.getItem("grukAuthToken") || ""
const socket = io({ auth: { token: cocinaToken } })
function cocinaAuthHeaders() {
    return { Authorization: "Bearer " + cocinaToken }
}
function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;",
        '"': "&quot;", "'": "&#39;"
    })[char])
}
const params = new URLSearchParams(window.location.search)
const restaurantId = params.get("restaurantId") || "rest1"

let pedidosPrevios = 0
let primeraCargaCocina = true

function playBeep() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.type = "square"
    oscillator.frequency.value = 700
    gainNode.gain.value = 0.12

    oscillator.start()
    oscillator.stop(audioContext.currentTime + 0.25)
}

function textoMetodoPago(metodoPago) {
    if (metodoPago === "efectivo") return "Efectivo"
    if (metodoPago === "transferencia") return "Transferencia"
    if (metodoPago === "pse") return "PSE"
    if (metodoPago === "tarjeta") return "Tarjeta"
    return metodoPago
}

async function cambiarEstado(id, estado) {
let tiempoEstimado = null

if (estado === "preparando") {
const tiempo = prompt("Tiempo estimado en minutos", "15")
tiempoEstimado = Number(tiempo || 15)
}

const response = await fetch(`/api/pedido/${encodeURIComponent(id)}/estado`, {
method: "PUT",
headers: {
"Content-Type": "application/json",
...cocinaAuthHeaders()
},
body: JSON.stringify({ estado, tiempoEstimado })
})
if (!response.ok) throw Error("ESTADO_NO_AUTORIZADO")

cargarPedidos()
}

async function marcarPagado(id) {
const response = await fetch(`/api/pedido/${encodeURIComponent(id)}/pago`, {
method: "PUT",
headers: {
"Content-Type": "application/json",
...cocinaAuthHeaders()
},
body: JSON.stringify({ estadoPago: "pagado" })
})
if (!response.ok) throw Error("PAGO_NO_AUTORIZADO")

cargarPedidos()
}

async function cargarPedidos() {
const res = await fetch(`/api/pedidos?restaurantId=${encodeURIComponent(restaurantId)}`, {
    headers: cocinaAuthHeaders()
})
if (!res.ok) throw Error("PEDIDOS_NO_AUTORIZADOS")
const pedidos = await res.json()
if (!Array.isArray(pedidos)) throw Error("PEDIDOS_RESPUESTA_INVALIDA")

const visibles = pedidos.filter(p => {
return !(p.estado === "entregado" && p.estadoPago === "pagado")
})

const activos = visibles.filter(p => p.estado !== "entregado")
const lista = document.getElementById("listaPedidos")
lista.innerHTML = ""

visibles.forEach((pedido) => {
if (!/^[a-f0-9]{24}$/i.test(String(pedido._id))) return
const safeId = String(pedido._id)
lista.innerHTML += `
<div class="card">
<h3>Mesa ${escapeHtml(pedido.mesa)}</h3>
<p><strong>Producto:</strong> ${escapeHtml(pedido.producto)}</p>
<p><strong>Categoría:</strong> ${escapeHtml(pedido.categoria || "-")}</p>
<p><strong>Precio:</strong> $${escapeHtml(pedido.precio)}</p>
<p><strong>Estado:</strong> ${escapeHtml(pedido.estado)}</p>
<p><strong>Observaciones:</strong> ${escapeHtml(pedido.observaciones || "Sin observaciones")}</p>
<p><strong>Tiempo:</strong> ${escapeHtml(pedido.tiempoEstimado)} min</p>
<p><strong>Método de pago:</strong> ${escapeHtml(textoMetodoPago(pedido.metodoPago))}</p>
<p><strong>Estado del pago:</strong> ${escapeHtml(pedido.estadoPago)}</p>

<div class="botones">
<button onclick="cambiarEstado('${safeId}','preparando')">Preparando</button>
<button onclick="cambiarEstado('${safeId}','listo')">Listo</button>
<button onclick="cambiarEstado('${safeId}','entregado')">Entregado</button>
<button onclick="marcarPagado('${safeId}')">Marcar pagado</button>
</div>
</div>
`
})

if (!primeraCargaCocina && activos.length > pedidosPrevios) {
playBeep()
}

pedidosPrevios = activos.length
primeraCargaCocina = false
}

socket.on("pedido:nuevo", (pedido) => {
if (pedido.restaurantId === restaurantId) {
playBeep()
cargarPedidos()
}
})

socket.on("pedido:actualizado", (pedido) => {
if (pedido.restaurantId === restaurantId) {
cargarPedidos()
}
})

cargarPedidos()
const paramsLogo = new URLSearchParams(window.location.search);
const restaurantIdLogo = paramsLogo.get("restaurantId");

async function cargarLogoRestaurante() {
  if (!restaurantIdLogo) return;

  const res = await fetch(`/api/restaurants/${restaurantIdLogo}`);
  const data = await res.json();

  if (data.ok && data.restaurante.logoUrl) {
    const logo = document.getElementById("logoRestaurante");

    if (logo) {
      logo.src = data.restaurante.logoUrl;
    }

    document.body.style.setProperty(
      "--fondo-restaurante",
      `url(${data.restaurante.logoUrl})`
    );
  }
}

cargarLogoRestaurante();