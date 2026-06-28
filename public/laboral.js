const paramsLaboral = new URLSearchParams(window.location.search);

const restaurantIdLaboral =
  paramsLaboral.get("restaurantId") ||
  paramsLaboral.get("restaurant") ||
  "rest1";

function obtenerEmpleadosGRUK() {
  return JSON.parse(
    localStorage.getItem(`personal_GRUK_${restaurantIdLaboral}`)
  ) || [];
}

function guardarEmpleadosGRUK(lista) {
  localStorage.setItem(
    `personal_GRUK_${restaurantIdLaboral}`,
    JSON.stringify(lista)
  );
}

function convertirImagenBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;

    reader.readAsDataURL(file);
  });
}

async function guardarEmpleadoGRUK() {
  const fotoFile = document.getElementById("fotoEmpleado").files[0];

  const nombre = document.getElementById("nombreEmpleado").value.trim();
  const documento = document.getElementById("documentoEmpleado").value.trim();
  const cargo = document.getElementById("cargoEmpleado").value.trim();
  const area = document.getElementById("areaEmpleado").value.trim();
  const telefono = document.getElementById("telefonoEmpleado").value.trim();
  const correo = document.getElementById("correoEmpleado").value.trim();
  const contrato = document.getElementById("contratoEmpleado").value;

  const salario = Number(
    document.getElementById("salarioEmpleado").value || 0
  );

  let valorHora = Number(
    document.getElementById("valorHoraEmpleado").value || 0
  );

  if (!nombre || !documento || !cargo || !area || !salario) {
    alert("Completa nombre, documento, cargo, área y salario.");
    return;
  }

  if (!fotoFile) {
    alert("Debes subir una foto base del empleado.");
    return;
  }

  if (valorHora <= 0) {
    valorHora = Math.round(salario / 240);
  }

  const fotoBase = await convertirImagenBase64(fotoFile);

  const empleados = obtenerEmpleadosGRUK();

  const empleado = {
    id: Date.now(),
    nombre,
    documento,
    cargo,
    area,
    telefono,
    correo,
    contrato,
    salario,
    valorHora,
    fotoBase,
    activo: true,
    fechaIngreso: new Date().toISOString()
  };

  empleados.push(empleado);

  guardarEmpleadosGRUK(empleados);

  alert("Empleado guardado correctamente.");

  limpiarFormularioEmpleadoGRUK();
  cargarEmpleadosGRUK();
}

function limpiarFormularioEmpleadoGRUK() {
  document.getElementById("fotoEmpleado").value = "";
  document.getElementById("nombreEmpleado").value = "";
  document.getElementById("documentoEmpleado").value = "";
  document.getElementById("cargoEmpleado").value = "";
  document.getElementById("areaEmpleado").value = "";
  document.getElementById("telefonoEmpleado").value = "";
  document.getElementById("correoEmpleado").value = "";
  document.getElementById("salarioEmpleado").value = "";
  document.getElementById("valorHoraEmpleado").value = "";
}

function eliminarEmpleadoGRUK(id) {
  let empleados = obtenerEmpleadosGRUK();

  empleados = empleados.filter(e => e.id !== id);

  guardarEmpleadosGRUK(empleados);

  cargarEmpleadosGRUK();
}

function cambiarEstadoEmpleadoGRUK(id) {
  const empleados = obtenerEmpleadosGRUK();

  const empleado = empleados.find(e => e.id === id);

  if (empleado) {
    empleado.activo = !empleado.activo;
  }

  guardarEmpleadosGRUK(empleados);

  cargarEmpleadosGRUK();
}

