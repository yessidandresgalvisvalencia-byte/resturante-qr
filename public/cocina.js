const socket = io()
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

    await fetch(`/api/pedido/${id}/estado`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ estado, tiempoEstimado })
    })
}

async function marcarPagado(id) {
    await fetch(`/api/pedido/${id}/pago`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ estadoPago: "pagado" })
    })
}

async function cargarPedidos() {
    const res = await fetch(`/api/pedidos?restaurantId=${restaurantId}`)
    const pedidos = await res.json()

    const activos = pedidos.filter(p => p.estado !== "entregado")
    const lista = document.getElementById("listaPedidos")
    lista.innerHTML = ""

    activos.forEach(p => {
        lista.innerHTML += `
            <div class="card">
                <h3>Mesa ${p.mesa}</h3>
                <p><strong>Producto:</strong> ${p.producto}</p>
                <p><strong>Categoría:</strong> ${p.categoria || "-"}</p>
                <p><strong>Precio:</strong> $${p.precio}</p>
                <p><strong>Estado:</strong> ${p.estado}</p>
                <p><strong>Tiempo:</strong> ${p.tiempoEstimado} min</p>
                <p><strong>Método de pago:</strong> ${textoMetodoPago(p.metodoPago)}</p>
                <p><strong>Estado del pago:</strong> ${p.estadoPago}</p>

                <div class="botones">
                    <button onclick="cambiarEstado('${p._id}','preparando')">Preparando</button>
                    <button onclick="cambiarEstado('${p._id}','listo')">Listo</button>
                    <button onclick="cambiarEstado('${p._id}','entregado')">Entregado</button>
                    <button onclick="marcarPagado('${p._id}')">Marcar pagado</button>
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