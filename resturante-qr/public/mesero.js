function mostrarToast(mensaje, tipo = "info") {
  let container = document.getElementById("toastContainer");

  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${tipo}`;
  toast.innerText = mensaje;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);

  sonidoNotificacion();
  vibrar();
}

function sonidoNotificacion() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = 660;
    gain.gain.value = 0.05;

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {}
}

function vibrar() {
  if (navigator.vibrate) {
    navigator.vibrate(100);
  }
}
const socket = io();

function getRestaurantId() {
  const fromInput = document.getElementById("restaurantIdInput");
  if (fromInput && fromInput.value.trim()) {
    return fromInput.value.trim();
  }

  const fromUrl = new URLSearchParams(window.location.search).get("restaurantId");
  const fromSession = localStorage.getItem("meseroRestaurantId");

  return fromUrl || fromSession || "rest1";
}

function getMeseroNombreActual() {
  return localStorage.getItem("meseroNombre") || "";
}

async function atendiendoLlamado(id) {
  try {
    const restaurantId = getRestaurantId();

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

    const data = await res.json();

    if (!res.ok) {
      alert(data.mensaje || "No se pudo marcar como entregado");
      return;
    }

    cargarMesero();
  } catch (error) {
    console.log(error);
    alert("Error entregando pedido");
  }
}

async function cargarMesero() {
  try {
    const restaurantId = getRestaurantId();
    const nombreMesero = getMeseroNombreActual();

    const res = await fetch(`/api/mesero/mesas?restaurantId=${restaurantId}`);
    if (!res.ok) {
      console.log("Error cargando solicitudes del mesero");
      return;
    }

    const mesas = await res.json();
    const listaLlamados = document.getElementById("listaLlamados");

    if (listaLlamados) {
      listaLlamados.innerHTML = "";

      const llamadasDelMesero = mesas.filter(
        l => (l.meseroNombre || "").trim().toLowerCase() === nombreMesero.trim().toLowerCase()
      );

      if (!llamadasDelMesero.length) {
        listaLlamados.innerHTML = `
          <div class="card">
            <p>No hay solicitudes para ${nombreMesero || "este mesero"}.</p>
          </div>
        `;
      } else {
        llamadasDelMesero.forEach(l => {
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
    const restaurantId = getRestaurantId();
    const nombreMesero = getMeseroNombreActual();

    const res = await fetch(`/api/mesero/mesas?restaurantId=${restaurantId}`);
    if (!res.ok) return;

    const data = await res.json();
    const lista = document.getElementById("estadoMesas");
    if (!lista) return;

    lista.innerHTML = "";

    const mesasDelMesero = data.filter(
      item => (item.meseroNombre || "").trim().toLowerCase() === nombreMesero.trim().toLowerCase()
    );

    if (!mesasDelMesero.length) {
      lista.innerHTML = `
        <div class="card">
          <p>No hay mesas con solicitudes para ${nombreMesero || "este mesero"}.</p>
        </div>
      `;
      return;
    }

    mesasDelMesero.forEach(item => {
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