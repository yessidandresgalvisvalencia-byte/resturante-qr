const paramsLaboral = new URLSearchParams(window.location.search);

const restaurantIdLaboral =
  paramsLaboral.get("restaurantId") ||
  paramsLaboral.get("restaurant") ||
  "rest1";

function formatoCOPLaboral(valor) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(Number(valor || 0));
}

function convertirImagenBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");

    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* =========================
   EMPLEADOS — BACKEND
========================= */

async function obtenerEmpleadosGRUK() {
  try {
    const res = await fetch(`/laboral/empleados/${restaurantIdLaboral}`);
    const data = await res.json();

    if (!data.ok) {
      console.error(data.mensaje);
      return [];
    }

    return data.empleados || [];
  } catch (error) {
    console.error("Error obteniendo empleados:", error);
    return [];
  }
}

async function guardarEmpleadoGRUK() {
  const fotoFile = document.getElementById("fotoEmpleado")?.files[0];

  const nombre = document.getElementById("nombreEmpleado").value.trim();
  const documento = document.getElementById("documentoEmpleado").value.trim();
  const cargo = document.getElementById("cargoEmpleado").value.trim();
  const area = document.getElementById("areaEmpleado").value.trim();
  const telefono = document.getElementById("telefonoEmpleado").value.trim();
  const correo = document.getElementById("correoEmpleado").value.trim();
  const contrato = document.getElementById("contratoEmpleado").value;

  const salario = Number(document.getElementById("salarioEmpleado").value || 0);
  const valorHora = Number(document.getElementById("valorHoraEmpleado").value || 0);

  if (!nombre || !documento || !cargo || !area || !salario) {
    alert("Completa nombre, documento, cargo, área y salario.");
    return;
  }

  let fotoBase = "";

  if (window.fotoEmpleadoCapturadaGRUK) {
    fotoBase = window.fotoEmpleadoCapturadaGRUK;
  } else if (fotoFile) {
    fotoBase = await convertirImagenBase64(fotoFile);
  }

  if (!fotoBase) {
    alert("Debes subir o tomar una foto base del empleado.");
    return;
  }

  try {
    const res = await fetch("/laboral/empleados", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        restaurantId: restaurantIdLaboral,
        nombre,
        documento,
        cargo,
        area,
        telefono,
        correo,
        contrato,
        salario,
        valorHora,
        fotoBase
      })
    });

    const data = await res.json();

    if (!data.ok) {
      alert(data.mensaje || "No se pudo guardar el empleado.");
      return;
    }

    alert("Empleado guardado correctamente.");

    window.fotoEmpleadoCapturadaGRUK = "";
    limpiarFormularioEmpleadoGRUK();
    await cargarPanelesAdminLaboralGRUK();

  } catch (error) {
    console.error("Error guardando empleado:", error);
    alert("Error conectando con el servidor.");
  }
}

