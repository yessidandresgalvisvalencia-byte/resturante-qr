const socket = io();

function getRestaurantId() {
  const input = document.getElementById("restaurantIdInput");
  return input ? input.value.trim() || "rest1" : "rest1";
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
    console.log("Error marcando como atendiendo:", error);
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

    const data = await res.json();

    if (!res.ok) {
      alert(data.mensaje || "No se pudo marcar como entregado");
      return;
    }

    cargarMesero();
  } catch (error) {
    console.log("Error entregando pedido:", error);
    alert("Error entregando pedido");
  }
}

async function cargarMesero() {
  try {
    const restaurantId = getRestaurantId();

    // IMPORTANTE: leer desde la ruta que ya resume las solicitudes activas
    const res = await fetch(`/api/mesero/mesas?restaurantId=${restaurantId}`);
    if (!res.ok) {
      console.log("Error cargando solicitudes de mesero");
      return;
    }

    const mesas = await res.json();

    const listaLlamados = document.getElementById("listaLlamados");
    if (listaLlamados) {
      listaLlamados.innerHTML = "";

      if (!mesas.length) {
        listaLlamados.innerHTML = `
          <div class="card">
            <p>No hay solicitudes de mesero.</p>
          </div>
        `;
      } else {
        mesas.forEach(l => {
          listaLlamados.innerHTML += `
            <div class="card">
              <h3>Mesa ${l.mesa}</h3>
              <p>${l.mensaje || "Solicitud de mesero"}</p>
              <p><strong>Mesero asignado:</strong> ${l.meseroNombre || "Sin asignar"}</p>
              <p>Estado: ${l.estado === "atendiendo" ? "🟡 Atendiendo..." : "🔴 Pendiente"}</p>
              <button onclick="atendiendoLlamado('${l._id}')" ${l.estado === "atendiendo" ? "disabled" : ""}>
                ${l.estado === "atendiendo" ? "🟡 Atendiendo..." : "Atendiendo"}
              </button>
            </div>
          `;
        });
      }
    }

    const pedidosRes = await fetch(`/api/pedidos?restaurantId=${restaurantId}`);
    const pedidos = await pedidosRes.json();

    const listos = pedidos.filter(p => p.estado === "listo");

    const listaListos = document.getElementById("listaListos");
    if (listaListos) {
      listaListos.innerHTML = "";

      if (!listos.length) {
        listaListos.innerHTML = `
          <div class="card">
            <p>No hay pedidos listos.</p>
          </div>
        `;
      } else {
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
  } catch (error) {
    console.log("Error en cargarMesero:", error);
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
          <p><strong>Mesero asignado:</strong> ${item.meseroNombre || "Sin asignar"}</p>
          <p>Estado: ${item.estado === "atendiendo" ? "🟡 Atendiendo..." : "🔴 Pendiente"}</p>
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