alert("JS NUEVO CARGADO");
const paramsEmpleadoTurnos = new URLSearchParams(window.location.search);

const restaurantIdEmpleado =
  paramsEmpleadoTurnos.get("restaurantId") ||
  paramsEmpleadoTurnos.get("restaurant") ||
  "rest1";

let empleadoActualGRUK = null;
let empleadoIdActual = null;
let empleadosLaboralesGRUK = [];

async function obtenerEmpleadosTurnosGRUK() {
  const res = await fetch(`/laboral/empleados/${restaurantIdEmpleado}`);
  const data = await res.json();

  if (!data.ok) {
    console.error(data.mensaje);
    return [];
  }

  return data.empleados || [];
}

function obtenerAsistenciasGRUK() {
  return (
    JSON.parse(localStorage.getItem(`asistencias_GRUK_${restaurantIdEmpleado}`)) ||
    []
  );
}

function guardarAsistenciasGRUK(asistencias) {
  localStorage.setItem(
    `asistencias_GRUK_${restaurantIdEmpleado}`,
    JSON.stringify(asistencias)
  );
}

function obtenerEmpleadoActualGRUK() {
  return empleadoActualGRUK;
}

function fechaISOHoyGRUK() {
  return new Date().toISOString().slice(0, 10);
}

function horaActualGRUK() {
  return new Date().toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function fechaActualGRUK() {
  return new Date().toLocaleDateString("es-CO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}


function crearPantallaIdentificacionGRUK() {
  document.body.insertAdjacentHTML("afterbegin", `
    <div id="pantallaIdentificacionGRUK" class="modalOverlay activo">
      <div class="modalGRUK">
        <h2>Verificación facial GRUK</h2>
        <p>
          Escanea tu rostro para ingresar automáticamente a tu portal laboral.
        </p>

        <div class="camaraBox">
          <img id="selfieIdentificacionPreview" src="" style="display:none;">
        </div>

        <br>

        <button class="btnPrincipal" onclick="identificarEmpleadoPorRostroGRUK()">
          📷 Tomar foto e ingresar
        </button>
      </div>
    </div>
  `);
}

async function tomarSelfieGRUK() {
  return new Promise(resolve => {
    const input = document.createElement("input");

    input.type = "file";
    input.accept = "image/*";
    input.capture = "user";

    input.onchange = () => {
      const file = input.files[0];

      if (!file) {
        resolve("");
        return;
      }

      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    };

    input.click();
  });
}
function mostrarCargaIdentificacionGRUK(texto) {
  const estado = document.getElementById("estadoIdentificacionGRUK");
  const estadoFace = document.getElementById("estadoFace");

  if (estado) estado.textContent = texto;
  if (estadoFace) estadoFace.textContent = texto;

  const modal = document.getElementById("pantallaIdentificacionGRUK");

  if (modal) {
    const caja = modal.querySelector(".modalGRUK");

    if (caja) {
      caja.innerHTML = `
        <h2>Verificación facial GRUK</h2>
        <div class="loaderGRUK"></div>
        <h3 id="textoCargaGRUK">${texto}</h3>
        <p>Estamos validando tu identidad de forma segura.</p>
      `;
    }
  }
}

function registrarIngresoEmpleadoGRUK(empleado, selfie) {
  const ingresos =
    JSON.parse(localStorage.getItem(`ingresos_GRUK_${restaurantIdEmpleado}`)) || [];

  ingresos.push({
    id: Date.now(),
    empleadoId: empleado._id,
    empleadoNombre: empleado.nombre,
    cargo: empleado.cargo || "Empleado",
    selfie,
    fecha: new Date().toISOString(),
    tipo: "reconocimiento_facial"
  });

  localStorage.setItem(
    `ingresos_GRUK_${restaurantIdEmpleado}`,
    JSON.stringify(ingresos)
  );
}

function abrirPerfilEmpleadoReconocidoGRUK() {
  const identificacion = document.getElementById("seccion-identificacion");
  const perfil = document.getElementById("seccion-perfil");

  if (identificacion) identificacion.classList.remove("activa");
  if (perfil) perfil.classList.add("activa");

  mostrarSeccionEmpleado("perfil");
}
function mostrarBienvenidaGRUK(empleado) {
  const horaActual = new Date();
  const hora = horaActual.getHours();

  let saludo = "Hola";

  if (hora >= 5 && hora < 12) {
    saludo = "Buenos días";
  } else if (hora >= 12 && hora < 18) {
    saludo = "Buenas tardes";
  } else {
    saludo = "Buenas noches";
  }

  const horaTexto = horaActual.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit"
  });

  const fechaTexto = horaActual.toLocaleDateString("es-CO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  const bienvenida = document.createElement("div");
  bienvenida.className = "bienvenidaGRUK";
  bienvenida.innerHTML = `
    <div class="bienvenidaCardGRUK">
      <div class="bienvenidaLogoGRUK">GRUK</div>

      <h1>${saludo}, ${empleado.nombre} 👋</h1>

      <p class="bienvenidaOkGRUK">✅ Identidad verificada correctamente</p>

      <p>
        Te damos la bienvenida a una nueva jornada. Deseamos que este día esté lleno de
        excelentes resultados, crecimiento, productividad y logros. Recuerda que cada
        esfuerzo suma al éxito del equipo.
      </p>

      <div class="bienvenidaInfoGRUK">
        <span>🕒 ${horaTexto}</span>
        <span>📅 ${fechaTexto}</span>
      </div>

      <strong>¡Vamos por un gran día! 💙🚀</strong>
    </div>
  `;

  document.body.appendChild(bienvenida);

  setTimeout(() => {
    bienvenida.remove();
  }, 3200);
}
async function identificarEmpleadoPorRostroGRUK() {
  console.log("BOTÓN TOMAR FOTO FUNCIONÓ");

  try {
    

    const selfie = await tomarSelfieGRUK();

    if (!selfie) {
      alert("Debes tomar una foto para ingresar.");

      return;
    }

    const res = await fetch("/laboral/reconocer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        restaurantId: restaurantIdEmpleado,
        selfie
      })
    });

    const data = await res.json();

    if (!data.ok || !data.empleado) {
      if (data.requiereSeleccionManual && data.empleados?.length) {
        mostrarSeleccionManualEmpleadoGRUK(data.empleados, selfie);
        return;
      }

      alert(data.mensaje || "No se reconoció el empleado.");


      return;
    }

    empleadoActualGRUK = data.empleado;
    empleadoIdActual = data.empleado._id;

    const modal = document.getElementById("pantallaIdentificacionGRUK");
    if (modal) modal.remove();

    actualizarVistaEmpleadoGRUK();
mostrarBienvenidaGRUK(data.empleado);
mostrarSeccionEmpleado("perfil");

  } catch (error) {
    console.error(error);
    alert("No fue posible validar la identidad del empleado.");


  }
}