function limpiarFormularioEmpleadoGRUK() {
  const ids = [
    "fotoEmpleado",
    "nombreEmpleado",
    "documentoEmpleado",
    "cargoEmpleado",
    "areaEmpleado",
    "telefonoEmpleado",
    "correoEmpleado",
    "salarioEmpleado",
    "valorHoraEmpleado"
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const preview = document.getElementById("previewFotoEmpleado");
  if (preview) {
    preview.src = "";
    preview.style.display = "none";
  }
}

async function cargarEmpleadosGRUK() {
  const contenedor = document.getElementById("listaEmpleadosGRUK");
  if (!contenedor) return;

  const empleados = await obtenerEmpleadosGRUK();

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
              <img src="${e.fotoBase || ""}" width="55" height="55" style="border-radius:50%;object-fit:cover;">
            </td>
            <td>${e.nombre}</td>
            <td>${e.cargo}</td>
            <td>${e.area}</td>
            <td>${formatoCOPLaboral(e.salario)}</td>
            <td>${formatoCOPLaboral(e.valorHora)}</td>
            <td>${e.activo ? "🟢 Activo" : "🔴 Inactivo"}</td>
            <td>
              <button class="btnTabla" onclick="cambiarEstadoEmpleadoGRUK('${e._id}')">
                Cambiar estado
              </button>

              <button class="btnTabla btnEliminar" onclick="eliminarEmpleadoGRUK('${e._id}')">
                Eliminar
              </button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

async function cambiarEstadoEmpleadoGRUK(id) {
  try {
    const res = await fetch(`/laboral/empleados/${id}/estado`, {
      method: "PUT"
    });

    const data = await res.json();

    if (!data.ok) {
      alert(data.mensaje || "No se pudo cambiar el estado.");
      return;
    }

    await cargarPanelesAdminLaboralGRUK();

  } catch (error) {
    console.error("Error cambiando estado:", error);
    alert("Error conectando con el servidor.");
  }
}

async function eliminarEmpleadoGRUK(id) {
  if (!confirm("¿Eliminar este empleado?")) return;

  try {
    const res = await fetch(`/laboral/empleados/${id}`, {
      method: "DELETE"
    });

    const data = await res.json();

    if (!data.ok) {
      alert(data.mensaje || "No se pudo eliminar.");
      return;
    }

    await cargarPanelesAdminLaboralGRUK();

  } catch (error) {
    console.error("Error eliminando empleado:", error);
    alert("Error conectando con el servidor.");
  }
}

/* =========================
   NAVEGACIÓN ADMIN
========================= */

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

/* =========================
   TURNOS — TEMPORAL LOCAL
========================= */

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

async function crearTurnoAdminGRUK() {
  const empleadoId = document.getElementById("empleadoTurnoAdmin").value;
  const fecha = document.getElementById("fechaTurnoAdmin").value;
  const entrada = document.getElementById("entradaTurnoAdmin").value;
  const salida = document.getElementById("salidaTurnoAdmin").value;
  const tipo = document.getElementById("tipoTurnoAdmin").value;

  if (!empleadoId || !fecha || !entrada || !salida) {
    alert("Completa empleado, fecha, entrada y salida.");
    return;
  }

  const empleados = await obtenerEmpleadosGRUK();
  const empleado = empleados.find(e => String(e._id) === String(empleadoId));

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

async function cargarSelectEmpleadosTurnoGRUK() {
  const select = document.getElementById("empleadoTurnoAdmin");
  if (!select) return;

  const empleados = await obtenerEmpleadosGRUK();
  const activos = empleados.filter(e => e.activo);

  select.innerHTML = `
    <option value="">Selecciona empleado</option>
    ${activos.map(e => `
      <option value="${e._id}">
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

/* =========================
   ASISTENCIAS Y SOLICITUDES — TEMPORAL LOCAL
========================= */

function obtenerAsistenciasAdminGRUK() {
  return (
    JSON.parse(localStorage.getItem(`asistencias_GRUK_${restaurantIdLaboral}`)) || []
  );
}

async function obtenerSolicitudesAdminGRUK() {
  try {
    const res = await fetch(`/laboral/solicitudes/${restaurantIdLaboral}`);
    const data = await res.json();

    if (!data.ok) return [];

    return data.solicitudes || [];

  } catch (error) {
    console.error(error);
    return [];
  }
}

function guardarSolicitudesAdminGRUK(solicitudes) {
  localStorage.setItem(
    `solicitudesExtra_GRUK_${restaurantIdLaboral}`,
    JSON.stringify(solicitudes)
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

async function cargarSolicitudesAdminGRUK() {
  const contenedor = document.getElementById("listaSolicitudesAdminGRUK");
  if (!contenedor) return;

  const solicitudes = await obtenerSolicitudesAdminGRUK();

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

async function actualizarSolicitudAdminGRUK(id, estado) {
  const res = await fetch(`/laboral/solicitudes/${id}/estado`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      estado
    })
  });

  const data = await res.json();

  if (!data.ok) {
    alert(data.mensaje || "No se pudo actualizar la solicitud.");
    return;
  }

  await cargarPanelesAdminLaboralGRUK();

  alert(`Solicitud ${estado}.`);
}

/* =========================
   NÓMINA TEMPORAL
========================= */

async function calcularNominaRealAdminGRUK() {
  const contenedor = document.getElementById("nominaRealAdminGRUK");
  if (!contenedor) return;

  const empleados = await obtenerEmpleadosGRUK();
  const asistencias = obtenerAsistenciasAdminGRUK();

  if (empleados.length === 0) {
    contenedor.innerHTML = "<p>No hay empleados registrados.</p>";
    return;
  }

  const filas = empleados.map(e => {
    const asistenciasEmpleado = asistencias.filter(a =>
      String(a.empleadoId) === String(e._id)
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

/* =========================
   QR LABORAL
========================= */

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

      <p>Escanea este código para ingresar al Portal Laboral del restaurante.</p>

      <div id="qrLaboralCanvas" style="display:flex;justify-content:center;margin:25px 0;"></div>

      <p><strong>Estado:</strong> 🟢 Activo</p>
      <p><strong>Restaurante ID:</strong> ${restaurantIdLaboral}</p>

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

  localStorage.setItem(`linkLaboral_GRUK_${restaurantIdLaboral}`, link);
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

/* =========================
   DASHBOARD ADMIN
========================= */

async function actualizarDashboardLaboralAdmin() {
  const empleados = await obtenerEmpleadosGRUK();
  const asistencias =  obtenerAsistenciasAdminGRUK();
  const solicitudes = await obtenerSolicitudesAdminGRUK();

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

/* =========================
   FOTO EMPLEADO
========================= */

async function tomarFotoEmpleadoAdminGRUK() {
  const input = document.createElement("input");

  input.type = "file";
  input.accept = "image/*";
  input.capture = "user";

  input.onchange = () => {
    const file = input.files[0];

    if (!file) return;

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

    const inputPrincipal = document.getElementById("fotoEmpleado");

    if (inputPrincipal) {
      inputPrincipal.files = dataTransfer.files;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const preview = document.getElementById("previewFotoEmpleado");

      if (preview) {
        preview.src = reader.result;
        preview.style.display = "block";
      }
    };

    reader.readAsDataURL(file);
  };

  input.click();
}

document.addEventListener("change", function(e) {
  if (e.target && e.target.id === "fotoEmpleado") {
    const file = e.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const preview = document.getElementById("previewFotoEmpleado");

      if (preview) {
        preview.src = reader.result;
        preview.style.display = "block";
      }
    };

    reader.readAsDataURL(file);
  }
});

/* =========================
   CARGA GENERAL
========================= */

async function cargarPanelesAdminLaboralGRUK() {
  await cargarEmpleadosGRUK();
  await cargarSelectEmpleadosTurnoGRUK();
  cargarTurnosAdminGRUK();
  cargarAsistenciasAdminGRUK();
  cargarSolicitudesAdminGRUK();
  await calcularNominaRealAdminGRUK();
  await actualizarDashboardLaboralAdmin();
}

document.addEventListener("DOMContentLoaded", cargarPanelesAdminLaboralGRUK);