function cargarEmpleadosGRUK() {
  const contenedor = document.getElementById("listaEmpleadosGRUK");

  const empleados = obtenerEmpleadosGRUK();

  if (empleados.length === 0) {
    contenedor.innerHTML = "<p>No hay empleados registrados.</p>";
    return;
  }

  contenedor.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Foto</th>
          <th>Nombre</th>
          <th>Cargo</th>
          <th>Área</th>
          <th>Salario</th>
          <th>Valor hora</th>
          <th>Estado</th>
          <th>Acciones</th>
        </tr>
      </thead>

      <tbody>
        ${empleados.map(e => `
          <tr>
            <td>
              <img src="${e.fotoBase}" width="55" height="55" style="border-radius:50%;object-fit:cover;">
            </td>
            <td>${e.nombre}</td>
            <td>${e.cargo}</td>
            <td>${e.area}</td>
            <td>${formatoCOPLaboral(e.salario)}</td>
            <td>${formatoCOPLaboral(e.valorHora)}</td>
            <td>${e.activo ? "🟢 Activo" : "🔴 Inactivo"}</td>
            <td>
              <button onclick="cambiarEstadoEmpleadoGRUK(${e.id})">
                Cambiar estado
              </button>

              <button onclick="eliminarEmpleadoGRUK(${e.id})">
                Eliminar
              </button>

              <button onclick="copiarLinkEmpleadoGRUK(${e.id})">
                Link turnos
              </button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function copiarLinkEmpleadoGRUK(id) {
  const link =
    `${window.location.origin}/empleado-turnos.html?restaurantId=${restaurantIdLaboral}&empleadoId=${id}`;

  navigator.clipboard.writeText(link);

  alert("Link del empleado copiado.");
}

function formatoCOPLaboral(valor) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(Number(valor || 0));
}

document.addEventListener("DOMContentLoaded", cargarEmpleadosGRUK);
function mostrarSeccionAdminLaboral(seccion, boton = null) {
  document.querySelectorAll(".seccionAdminLaboral").forEach(s => {
    s.classList.remove("activa");
  });

  const activa = document.getElementById(`admin-${seccion}`);

  if (activa) {
    activa.classList.add("activa");
  }

  document.querySelectorAll(".sidebar nav button").forEach(b => {
    b.classList.remove("menuActivo");
  });

  if (boton) {
    boton.classList.add("menuActivo");
  }

  actualizarDashboardLaboralAdmin();
}

function obtenerTurnosAdminGRUK() {
  return (
    JSON.parse(localStorage.getItem(`turnos_GRUK_${restaurantIdLaboral}`)) || []
  );
}

function guardarTurnosAdminGRUK(turnos) {
  localStorage.setItem(
    `turnos_GRUK_${restaurantIdLaboral}`,
    JSON.stringify(turnos)
  );
}

function crearTurnoAdminGRUK() {
  const empleadoId = Number(document.getElementById("empleadoTurnoAdmin").value || 0);
  const fecha = document.getElementById("fechaTurnoAdmin").value;
  const entrada = document.getElementById("entradaTurnoAdmin").value;
  const salida = document.getElementById("salidaTurnoAdmin").value;
  const tipo = document.getElementById("tipoTurnoAdmin").value;

  if (!empleadoId || !fecha || !entrada || !salida) {
    alert("Completa empleado, fecha, entrada y salida.");
    return;
  }

  const empleados = obtenerEmpleadosGRUK();
  const empleado = empleados.find(e => Number(e.id) === empleadoId);

  const turnos = obtenerTurnosAdminGRUK();

  turnos.push({
    id: Date.now(),
    empleadoId,
    empleadoNombre: empleado ? empleado.nombre : "Empleado",
    cargo: empleado ? empleado.cargo : "",
    fecha,
    entradaProgramada: entrada,
    salidaProgramada: salida,
    tipo,
    estado: "programado",
    fechaCreacion: new Date().toISOString()
  });

  guardarTurnosAdminGRUK(turnos);

  alert("Turno creado correctamente.");

  cargarPanelesAdminLaboralGRUK();
}

function cargarSelectEmpleadosTurnoGRUK() {
  const select = document.getElementById("empleadoTurnoAdmin");

  if (!select) return;

  const empleados = obtenerEmpleadosGRUK().filter(e => e.activo);

  select.innerHTML = `
    <option value="">Selecciona empleado</option>
    ${empleados.map(e => `
      <option value="${e.id}">
        ${e.nombre} · ${e.cargo}
      </option>
    `).join("")}
  `;
}

function cargarTurnosAdminGRUK() {
  const contenedor = document.getElementById("listaTurnosAdminGRUK");

  if (!contenedor) return;

  const turnos = obtenerTurnosAdminGRUK();

  if (turnos.length === 0) {
    contenedor.innerHTML = "<p>No hay turnos programados.</p>";
    return;
  }

  contenedor.innerHTML = turnos.map(t => `
    <div class="turnoCard">
      <h3>${t.empleadoNombre}</h3>
      <p><strong>Fecha:</strong> ${t.fecha}</p>
      <p><strong>Entrada:</strong> ${t.entradaProgramada}</p>
      <p><strong>Salida:</strong> ${t.salidaProgramada}</p>
      <p><strong>Tipo:</strong> ${t.tipo}</p>
      <p><strong>Estado:</strong> ${t.estado}</p>
    </div>
  `).join("");
}

function obtenerAsistenciasAdminGRUK() {
  return (
    JSON.parse(localStorage.getItem(`asistencias_GRUK_${restaurantIdLaboral}`)) ||
    []
  );
}

function cargarAsistenciasAdminGRUK() {
  const contenedor = document.getElementById("listaAsistenciasAdminGRUK");

  if (!contenedor) return;

  const asistencias = obtenerAsistenciasAdminGRUK();

  if (asistencias.length === 0) {
    contenedor.innerHTML = "<p>No hay asistencias registradas.</p>";
    return;
  }

  contenedor.innerHTML = asistencias.map(a => `
    <div class="turnoCard">
      <h3>${a.empleadoNombre || "Empleado"}</h3>
      <p><strong>Fecha:</strong> ${a.fecha}</p>
      <p><strong>Entrada:</strong> ${a.horaEntradaTexto || "Sin entrada"}</p>
      <p><strong>Salida:</strong> ${a.horaSalidaTexto || "Sin salida"}</p>
      <p><strong>Horas trabajadas:</strong> ${a.horasTrabajadas || 0}h</p>
      <p><strong>Estado:</strong> ${a.estado || "pendiente"}</p>

      ${a.selfieEntrada ? `<img src="${a.selfieEntrada}" width="90" style="border-radius:14px;margin-top:10px;">` : ""}
      ${a.selfieSalida ? `<img src="${a.selfieSalida}" width="90" style="border-radius:14px;margin-top:10px;">` : ""}
    </div>
  `).join("");
}

function obtenerSolicitudesAdminGRUK() {
  return (
    JSON.parse(localStorage.getItem(`solicitudesExtra_GRUK_${restaurantIdLaboral}`)) ||
    []
  );
}

function guardarSolicitudesAdminGRUK(solicitudes) {
  localStorage.setItem(
    `solicitudesExtra_GRUK_${restaurantIdLaboral}`,
    JSON.stringify(solicitudes)
  );
}

function cargarSolicitudesAdminGRUK() {
  const contenedor = document.getElementById("listaSolicitudesAdminGRUK");

  if (!contenedor) return;

  const solicitudes = obtenerSolicitudesAdminGRUK();

  if (solicitudes.length === 0) {
    contenedor.innerHTML = "<p>No hay solicitudes pendientes.</p>";
    return;
  }

  contenedor.innerHTML = solicitudes.map(s => `
    <div class="turnoCard">
      <h3>${s.tipo === "hora_extra" ? "Hora extra" : "Doble turno"}</h3>
      <p><strong>Empleado:</strong> ${s.empleadoNombre}</p>
      <p><strong>Fecha:</strong> ${new Date(s.fecha).toLocaleString("es-CO")}</p>
      <p><strong>Estado:</strong> ${s.estado}</p>

      <button class="btnTabla btnSecTabla" onclick="actualizarSolicitudAdminGRUK(${s.id}, 'aprobada')">
        Aprobar
      </button>

      <button class="btnTabla btnEliminar" onclick="actualizarSolicitudAdminGRUK(${s.id}, 'rechazada')">
        Rechazar
      </button>
    </div>
  `).join("");
}

function actualizarSolicitudAdminGRUK(id, estado) {
  const solicitudes = obtenerSolicitudesAdminGRUK();

  const solicitud = solicitudes.find(s => Number(s.id) === Number(id));

  if (solicitud) {
    solicitud.estado = estado;
    solicitud.fechaRespuesta = new Date().toISOString();
  }

  guardarSolicitudesAdminGRUK(solicitudes);

  cargarPanelesAdminLaboralGRUK();

  alert(`Solicitud ${estado}.`);
}

function calcularNominaRealAdminGRUK() {
  const contenedor = document.getElementById("nominaRealAdminGRUK");

  if (!contenedor) return;

  const empleados = obtenerEmpleadosGRUK();
  const asistencias = obtenerAsistenciasAdminGRUK();

  if (empleados.length === 0) {
    contenedor.innerHTML = "<p>No hay empleados registrados.</p>";
    return;
  }

  const filas = empleados.map(e => {
    const asistenciasEmpleado = asistencias.filter(a =>
      Number(a.empleadoId) === Number(e.id)
    );

    const horas = asistenciasEmpleado.reduce(
      (acc, a) => acc + Number(a.horasTrabajadas || 0),
      0
    );

    const costoHoras = horas * Number(e.valorHora || 0);

    return `
      <tr>
        <td>${e.nombre}</td>
        <td>${e.cargo}</td>
        <td>${horas.toFixed(2)}h</td>
        <td>${formatoCOPLaboral(costoHoras)}</td>
      </tr>
    `;
  }).join("");

  contenedor.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Empleado</th>
          <th>Cargo</th>
          <th>Horas trabajadas</th>
          <th>Costo calculado</th>
        </tr>
      </thead>
      <tbody>
        ${filas}
      </tbody>
    </table>
  `;
}

function obtenerTokenLaboralGRUK() {
  const clave = `tokenLaboral_GRUK_${restaurantIdLaboral}`;

  let token = localStorage.getItem(clave);

  if (!token) {
    token =
      "GRUK-" +
      Math.random().toString(36).substring(2, 10).toUpperCase() +
      "-" +
      Date.now();

    localStorage.setItem(clave, token);
  }

  return token;
}

function regenerarTokenLaboralGRUK() {
  const clave = `tokenLaboral_GRUK_${restaurantIdLaboral}`;

  const nuevoToken =
    "GRUK-" +
    Math.random().toString(36).substring(2, 10).toUpperCase() +
    "-" +
    Date.now();

  localStorage.setItem(clave, nuevoToken);

  generarQRLaboralGRUK();
}

function generarQRLaboralGRUK() {
  const contenedor = document.getElementById("qrLaboralGRUK");

  if (!contenedor) return;

  const token = obtenerTokenLaboralGRUK();

  const link =
    `${window.location.origin}/empleado-turnos.html?restaurantId=${restaurantIdLaboral}&token=${encodeURIComponent(token)}`;

  contenedor.innerHTML = `
    <div class="turnoCard">
      <h3>QR Laboral GRUK</h3>

      <p>
        Escanea este código para ingresar al Portal Laboral del restaurante.
      </p>

      <div id="qrLaboralCanvas" style="display:flex;justify-content:center;margin:25px 0;"></div>

      <p><strong>Estado:</strong> 🟢 Activo</p>
      <p><strong>Restaurante ID:</strong> ${restaurantIdLaboral}</p>
      <p><strong>Token:</strong> ${token}</p>

      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px;">
        <button class="btnTabla btnSecTabla" onclick="copiarLinkLaboralGRUK()">
          Copiar enlace
        </button>

        <button class="btnTabla" onclick="descargarQRLaboralGRUK()">
          Descargar PNG
        </button>

        <button class="btnTabla" onclick="imprimirQRLaboralGRUK()">
          Imprimir
        </button>

        <button class="btnTabla btnEliminar" onclick="regenerarTokenLaboralGRUK()">
          Regenerar QR
        </button>
      </div>
    </div>
  `;

  new QRCode(document.getElementById("qrLaboralCanvas"), {
    text: link,
    width: 230,
    height: 230,
    colorDark: "#0A63FF",
    colorLight: "#FFFFFF",
    correctLevel: QRCode.CorrectLevel.H
  });

  localStorage.setItem(
    `linkLaboral_GRUK_${restaurantIdLaboral}`,
    link
  );
}

function copiarLinkLaboralGRUK() {
  const link =
    localStorage.getItem(`linkLaboral_GRUK_${restaurantIdLaboral}`);

  navigator.clipboard.writeText(link);

  alert("Enlace laboral copiado.");
}

function descargarQRLaboralGRUK() {
  const qrImg =
    document.querySelector("#qrLaboralCanvas img") ||
    document.querySelector("#qrLaboralCanvas canvas");

  if (!qrImg) {
    alert("Primero genera el QR.");
    return;
  }

  let dataUrl = "";

  if (qrImg.tagName.toLowerCase() === "img") {
    dataUrl = qrImg.src;
  } else {
    dataUrl = qrImg.toDataURL("image/png");
  }

  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `QR-Laboral-GRUK-${restaurantIdLaboral}.png`;
  a.click();
}

function imprimirQRLaboralGRUK() {
  const contenido = document.getElementById("qrLaboralGRUK").innerHTML;

  const ventana = window.open("", "_blank");

  ventana.document.write(`
    <html>
    <head>
      <title>QR Laboral GRUK</title>
      <style>
        body{
          font-family:Arial,sans-serif;
          padding:40px;
          text-align:center;
        }

        .turnoCard{
          border:1px solid #ddd;
          border-radius:20px;
          padding:30px;
          max-width:500px;
          margin:auto;
        }

        button{
          display:none;
        }
      </style>
    </head>
    <body>
      ${contenido}
      <script>
        window.onload = () => window.print();
      </script>
    </body>
    </html>
  `);

  ventana.document.close();
}

function actualizarDashboardLaboralAdmin() {
  const empleados = obtenerEmpleadosGRUK();
  const asistencias = obtenerAsistenciasAdminGRUK();
  const solicitudes = obtenerSolicitudesAdminGRUK();

  const hoy = new Date().toISOString().slice(0, 10);

  const total = empleados.length;
  const activos = empleados.filter(e => e.activo).length;
  const marcacionesHoy = asistencias.filter(a => a.fecha === hoy).length;
  const pendientes = solicitudes.filter(s => s.estado === "pendiente").length;

  if (document.getElementById("totalEmpleadosAdmin")) {
    document.getElementById("totalEmpleadosAdmin").textContent = total;
  }

  if (document.getElementById("empleadosActivosAdmin")) {
    document.getElementById("empleadosActivosAdmin").textContent = activos;
  }

  if (document.getElementById("marcacionesHoyAdmin")) {
    document.getElementById("marcacionesHoyAdmin").textContent = marcacionesHoy;
  }

  if (document.getElementById("solicitudesPendientesAdmin")) {
    document.getElementById("solicitudesPendientesAdmin").textContent = pendientes;
  }

  const resumen = document.getElementById("resumenLaboralAdmin");

  if (resumen) {
    resumen.innerHTML = `
      <div class="turnoCard">
        <h3>Estado laboral del día</h3>
        <p><strong>Empleados registrados:</strong> ${total}</p>
        <p><strong>Activos:</strong> ${activos}</p>
        <p><strong>Marcaciones hoy:</strong> ${marcacionesHoy}</p>
        <p><strong>Solicitudes pendientes:</strong> ${pendientes}</p>
      </div>
    `;
  }
}

function cargarPanelesAdminLaboralGRUK() {
  cargarEmpleadosGRUK();
  cargarSelectEmpleadosTurnoGRUK();
  cargarTurnosAdminGRUK();
  cargarAsistenciasAdminGRUK();
  cargarSolicitudesAdminGRUK();
  calcularNominaRealAdminGRUK();
  actualizarDashboardLaboralAdmin();
}

document.addEventListener("DOMContentLoaded", cargarPanelesAdminLaboralGRUK);