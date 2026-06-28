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