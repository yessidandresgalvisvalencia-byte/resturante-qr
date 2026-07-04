let mensajesEmpleadoGRUK = [];

function getRestaurantIdEmpleadoChatGRUK() {
  return restaurantIdEmpleado || new URLSearchParams(window.location.search).get("restaurantId") || "rest1";
}

function getEmpleadoChatActualGRUK() {
  return obtenerEmpleadoActualGRUK ? obtenerEmpleadoActualGRUK() : null;
}

async function inicializarChatEmpleadoGRUK() {
  const restaurantId = getRestaurantIdEmpleadoChatGRUK();

  if (typeof socket !== "undefined") {
    socket.emit("laboral:unirse", restaurantId);

    socket.off("laboral:mensaje:nuevo");
    socket.on("laboral:mensaje:nuevo", (mensaje) => {
      if (mensaje.restaurantId === restaurantId && mensaje.tipoChat === "general") {
        mensajesEmpleadoGRUK.push(mensaje);
        pintarMensajesEmpleadoGRUK();
      }
    });
  }

  await cargarMensajesEmpleadoGRUK();
}

async function cargarMensajesEmpleadoGRUK() {
  const restaurantId = getRestaurantIdEmpleadoChatGRUK();

  try {
    const res = await fetch(`/laboral/mensajes/general/${restaurantId}`);
    const data = await res.json();

    mensajesEmpleadoGRUK = data.ok ? data.mensajes || [] : [];

    pintarMensajesEmpleadoGRUK();

  } catch (error) {
    console.error("Error cargando mensajes empleado:", error);
  }
}

async function enviarMensajeEmpleadoGRUK() {
  const empleado = getEmpleadoChatActualGRUK();

  if (!empleado) {
    alert("Primero debes identificarte.");
    return;
  }

  const input = document.getElementById("mensajeEmpleadoTextoGRUK");
  const texto = input?.value.trim();

  if (!texto) return;

  const body = {
    restaurantId: getRestaurantIdEmpleadoChatGRUK(),
    remitenteId: empleado._id,
    remitenteNombre: empleado.nombre,
    remitenteRol: "empleado",
    tipoChat: "general",
    mensaje: texto
  };

  try {
    const res = await fetch("/laboral/mensajes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    if (!data.ok) {
      alert(data.mensaje || "No se pudo enviar el mensaje.");
      return;
    }

    input.value = "";

await cargarMensajesEmpleadoGRUK();

  } catch (error) {
    console.error("Error enviando mensaje empleado:", error);
    alert("Error enviando mensaje.");
  }
}

function pintarMensajesEmpleadoGRUK() {
  const contenedor = document.getElementById("listaMensajesEmpleadoGRUK");
  const empleado = getEmpleadoChatActualGRUK();

  if (!contenedor) return;

  if (!mensajesEmpleadoGRUK.length) {
    contenedor.innerHTML = `
      <p style="color:#94a3b8;text-align:center;">
        No hay mensajes todavía.
      </p>
    `;
    return;
  }

  contenedor.innerHTML = mensajesEmpleadoGRUK.map(m => {
    const soyYo = empleado && String(m.remitenteId) === String(empleado._id);

    return `
      <div style="
        display:flex;
        justify-content:${soyYo ? "flex-end" : "flex-start"};
        margin-bottom:10px;
      ">
        <div style="
          max-width:70%;
          background:${soyYo ? "#2563eb" : "#1e293b"};
          color:white;
          padding:10px 14px;
          border-radius:14px;
        ">
          <strong>${m.remitenteNombre || "Usuario"}</strong>
          <p style="margin:6px 0;">${m.mensaje}</p>
          <small style="opacity:.8;">
            ${new Date(m.createdAt || Date.now()).toLocaleTimeString("es-CO", {
              hour: "2-digit",
              minute: "2-digit"
            })}
          </small>
        </div>
      </div>
    `;
  }).join("");

  contenedor.scrollTop = contenedor.scrollHeight;
}

const mostrarSeccionEmpleadoOriginalGRUK = window.mostrarSeccionEmpleado;

window.mostrarSeccionEmpleado = function(seccion, boton) {
  mostrarSeccionEmpleadoOriginalGRUK(seccion, boton);

  if (seccion === "mensajes") {
    inicializarChatEmpleadoGRUK();
  }
};

window.enviarMensajeEmpleadoGRUK = enviarMensajeEmpleadoGRUK;