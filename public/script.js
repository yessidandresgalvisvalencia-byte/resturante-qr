const socket = io()
const params = new URLSearchParams(window.location.search)

const mesa = Number(params.get("mesa") || 1)
const restaurantId = params.get("restaurantId") || "rest1"

let ultimoEstadoMostrado = ""
let primeraCarga = true
let menuData = []
let subtotalActual = 0

document.getElementById("mesaActual").textContent = Mesa ${mesa}

function playBeep() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.type = "sine"
    oscillator.frequency.value = 880
    gainNode.gain.value = 0.1

    oscillator.start()
    oscillator.stop(audioContext.currentTime + 0.2)
}

function mensajeEstado(estado) {
    if (estado === "pedido") return "Pedido recibido en cocina"
    if (estado === "preparando") return "Su comida se está preparando"
    if (estado === "listo") return "Su comida está lista, espere unos segundos y el personal de mesa llevará su comida"
    if (estado === "entregado") return "Pedido entregado"
    return "Esperando pedido..."
}

function textoMetodoPago(metodoPago) {
    if (metodoPago === "efectivo") return "Efectivo"
    if (metodoPago === "transferencia") return "Transferencia"
    if (metodoPago === "pse") return "PSE"
    if (metodoPago === "tarjeta") return "Tarjeta"
    return metodoPago
}

function agruparPorCategoria(menu) {
    const grupos = {}
    menu.forEach(item => {
        if (!grupos[item.categoria]) grupos[item.categoria] = []
        grupos[item.categoria].push(item)
    })
    return grupos
}

async function cargarMenu() {
    try {
        const res = await fetch(/api/menu?restaurantId=${restaurantId})
        const menu = await res.json()
        menuData = menu

        const contenedor = document.getElementById("menuLista")
        contenedor.innerHTML = ""

        const grupos = agruparPorCategoria(menu)

        Object.keys(grupos).forEach(categoria => {
            const categoriaId = categoria.replace(/\s/g, "-")

            contenedor.innerHTML += <h3 class="categoria-titulo">${categoria}</h3>
            contenedor.innerHTML += <div class="grid" id="grupo-${categoriaId}"></div>

            const grupo = document.getElementById(grupo-${categoriaId})

            grupos[categoria].forEach(item => {
                grupo.innerHTML += `
                    <div class="card">
                        <img src="${item.imagen}" alt="${item.nombre}" class="menu-img">
                        <h3>${item.nombre}</h3>
                        <p>Precio: $${item.precio}</p>
                        <p>Tiempo estimado base: ${item.tiempoBase} min</p>

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

                        ${
                            item.disponible
                                ? <button onclick="pedir(${item.id})">Pedir</button>
                                : <button disabled>Agotado</button>
                        }
                    </div>
                `
            })
        })
    } catch (error) {
        console.log(error)
        alert("Error cargando el menú")
    }
}

async function pedir(idProducto) {
    try {
        const item = menuData.find(p => p.id === idProducto)
        if (!item) return

        if (!item.disponible) {
            alert("Este producto está agotado")
            return
        }

        const metodoPago = document.getElementById("metodoPago").value
        const cantidad = Number(document.getElementById(cantidad-${idProducto}).value || 1)

        const res = await fetch("/api/pedido", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                restaurantId,
                mesa,
                producto: item.nombre,
                categoria: item.categoria,
                precio: item.precio * cantidad,
                cantidad,
                metodoPago,
                tiempoEstimado: item.tiempoBase
            })
        })

        if (!res.ok) throw new Error("No se pudo enviar el pedido")

        alert(Pedido enviado a cocina x${cantidad})
    } catch (error) {
        console.log(error)
        alert("Error enviando pedido")
    }
}

async function llamarMesero() {
    try {
        await fetch("/api/llamar-mesero", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                restaurantId,
                mesa,
                mensaje: "Mesa necesita atención"
            })
        })

        alert("Se avisó al mesero")
    } catch (error) {
        console.log(error)
        alert("Error llamando al mesero")
    }
}

