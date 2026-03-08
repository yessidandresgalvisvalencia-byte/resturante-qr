const socket = io()

function getRestaurantId() {
    return document.getElementById("restaurantIdInput").value.trim() || "rest1"
}

async function atenderLlamado(id) {
    await fetch(`/api/llamados/${id}/atender`, {
        method: "PUT"
    })
}

async function entregarPedido(id) {
    await fetch(`/api/pedido/${id}/estado`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ estado: "entregado" })
    })
}

async function cargarMesero() {
    const restaurantId = getRestaurantId()

    const llamadosRes = await fetch(`/api/llamados?restaurantId=${restaurantId}`)
    const llamados = await llamadosRes.json()

    const llamadosPendientes = llamados.filter(l => l.estado === "pendiente")

    const listaLlamados = document.getElementById("listaLlamados")
    listaLlamados.innerHTML = ""

    llamadosPendientes.forEach(l => {
        listaLlamados.innerHTML += `
            <div class="card">
                <h3>Mesa ${l.mesa}</h3>
                <p>${l.mensaje}</p>
                <button onclick="atenderLlamado('${l._id}')">Atendido</button>
            </div>
        `
    })

    const pedidosRes = await fetch(`/api/pedidos?restaurantId=${restaurantId}`)
    const pedidos = await pedidosRes.json()

    const listos = pedidos.filter(p => p.estado === "listo")

    const listaListos = document.getElementById("listaListos")
    listaListos.innerHTML = ""

    listos.forEach(p => {
        listaListos.innerHTML += `
            <div class="card">
                <h3>Mesa ${p.mesa}</h3>
                <p>${p.producto}</p>
                <p>$${p.precio}</p>
                <button onclick="entregarPedido('${p._id}')">Entregado</button>
            </div>
        `
    })
}

socket.on("llamado:nuevo", () => {
    cargarMesero()
})

socket.on("llamado:actualizado", () => {
    cargarMesero()
})

socket.on("pedido:actualizado", () => {
    cargarMesero()
})

cargarMesero()