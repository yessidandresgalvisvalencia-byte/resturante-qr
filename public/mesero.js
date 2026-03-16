const socket = io();

function getRestaurantId() {
  const input = document.getElementById("restaurantIdInput");
  return input ? input.value.trim() || "rest1" : "rest1";
}

async function atenderLlamado(id) {
  await fetch(`/api/llamados/${id}/atender`, {
    method: "PUT"
  });
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
    cargarEstadoMesas();
  } catch (error) {
    console.log(error);
    alert("Error marcando como atendiendo");
  }
}

async function entregarPedido(id) {
  try {
    const res = await fetch(`/api/pedido/${id}/estado`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ estado: "entregado" })
    });

    if (!res.ok) {
      alert("No se pudo marcar como entregado");
      return;
    }

    cargarMesero();
  } catch (error) {
    console.log(error);
    alert("Error entregando pedido");
  }
}

async function cargarMesero() {
  const restaurantId = getRestaurantId();

  const llamadosRes = await fetch(`/api/llamados?restaurantId=${restaurantId}`);
  const llamados = await llamadosRes.json();

  const llamadosPendientes = llamados.filter(
    l => l.estado === "pendiente" || l.estado === "atendiendo"
  );

  const listaLlamados = document.getElementById("listaLlamados");
  if (listaLlamados) {
    listaLlamados.innerHTML = "";

    llamadosPendientes.forEach(l => {
      listaLlamados.innerHTML += `
        <div class="card">
          <h3>Mesa ${l.mesa}</h3>
          <p>${l.mensaje || "Solicitud de mesero"}</p>
          <p>Estado: ${l.estado || "pendiente"}</p>
          <button onclick="atendiendoLlamado('${l._id}')">Atendiendo</button>
        </div>
      `;
    });
  }

  const pedidosRes = await fetch(`/api/pedidos?restaurantId=${restaurantId}`);
  const pedidos = await pedidosRes.json();

  const listos = pedidos.filter(p => p.estado === "listo");

  const listaListos = document.getElementById("listaListos");
  if (listaListos) {
    listaListos.innerHTML = "";

    listos.forEach(p => {
      listaListos.innerHTML += `
        <div class="card">
          <h3>Mesa ${p.mesa}</h3>
          <p>${p.producto}</p>
          <p>$${p.precio}</p>
          <button onclick="entregarPedido('${p._id}')">Entregado</button>
        </div>
      `;
    });
  }
}

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
          <h3>Mesa ${item.mesa}</h3>
          <p>${item.mensaje || "Solicitud de mesero"}</p>
          <p>Estado: ${item.estado || "pendiente"}</p>
        </div>
      `;
    });
  } catch (error) {
    console.log("Error cargando estado de mesas:", error);
  }
}

socket.on("llamado:nuevo", () => {
  cargarMesero();
  cargarEstadoMesas();
});

socket.on("llamado:actualizado", () => {
  cargarMesero();
  cargarEstadoMesas();
});

socket.on("pedido:actualizado", () => {
  cargarMesero();
});

cargarMesero();
cargarEstadoMesas();