window.identificarEmpleadoPorRostroGRUK = identificarEmpleadoPorRostroGRUK;

function actualizarVistaEmpleadoGRUK() {
  const empleado = obtenerEmpleadoActualGRUK();

  if (!empleado) return;

  document.getElementById("nombreEmpleadoActual").textContent =
    empleado.nombre;

  document.getElementById("cargoEmpleadoActual").textContent =
    empleado.cargo || "Empleado";

  if (empleado.fotoBase) {
    document.getElementById("fotoEmpleadoActual").src = empleado.fotoBase;
    document.getElementById("fotoVerificacion").src = empleado.fotoBase;
  }

  document.getElementById("fechaActual").textContent =
    fechaActualGRUK();

  document.getElementById("estadoFace").textContent =
    "Empleado reconocido";

  document.getElementById("estadoVerificacionVisual").textContent =
    "✔ Verificado";

  cargarAsistenciaHoyGRUK();
  renderizarPanelEmpleadoGRUK();
}

function cargarAsistenciaHoyGRUK() {
  const empleado = obtenerEmpleadoActualGRUK();

  if (!empleado) return;

  const asistencias = obtenerAsistenciasGRUK();

  const hoy = fechaISOHoyGRUK();

  const asistencia = asistencias.find(a =>
    String(a.empleadoId) === String(empleado._id) &&
    a.fecha === hoy
  );

  if (!asistencia) {
    document.getElementById("estadoMarcacion").textContent = "Esperando";
    document.getElementById("horaEntradaReal").textContent = "--:--";
    document.getElementById("horasTrabajadas").textContent = "0h";
    return;
  }

  if (asistencia.entradaReal) {
    document.getElementById("horaEntradaReal").textContent =
      asistencia.horaEntradaTexto || "--:--";

    document.getElementById("estadoMarcacion").textContent =
      asistencia.salidaReal ? "Turno completado" : "Entrada registrada";
  }

  if (asistencia.gpsEntrada) {
    document.getElementById("ubicacionActual").textContent =
      asistencia.gpsEntrada.mensaje;
  }

  if (asistencia.selfieEntrada) {
    document.getElementById("fotoVerificacion").src =
      asistencia.selfieEntrada;
  }

  if (asistencia.horasTrabajadas) {
    document.getElementById("horasTrabajadas").textContent =
      `${asistencia.horasTrabajadas.toFixed(2)}h`;
  }
}

