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