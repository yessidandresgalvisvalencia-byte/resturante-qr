const paramsEmpleadoTurnos = new URLSearchParams(window.location.search);

const restaurantIdEmpleado =
  paramsEmpleadoTurnos.get("restaurantId") ||
  paramsEmpleadoTurnos.get("restaurant") ||
  "rest1";

const empleadoIdActual =
  Number(paramsEmpleadoTurnos.get("empleadoId") || 0);

function obtenerEmpleadosTurnosGRUK() {
  return (
    JSON.parse(localStorage.getItem(`personal_GRUK_${restaurantIdEmpleado}`)) ||
    []
  );
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
  const empleados = obtenerEmpleadosTurnosGRUK();

  return empleados.find(e => Number(e.id) === empleadoIdActual) || null;
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

function actualizarVistaEmpleadoGRUK() {
  const empleado = obtenerEmpleadoActualGRUK();

  if (!empleado) {
    document.getElementById("nombreEmpleadoActual").textContent =
      "Empleado no encontrado";

    document.getElementById("cargoEmpleadoActual").textContent =
      "Verifica el link";

    return;
  }

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

  cargarAsistenciaHoyGRUK();
}
renderizarPanelEmpleadoGRUK();
function cargarAsistenciaHoyGRUK() {
  const asistencias = obtenerAsistenciasGRUK();

  const hoy = fechaISOHoyGRUK();

  const asistencia = asistencias.find(a =>
    Number(a.empleadoId) === empleadoIdActual &&
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

async function marcarEntradaGRUK() {
  const empleado = obtenerEmpleadoActualGRUK();

  if (!empleado) {
    alert("Empleado no encontrado.");
    return;
  }

  const hoy = fechaISOHoyGRUK();

  const asistencias = obtenerAsistenciasGRUK();

  const yaExiste = asistencias.find(a =>
    Number(a.empleadoId) === empleadoIdActual &&
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
    verificacionFacial: "pendiente_comparacion"
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

  alert("Entrada registrada correctamente.");
}

async function marcarSalidaGRUK() {
  const hoy = fechaISOHoyGRUK();

  const asistencias = obtenerAsistenciasGRUK();

  const asistencia = asistencias.find(a =>
    Number(a.empleadoId) === empleadoIdActual &&
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

  alert("Salida registrada correctamente.");
}

function solicitarHoraExtra() {
  const solicitudes =
    JSON.parse(localStorage.getItem(`solicitudesExtra_GRUK_${restaurantIdEmpleado}`)) ||
    [];

  const empleado = obtenerEmpleadoActualGRUK();

  if (!empleado) {
    alert("Empleado no encontrado.");
    return;
  }

  solicitudes.push({
    id: Date.now(),
    empleadoId: empleadoIdActual,
    empleadoNombre: empleado.nombre,
    tipo: "hora_extra",
    estado: "pendiente",
    fecha: new Date().toISOString()
  });

  localStorage.setItem(
    `solicitudesExtra_GRUK_${restaurantIdEmpleado}`,
    JSON.stringify(solicitudes)
  );

  alert("Solicitud de hora extra enviada al administrador.");
}

function solicitarDobleTurno() {
  const solicitudes =
    JSON.parse(localStorage.getItem(`solicitudesExtra_GRUK_${restaurantIdEmpleado}`)) ||
    [];

  const empleado = obtenerEmpleadoActualGRUK();

  if (!empleado) {
    alert("Empleado no encontrado.");
    return;
  }

  solicitudes.push({
    id: Date.now(),
    empleadoId: empleadoIdActual,
    empleadoNombre: empleado.nombre,
    tipo: "doble_turno",
    estado: "pendiente",
    fecha: new Date().toISOString()
  });

  localStorage.setItem(
    `solicitudesExtra_GRUK_${restaurantIdEmpleado}`,
    JSON.stringify(solicitudes)
  );

  alert("Solicitud de doble turno enviada al administrador.");
}

document.addEventListener("DOMContentLoaded", actualizarVistaEmpleadoGRUK);
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

function renderizarPanelEmpleadoGRUK() {
  const empleado = obtenerEmpleadoActualGRUK();

  if (!empleado) return;

  const asistencias = obtenerAsistenciasGRUK().filter(a =>
    Number(a.empleadoId) === empleadoIdActual
  );

  const solicitudes =
    JSON.parse(localStorage.getItem(`solicitudesExtra_GRUK_${restaurantIdEmpleado}`)) || [];

  const solicitudesEmpleado =
    solicitudes.filter(s => Number(s.empleadoId) === empleadoIdActual);

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