function calcularTotales(subtotal) {
    const porcentaje = Number(document.getElementById("propinaSelect").value || 0)
    const valorPropina = Math.round(subtotal * (porcentaje / 100))
    const total = subtotal + valorPropina

    document.getElementById("subtotalMesa").textContent = Subtotal: $${subtotal}
    document.getElementById("valorPropina").textContent = Propina: $${valorPropina}
    document.getElementById("totalMesa").textContent = Total: $${total}
}

async function verFactura() {
    try {
        const porcentaje = Number(document.getElementById("propinaSelect").value || 0)
        const res = await fetch(/api/factura/mesa/${mesa}?restaurantId=${restaurantId}&propina=${porcentaje})
        const data = await res.json()

        const box = document.getElementById("facturaBox")
        if (!box) return

        let html = `
            <h3>Factura Mesa ${data.mesa}</h3>
        `

        if (!data.pedidos || data.pedidos.length === 0) {
            html += <p>No hay pedidos en la factura.</p>
        } else {
            data.pedidos.forEach(p => {
                html += `
                    <p>${p.producto} - $${p.precio}</p>
                `
            })
        }

        html += `
            <hr>
            <p>Subtotal: $${data.subtotal}</p>
            <p>Propina (${data.propina}%): $${data.valorPropina}</p>
            <p><strong>Total: $${data.total}</strong></p>
        `

        box.innerHTML = html
        box.scrollIntoView({
            behavior: "smooth"
        })
    } catch (error) {
        console.log(error)
    }
}

async function cargarMesa() {
    try {
        const res = await fetch(/api/pedidos/mesa/${mesa}?restaurantId=${restaurantId})
        const data = await res.json()

        const pedidos = data.pedidos
        subtotalActual = data.subtotal

        calcularTotales(subtotalActual)

        const lista = document.getElementById("misPedidos")
        lista.innerHTML = ""

        if (pedidos.length === 0) {
            document.getElementById("estadoPedido").textContent = "Esperando pedido..."
            document.getElementById("tiempoPedido").textContent = ""
            lista.innerHTML = <div class="card"><p>No hay pedidos todavía.</p></div>
            document.getElementById("facturaBox").innerHTML = "<p>Aún no hay factura.</p>"
            return
        }

        pedidos.forEach(p => {
            lista.innerHTML += `
                <div class="card">
                    <h3>${p.producto}</h3>
                    <p>Precio: $${p.precio}</p>
                    <p>Estado: ${p.estado}</p>
                    <p>Pago: ${textoMetodoPago(p.metodoPago)} - ${p.estadoPago}</p>
                </div>
            `
        })

        const ultimo = pedidos[0]
        document.getElementById("estadoPedido").textContent = mensajeEstado(ultimo.estado)
        document.getElementById("tiempoPedido").textContent =
            ultimo.estado === "preparando" ? Tiempo estimado: ${ultimo.tiempoEstimado} minutos : ""

        if (!primeraCarga && ultimo.estado !== ultimoEstadoMostrado) {
            if (ultimo.estado === "preparando") {
                playBeep()
                alert("🔔 Su comida se está preparando")
            }

            if (ultimo.estado === "listo") {
                playBeep()
                alert("🔔 Su comida está lista, espere unos segundos y el personal de mesa llevará su comida")
            }
        }

        ultimoEstadoMostrado = ultimo.estado
        primeraCarga = false

        await verFactura()
    } catch (error) {
        console.log(error)
    }
}

document.getElementById("propinaSelect").addEventListener("change", () => {
    calcularTotales(subtotalActual)
    verFactura()
})

socket.on("pedido:nuevo", (pedido) => {
    if (pedido.restaurantId === restaurantId) {
        cargarMesa()
    }
})

socket.on("pedido:actualizado", (pedido) => {
    if (pedido.restaurantId === restaurantId) {
        cargarMesa()
    }
})

socket.on("menu:actualizado", (payload) => {
    if (payload.restaurantId === restaurantId) {
        cargarMenu()
    }
})

cargarMenu()
cargarMesa()