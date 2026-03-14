const socket = io()
function actualizarLinksRestaurant() {
  const restaurantId = document.getElementById("restaurantIdInput").value.trim() || "rest1";
  const baseUrl = window.location.origin;

  document.getElementById("restaurantIdActual").textContent = restaurantId;

  const menuUrl = `{baseUrl}/?restaurantId=${restaurantId}&mesa=1`;
  const cocinaUrl = `${baseUrl}/cocina.html?restaurantId=${restaurantId}`;
  const meseroUrl = `${baseUrl}/mesero.html?restaurantId=${restaurantId}`;
  const adminUrl = `${baseUrl}/admin.html?restaurantId=${restaurantId}`;

  document.getElementById("linkMenu").href = menuUrl;
  document.getElementById("linkMenu").textContent = menuUrl;

  document.getElementById("linkCocina").href = cocinaUrl;
  document.getElementById("linkCocina").textContent = cocinaUrl;

  document.getElementById("linkMesero").href = meseroUrl;
  document.getElementById("linkMesero").textContent = meseroUrl;

  document.getElementById("linkAdmin").href = adminUrl;
  document.getElementById("linkAdmin").textContent = adminUrl;
}

document.getElementById("baseUrl").value = window.location.origin

function getRestaurantId() {
    return document.getElementById("restaurantIdInput").value.trim() || "rest1"
}

async function cargarAdmin() {
    const restaurantId = getRestaurantId()

    const resumenRes = await fetch(`/api/admin/resumen?restaurantId=${restaurantId}`)
    const resumen = await resumenRes.json()

    document.getElementById("totalVendido").textContent = `$${resumen.totalVendido}`
    document.getElementById("pedidosActivos").textContent = resumen.pedidosActivos

    const top = document.getElementById("topProductos")
    top.innerHTML = ""
    resumen.topProductos.forEach(item => {
        top.innerHTML += `
            <div class="card">
                <h3>${item.producto}</h3>
                <p>Ventas: ${item.cantidad}</p>
            </div>
        `
    })

    const historial = document.getElementById("historialVentas")
    historial.innerHTML = ""
    resumen.historial.forEach(p => {
        historial.innerHTML += `
            <div class="card">
                <p><strong>Mesa ${p.mesa}</strong></p>
                <p>${p.producto}</p>
                <p>$${p.precio}</p>
                <p>${p.estado}</p>
                <p>${p.metodoPago} - ${p.estadoPago}</p>
            </div>
        `
    })

    const menuRes = await fetch(`/api/menu?restaurantId=${restaurantId}`)
    const menu = await menuRes.json()

    const stockLista = document.getElementById("stockLista")
    stockLista.innerHTML = ""

    menu.forEach(item => {
        stockLista.innerHTML += `
            <div class="card">
                <h3>${item.nombre}</h3>
                <p>Categoría: ${item.categoria}</p>
                <p>Disponible: ${item.disponible ? "Sí" : "No"}</p>
                <button onclick="cambiarStock(${item.id}, ${!item.disponible})">
                    ${item.disponible ? "Marcar agotado" : "Marcar disponible"}
                </button>
            </div>
        `
    })
}

async function cambiarStock(id, disponible) {
    const restaurantId = getRestaurantId()

    await fetch(`/api/menu/${id}/stock`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ restaurantId, disponible })
    })

    cargarAdmin()
}

async function generarQRs() {
    const baseUrl = document.getElementById("baseUrl").value.trim()
    const numeroMesas = Number(document.getElementById("numeroMesas").value)
    const restaurantId = getRestaurantId()
    const contenedor = document.getElementById("qrs")

    contenedor.innerHTML = ""

    for (let mesa = 1; mesa <= numeroMesas; mesa++) {
        const res = await fetch(`/api/qr/${mesa}?restaurantId=${restaurantId}&baseUrl=${encodeURIComponent(baseUrl)}`)
        const data = await res.json()

        contenedor.innerHTML += `
            <div class="card">
                <h3>Mesa ${data.mesa}</h3>
                <img class="qr-img" src="${data.dataUrl}" alt="QR Mesa ${data.mesa}">
                <p class="url-pequena">${data.url}</p>
            </div>
        `
    }
}

socket.on("pedido:nuevo", () => {
    cargarAdmin()
})

socket.on("pedido:actualizado", () => {
    cargarAdmin()
})

socket.on("menu:actualizado", () => {
    cargarAdmin()
})

cargarAdmin()
const params = new URLSearchParams(window.location.search);
const restaurantIdUrl = params.get("restaurantId") || "rest1";

document.getElementById("restaurantIdInput").value = restaurantIdUrl;

actualizarLinksRestaurant();