function obtenerUbicacionGRUK() {
  return new Promise(resolve => {
    if (!navigator.geolocation) {
      resolve({
        ok: false,
        mensaje: "GPS no disponible",
        lat: null,
        lng: null
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        resolve({
          ok: true,
          mensaje: "Ubicación validada",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
      },
      () => {
        resolve({
          ok: false,
          mensaje: "No se pudo obtener ubicación",
          lat: null,
          lng: null
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000
      }
    );
  });
}

async function marcarEntradaGRUK() {
  const empleado = obtenerEmpleadoActualGRUK();

  if (!empleado) {
    alert("Primero debes identificarte con reconocimiento facial.");
    return;
  }

  const hoy = fechaISOHoyGRUK();

  const asistencias = obtenerAsistenciasGRUK();

  const yaExiste = asistencias.find(a =>
  String(a.empleadoId) === String(empleado._id) &&
  a.fecha === hoy
);

  if (yaExiste && yaExiste.entradaReal) {
    alert("Ya registraste entrada hoy.");
    return;
  }

  document.getElementById("estadoFace").textContent =
    "Tomando selfie...";

  const selfie = await tomarSelfieGRUK();

  if (!selfie) {
    alert("Debes tomar una selfie para marcar entrada.");
    return;
  }

  document.getElementById("estadoFace").textContent =
    "Selfie registrada";

  document.getElementById("ubicacionActual").textContent =
    "Validando GPS...";

  const gps = await obtenerUbicacionGRUK();

  const asistencia = {
    id: Date.now(),
    empleadoId: empleadoIdActual,
    empleadoNombre: empleado.nombre,
    cargo: empleado.cargo,
    fecha: hoy,
    entradaReal: new Date().toISOString(),
    horaEntradaTexto: horaActualGRUK(),
    selfieEntrada: selfie,
    gpsEntrada: gps,
    salidaReal: null,
    selfieSalida: null,
    gpsSalida: null,
    horasTrabajadas: 0,
    horasExtra: 0,
    dobleTurno: false,
    estado: "entrada_registrada",
    verificacionFacial: "empleado_reconocido"
  };

  asistencias.push(asistencia);

  guardarAsistenciasGRUK(asistencias);

  document.getElementById("fotoVerificacion").src = selfie;
  document.getElementById("horaEntradaReal").textContent =
    asistencia.horaEntradaTexto;

  document.getElementById("ubicacionActual").textContent =
    gps.mensaje;

  document.getElementById("estadoMarcacion").textContent =
    "Entrada registrada";

  renderizarPanelEmpleadoGRUK();

  alert("Entrada registrada correctamente.");
}

async function marcarSalidaGRUK() {
  const empleado = obtenerEmpleadoActualGRUK();

  if (!empleado) {
    alert("Primero debes identificarte con reconocimiento facial.");
    return;
  }

  const hoy = fechaISOHoyGRUK();

  const asistencias = obtenerAsistenciasGRUK();

  const asistencia = asistencias.find(a =>
  String(a.empleadoId) === String(empleado._id) &&
  a.fecha === hoy
);

  if (!asistencia || !asistencia.entradaReal) {
    alert("Primero debes marcar entrada.");
    return;
  }

  if (asistencia.salidaReal) {
    alert("Ya registraste salida hoy.");
    return;
  }

  document.getElementById("estadoFace").textContent =
    "Tomando selfie de salida...";

  const selfie = await tomarSelfieGRUK();

  if (!selfie) {
    alert("Debes tomar una selfie para marcar salida.");
    return;
  }

  const gps = await obtenerUbicacionGRUK();

  const salida = new Date();
  const entrada = new Date(asistencia.entradaReal);

  const horas =
    (salida.getTime() - entrada.getTime()) / (1000 * 60 * 60);

  asistencia.salidaReal = salida.toISOString();
  asistencia.horaSalidaTexto = horaActualGRUK();
  asistencia.selfieSalida = selfie;
  asistencia.gpsSalida = gps;
  asistencia.horasTrabajadas = Number(horas.toFixed(2));
  asistencia.estado = "turno_completado";

  guardarAsistenciasGRUK(asistencias);

  document.getElementById("fotoVerificacion").src = selfie;
  document.getElementById("ubicacionActual").textContent = gps.mensaje;
  document.getElementById("estadoMarcacion").textContent =
    "Turno completado";
  document.getElementById("horasTrabajadas").textContent =
    `${asistencia.horasTrabajadas}h`;

  renderizarPanelEmpleadoGRUK();

  alert("Salida registrada correctamente.");
}

async function solicitarHoraExtra() {
  const empleado = obtenerEmpleadoActualGRUK();

  if (!empleado) {
    alert("Primero debes identificarte con reconocimiento facial.");
    return;
  }

  const res = await fetch("/laboral/solicitudes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      restaurantId: restaurantIdEmpleado,
      empleadoId: empleado._id,
      empleadoNombre: empleado.nombre,
      tipo: "hora_extra"
    })
  });

  const data = await res.json();

  if (!data.ok) {
    alert(data.mensaje);
    return;
  }

  alert("Solicitud de hora extra enviada correctamente.");
  renderizarPanelEmpleadoGRUK();
}

async function solicitarDobleTurno() {
  const empleado = obtenerEmpleadoActualGRUK();

  if (!empleado) {
    alert("Primero debes identificarte con reconocimiento facial.");
    return;
  }

  const res = await fetch("/laboral/solicitudes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      restaurantId: restaurantIdEmpleado,
      empleadoId: empleado._id,
      empleadoNombre: empleado.nombre,
      tipo: "doble_turno"
    })
  });

  const data = await res.json();

  if (!data.ok) {
    alert(data.mensaje);
    return;
  }

  alert("Solicitud de doble turno enviada correctamente.");
  renderizarPanelEmpleadoGRUK();
}

