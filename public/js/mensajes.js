let mensajesLaboralGRUK = [];

function getRestaurantIdMensajesGRUK() {
  return getRestaurantId();
}

function getAdminNombreGRUK() {
  return localStorage.getItem("adminUsuario") || "Administrador";
}

async function inicializarMensajesGRUK() {
  const restaurantId = getRestaurantIdMensajesGRUK();

  if (typeof socketEmpleadoGRUK !== "undefined") {
  socketEmpleadoGRUK.emit("laboral:unirse", restaurantId);

  if (typeof socket !== "undefined") {
  socket.emit("laboral:unirse", restaurantId);

  socket.off("laboral:mensaje:nuevo");
  socket.on("laboral:mensaje:nuevo", (mensaje) => {
      if (mensaje.restaurantId === restaurantId) {
        mensajesLaboralGRUK.push(mensaje);
        pintarMensajesLaboralGRUK();
      }
    });
  }

  await cargarMensajesLaboralGRUK();
}

async function cargarMensajesLaboralGRUK() {
  const restaurantId = getRestaurantIdMensajesGRUK();

  try {
    const res = await fetch(`/laboral/mensajes/general/${restaurantId}`);
    const data = await res.json();

    mensajesLaboralGRUK = data.ok ? data.mensajes || [] : [];

    pintarMensajesLaboralGRUK();

  } catch (error) {
    console.error("Error cargando mensajes:", error);
  }
}

async function enviarMensajeLaboralGRUK() {
  const input = document.getElementById("mensajeLaboralTextoGRUK");
  const texto = input?.value.trim();

  if (!texto) return;

  const body = {
    restaurantId: getRestaurantIdMensajesGRUK(),
    remitenteId: "admin",
    remitenteNombre: getAdminNombreGRUK(),
    remitenteRol: "admin",
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

  } catch (error) {
    console.error("Error enviando mensaje:", error);
    alert("Error enviando mensaje.");
  }
}

function pintarMensajesLaboralGRUK() {
  const contenedor = document.getElementById("listaMensajesLaboralGRUK");
  if (!contenedor) return;

  if (!mensajesLaboralGRUK.length) {
    contenedor.innerHTML = `
      <p style="color:#94a3b8;text-align:center;">
        No hay mensajes todavía.
      </p>
    `;
    return;
  }

  contenedor.innerHTML = mensajesLaboralGRUK.map(m => {
    const esAdmin = m.remitenteRol === "admin";

    return `
      <div style="
        display:flex;
        justify-content:${esAdmin ? "flex-end" : "flex-start"};
        margin-bottom:10px;
      ">
        <div style="
          max-width:70%;
          background:${esAdmin ? "#2563eb" : "#1e293b"};
          color:white;
          padding:10px 14px;
          border-radius:14px;
        ">
          <strong>${m.remitenteNombre || "Usuario"}</strong>
          <p style="margin:6px 0;">${m.mensaje}</p>
          <small style="opacity:.8;">
            ${new Date(m.createdAt || m.fecha || Date.now()).toLocaleTimeString("es-CO", {
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