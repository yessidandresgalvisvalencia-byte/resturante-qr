const socket = io()

function getRestaurantId() {
    return document.getElementById("restaurantIdInput").value.trim() || "rest1"
}

async function atenderLlamado(id) {
    await fetch(`/api/llamados/${id}/atender`, {
        method: "PUT"
    })
}

async function atendiendoLlamado(id) {
  try {
    const params = new URLSearchParams(window.location.search);
    const restaurantId = params.get("restaurantId") || "rest1";

    const res = await fetch(`/api/llamados/${id}/atendiendo?restaurantId=${restaurantId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      }
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "No se pudo marcar como atendiendo");
      return;
    }

    cargarMesero();
  } catch (error) {
    console.log(error);
    alert("Error marcando como atendiendo");
  }
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
async function cargarEstadoMesas() {
  try {
    const restaurantId = new URLSearchParams(window.location.search).get("restaurantId") || "rest1";
    const res = await fetch(`/api/mesero/mesas?restaurantId=${restaurantId}`);
    if (!res.ok) return;

    const data = await res.json();
    const lista = document.getElementById("estadoMesas");
    if (!lista) return;

    lista.innerHTML = "";

    if (!data.length) {
      lista.innerHTML = `
        <div class="card">
          <p>No hay mesas con solicitudes todavía.</p>
        </div>
      `;
      return;
    }

    data.forEach(item => {
     lista.innerHTML += `
  <div class="card">
    <h3>Mesa ${llamado.mesa}</h3>
    <p>${llamado.mensaje || "Solicitud de mesero"}</p>
    <p>Estado: ${llamado.estado || "pendiente"}</p>
    <button onclick="atendiendoLlamado('${llamado._id}')">Atendiendo</button>
  </div>
`;
    });
  } catch (error) {
    console.log("Error cargando estado de mesas:", error);
  }
}
socket.on("llamado:nuevo", () => {
  cargarEstadoMesas();
});

socket.on("llamado:actualizado", () => {
  cargarEstadoMesas();
});
cargarEstadoMesas();