function mostrarSeccionEmpleado(seccion, boton) {
  document.querySelectorAll(".seccionEmpleado").forEach(s => {
    s.classList.remove("activa");
  });

  const activa = document.getElementById(`seccion-${seccion}`);

  if (activa) {
    activa.classList.add("activa");
  }

  document.querySelectorAll(".sidebar nav button").forEach(b => {
    b.classList.remove("menuActivo");
  });

  if (boton) {
    boton.classList.add("menuActivo");
  }

  renderizarPanelEmpleadoGRUK();
}

async function renderizarPanelEmpleadoGRUK() {
  const empleado = obtenerEmpleadoActualGRUK();

  if (!empleado) return;

  const asistencias = obtenerAsistenciasGRUK().filter(a =>
  String(a.empleadoId) === String(empleado._id)
);

   const resSolicitudes = await fetch(`/laboral/solicitudes/${restaurantIdEmpleado}`);
const dataSolicitudes = await resSolicitudes.json();

const solicitudes = dataSolicitudes.ok
  ? dataSolicitudes.solicitudes
  : [];
  const solicitudesEmpleado =
  solicitudes.filter(s => String(s.empleadoId) === String(empleado._id));
  
  const hoy = fechaISOHoyGRUK();

  const asistenciaHoy =
    asistencias.find(a => a.fecha === hoy);

  const detalleTurnoHoy = document.getElementById("detalleTurnoHoy");
  if (detalleTurnoHoy) {
    detalleTurnoHoy.innerHTML = asistenciaHoy
      ? `
        <div class="turnoCard">
          <h3>Turno de hoy</h3>
          <p><strong>Entrada:</strong> ${asistenciaHoy.horaEntradaTexto || "Sin marcar"}</p>
          <p><strong>Salida:</strong> ${asistenciaHoy.horaSalidaTexto || "Sin marcar"}</p>
          <p><strong>Horas trabajadas:</strong> ${asistenciaHoy.horasTrabajadas || 0}h</p>
          <p><strong>Estado:</strong> ${asistenciaHoy.estado}</p>
        </div>
      `
      : `
        <div class="turnoCard">
          <h3>Sin marcación hoy</h3>
          <p>Aún no has registrado entrada para el día de hoy.</p>
        </div>
      `;
  }

  const listaMisTurnos = document.getElementById("listaMisTurnos");
  if (listaMisTurnos) {
    listaMisTurnos.innerHTML = asistencias.length
      ? asistencias.map(a => `
        <div class="turnoCard">
          <h3>${a.fecha}</h3>
          <p><strong>Entrada:</strong> ${a.horaEntradaTexto || "Sin marcar"}</p>
          <p><strong>Salida:</strong> ${a.horaSalidaTexto || "Sin marcar"}</p>
          <p><strong>Horas:</strong> ${a.horasTrabajadas || 0}h</p>
          <p><strong>Estado:</strong> ${a.estado}</p>
        </div>
      `).join("")
      : `<p>No tienes turnos completados todavía.</p>`;
  }

  const listaHorasExtra = document.getElementById("listaHorasExtraEmpleado");
  if (listaHorasExtra) {
    const extras = solicitudesEmpleado.filter(s => s.tipo === "hora_extra");

    listaHorasExtra.innerHTML = extras.length
      ? extras.map(s => `
        <div class="turnoCard">
          <h3>Solicitud de hora extra</h3>
          <p><strong>Fecha:</strong> ${new Date(s.fecha).toLocaleString("es-CO")}</p>
          <p><strong>Estado:</strong> ${s.estado}</p>
        </div>
      `).join("")
      : `<p>No tienes solicitudes de hora extra.</p>`;
  }

  const listaDoble = document.getElementById("listaDobleTurnoEmpleado");
  if (listaDoble) {
    const dobles = solicitudesEmpleado.filter(s => s.tipo === "doble_turno");

    listaDoble.innerHTML = dobles.length
      ? dobles.map(s => `
        <div class="turnoCard">
          <h3>Solicitud de doble turno</h3>
          <p><strong>Fecha:</strong> ${new Date(s.fecha).toLocaleString("es-CO")}</p>
          <p><strong>Estado:</strong> ${s.estado}</p>
        </div>
      `).join("")
      : `<p>No tienes solicitudes de doble turno.</p>`;
  }

  const listaMarcaciones = document.getElementById("listaMarcacionesEmpleado");
  if (listaMarcaciones) {
    listaMarcaciones.innerHTML = asistencias.length
      ? asistencias.map(a => `
        <div class="turnoCard">
          <h3>Marcación ${a.fecha}</h3>
          <p><strong>Entrada:</strong> ${a.horaEntradaTexto || "Sin entrada"}</p>
          <p><strong>Salida:</strong> ${a.horaSalidaTexto || "Sin salida"}</p>
          <p><strong>GPS entrada:</strong> ${a.gpsEntrada?.mensaje || "No registrado"}</p>
          <p><strong>GPS salida:</strong> ${a.gpsSalida?.mensaje || "No registrado"}</p>
        </div>
      `).join("")
      : `<p>No tienes marcaciones registradas.</p>`;
  }

  const perfil = document.getElementById("perfilEmpleadoGRUK");
  if (perfil) {
    perfil.innerHTML = `
      <div class="turnoCard">
        <h3>${empleado.nombre}</h3>
        <p><strong>Documento:</strong> ${empleado.documento}</p>
        <p><strong>Cargo:</strong> ${empleado.cargo}</p>
        <p><strong>Área:</strong> ${empleado.area}</p>
        <p><strong>Contrato:</strong> ${empleado.contrato}</p>
        <p><strong>Salario:</strong> ${formatoCOPEmpleado(empleado.salario)}</p>
        <p><strong>Valor hora:</strong> ${formatoCOPEmpleado(empleado.valorHora)}</p>
      </div>
    `;
  }
}

