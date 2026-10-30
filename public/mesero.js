// QR messages and waiter names are untrusted. Never interpolate raw values
// into the staff panel's innerHTML while a JWT is present in the browser.
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[char]);
}

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
// The server authenticates both Socket.IO and operational HTTP calls with JWT.
const meseroToken = localStorage.getItem("grukAuthToken") || "";
const socket = io({ auth: { token: meseroToken } });
function meseroAuthHeaders() {
  return { Authorization: "Bearer " + meseroToken };
}

function getRestaurantId() {
  const fromUrl = new URLSearchParams(window.location.search).get("restaurantId");
  const fromSession = localStorage.getItem("meseroRestaurantId");
  const fromInput = document.getElementById("restaurantIdInput");
  const inputValue = fromInput && fromInput.value.trim()
    ? fromInput.value.trim()
    : "";

  return fromUrl || fromSession || inputValue || "rest1";
}

function getMeseroNombreActual() {
  return localStorage.getItem("meseroNombre") || "";
}

async function atendiendoLlamado(id) {
  try {
    const restaurantId = getRestaurantId();

    const res = await fetch(`/api/llamados/${encodeURIComponent(id)}/atendiendo?restaurantId=${encodeURIComponent(restaurantId)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...meseroAuthHeaders()
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
    const res = await fetch(`/api/pedido/${encodeURIComponent(id)}/estado`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...meseroAuthHeaders()
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

    const res = await fetch(`/api/mesero/mesas?restaurantId=${encodeURIComponent(restaurantId)}`, { headers: meseroAuthHeaders() });
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
            <p>No hay solicitudes para ${escapeHtml(nombreMesero || "este mesero")}.</p>
          </div>
        `;
      } else {
        llamadasDelMesero.forEach(l => {
          // Inline handler receives only a canonical Mongo ObjectId, never HTML.
          if (!/^[a-f0-9]{24}$/i.test(String(l._id))) return;
          const safeId = String(l._id);
          listaLlamados.innerHTML += `
            <div class="card">
              <h3>Mesa ${escapeHtml(l.mesa)}</h3>
              <p>${escapeHtml(l.mensaje || "Solicitud de mesero")}</p>
              <p><strong>Mesero asignado:</strong> ${escapeHtml(l.meseroNombre || "Sin asignar")}</p>
              <p>Estado: ${l.estado === "atendiendo" ? "🟡 Atendiendo..." : "🔴 Pendiente"}</p>
              <button onclick="atendiendoLlamado('${safeId}')" ${l.estado === "atendiendo" ? "disabled" : ""}>
                ${l.estado === "atendiendo" ? "🟡 Atendiendo..." : "Atendiendo"}
              </button>
            </div>
          `;
        });
      }
    }

    const pedidosRes = await fetch(`/api/pedidos?restaurantId=${encodeURIComponent(restaurantId)}`, {
      headers: meseroAuthHeaders()
    });
    if (!pedidosRes.ok) throw Error("PEDIDOS_NO_AUTORIZADOS");
    const pedidos = await pedidosRes.json();
    if (!Array.isArray(pedidos)) throw Error("PEDIDOS_RESPUESTA_INVALIDA");

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
          if (!/^[a-f0-9]{24}$/i.test(String(p._id))) return;
          const safePedidoId = String(p._id);
          listaListos.innerHTML += `
            <div class="card">
              <h3>Mesa ${escapeHtml(p.mesa)}</h3>
              <p>${escapeHtml(p.producto)}</p>
              <p>$${escapeHtml(p.precio)}</p>
              <button onclick="entregarPedido('${safePedidoId}')">Entregado</button>
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

    const res = await fetch(`/api/mesero/mesas?restaurantId=${encodeURIComponent(restaurantId)}`, { headers: meseroAuthHeaders() });
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
          <p>No hay mesas con solicitudes para ${escapeHtml(nombreMesero || "este mesero")}.</p>
        </div>
      `;
      return;
    }

    mesasDelMesero.forEach(item => {
      lista.innerHTML += `
        <div class="card">
          <h3>Mesa ${escapeHtml(item.mesa)}</h3>
          <p>${escapeHtml(item.mensaje || "Solicitud de mesero")}</p>
          <p><strong>Mesero asignado:</strong> ${escapeHtml(item.meseroNombre || "Sin asignar")}</p>
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