function formatoCOPEmpleado(valor) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(Number(valor || 0));
}

document.addEventListener("DOMContentLoaded", () => {
  crearPantallaIdentificacionGRUK();

  document.getElementById("fechaActual").textContent =
    fechaActualGRUK();
});
function mostrarSeleccionManualEmpleadoGRUK(empleados, selfie) {
  const modal = document.getElementById("pantallaIdentificacionGRUK");

  if (!modal) return;

  modal.querySelector(".modalGRUK").innerHTML = `
    <h2>Selecciona tu perfil</h2>
    <p>GRUK guardó tu selfie como evidencia. Selecciona tu nombre para ingresar.</p>

    <div style="display:grid;gap:12px;margin-top:18px;">
      ${empleados.map(e => `
        <button class="btnSecundario" onclick='ingresarEmpleadoManualGRUK(${JSON.stringify(e)}, "${selfie}")'>
          ${e.fotoBase ? `<img src="${e.fotoBase}" width="45" height="45" style="border-radius:50%;object-fit:cover;margin-right:10px;vertical-align:middle;">` : ""}
          ${e.nombre} · ${e.cargo || "Empleado"}
        </button>
      `).join("")}
    </div>
  `;
}

function ingresarEmpleadoManualGRUK(empleado, selfie) {
  empleadoActualGRUK = empleado;
  empleadoIdActual = empleado._id;

  localStorage.setItem(
    `empleadoRecordado_GRUK_${restaurantIdEmpleado}`,
    empleado._id
  );

  const modal = document.getElementById("pantallaIdentificacionGRUK");
  if (modal) modal.remove();

  actualizarVistaEmpleadoGRUK();
  mostrarSeccionEmpleado("perfil");

  alert(`Bienvenido/a ${empleado.nombre}`);
}