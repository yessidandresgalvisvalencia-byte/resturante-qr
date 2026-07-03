let centrosCostoGRUK = [];
let costosGRUK = [];

function getRestaurantIdCostosGRUK() {
  return getRestaurantId();
}

function formatoCOPCostos(valor) {
  return "$" + Math.round(Number(valor || 0)).toLocaleString("es-CO");
}

async function inicializarCostosGRUK() {
  cargarCentrosCostoGRUK();
  cargarCostosGRUK();
  pintarSelectsCostosGRUK();
  pintarCentrosCostoGRUK();
  pintarCostosGRUK();
}

function cargarCentrosCostoGRUK() {
  const restaurantId = getRestaurantIdCostosGRUK();

  centrosCostoGRUK =
    JSON.parse(sessionStorage.getItem(`centrosCosto_GRUK_${restaurantId}`)) || [
      { codigo: "10", nombre: "Alimentos y bebidas" },
      { codigo: "20", nombre: "Lavandería" },
      { codigo: "30", nombre: "Comunicaciones" },
      { codigo: "50", nombre: "Administración" },
      { codigo: "60", nombre: "Mantenimiento" }
    ];
}

function guardarCentrosCostoGRUK() {
  const restaurantId = getRestaurantIdCostosGRUK();

  sessionStorage.setItem(
    `centrosCosto_GRUK_${restaurantId}`,
    JSON.stringify(centrosCostoGRUK)
  );
}

function cargarCostosGRUK() {
  const restaurantId = getRestaurantIdCostosGRUK();

  costosGRUK =
    JSON.parse(sessionStorage.getItem(`costos_GRUK_${restaurantId}`)) || [];
}

function guardarCostosLocalGRUK() {
  const restaurantId = getRestaurantIdCostosGRUK();

  sessionStorage.setItem(
    `costos_GRUK_${restaurantId}`,
    JSON.stringify(costosGRUK)
  );
}

function pintarSelectsCostosGRUK() {
  const selects = [
    "costoDepartamentoAplicado",
    "lavanderiaDepartamento",
    "activoDepartamento",
    "alimentacionDepartamento"
  ];

  selects.forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;

    select.innerHTML = `
      <option value="">Selecciona departamento</option>
      ${centrosCostoGRUK.map(c => `
        <option value="${c.codigo}">
          ${c.codigo} · ${c.nombre}
        </option>
      `).join("")}
    `;
  });
}

function agregarCentroCostoGRUK() {
  const nombre = document.getElementById("costoDepartamento")?.value.trim();
  const codigo = document.getElementById("costoCodigoDepartamento")?.value.trim();

  if (!nombre || !codigo) {
    alert("Completa departamento y código.");
    return;
  }

  const existe = centrosCostoGRUK.some(c => String(c.codigo) === String(codigo));

  if (existe) {
    alert("Ya existe un centro de costo con ese código.");
    return;
  }

  centrosCostoGRUK.push({ codigo, nombre });

  guardarCentrosCostoGRUK();
  pintarCentrosCostoGRUK();
  pintarSelectsCostosGRUK();

  document.getElementById("costoDepartamento").value = "";
  document.getElementById("costoCodigoDepartamento").value = "";

  mostrarToast("Centro de costo agregado.", "success");
}

function pintarCentrosCostoGRUK() {
  const contenedor = document.getElementById("listaCentrosCostoGRUK");
  if (!contenedor) return;

  contenedor.innerHTML = `
    <br>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th>Código</th>
          <th>Departamento</th>
          <th>Acción</th>
        </tr>
      </thead>
      <tbody>
        ${centrosCostoGRUK.map((c, index) => `
          <tr>
            <td>${c.codigo}</td>
            <td>${c.nombre}</td>
            <td>
              <button onclick="eliminarCentroCostoGRUK(${index})">
                Eliminar
              </button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function eliminarCentroCostoGRUK(index) {
  centrosCostoGRUK.splice(index, 1);
  guardarCentrosCostoGRUK();
  pintarCentrosCostoGRUK();
  pintarSelectsCostosGRUK();
}

function obtenerNombreCentroCostoGRUK(codigo) {
  const centro = centrosCostoGRUK.find(c => String(c.codigo) === String(codigo));
  return centro ? centro.nombre : "Sin departamento";
}

function guardarCostoGRUK() {
  const concepto = document.getElementById("costoConcepto")?.value.trim();
  const tipo = document.getElementById("costoTipo")?.value;
  const valor = Number(document.getElementById("costoValor")?.value || 0);
  const departamento = document.getElementById("costoDepartamentoAplicado")?.value;
  const metodo = document.getElementById("costoMetodoDistribucion")?.value;
  const observacion = document.getElementById("costoObservacion")?.value.trim();

  if (!concepto || !tipo || valor <= 0 || !departamento) {
    alert("Completa concepto, tipo, valor y departamento.");
    return;
  }

  const costo = {
    id: Date.now(),
    restaurantId: getRestaurantIdCostosGRUK(),
    concepto,
    tipo,
    valor,
    departamento,
    departamentoNombre: obtenerNombreCentroCostoGRUK(departamento),
    metodo,
    observacion,
    fecha: new Date().toISOString()
  };

  costosGRUK.push(costo);
  guardarCostosLocalGRUK();

  limpiarFormularioCostoGRUK();
  pintarCostosGRUK();

  mostrarToast("Costo registrado correctamente.", "success");
}

function limpiarFormularioCostoGRUK() {
  [
    "costoConcepto",
    "costoValor",
    "costoObservacion"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

function pintarCostosGRUK() {
  const contenedor = document.getElementById("listaCostosGRUK");
  const resumen = document.getElementById("resumenCostosGRUK");

  if (!contenedor && !resumen) return;

  const total = costosGRUK.reduce((acc, c) => acc + Number(c.valor || 0), 0);

  const porDepartamento = centrosCostoGRUK.map(dep => {
    const totalDep = costosGRUK
      .filter(c => String(c.departamento) === String(dep.codigo))
      .reduce((acc, c) => acc + Number(c.valor || 0), 0);

    return {
      ...dep,
      total: totalDep
    };
  }).filter(d => d.total > 0);

  if (resumen) {
    resumen.innerHTML = `
      <div class="card">
        <h3>📊 Resumen de costos</h3>
        <p><strong>Total registrado:</strong> ${formatoCOPCostos(total)}</p>
        <p><strong>Centros afectados:</strong> ${porDepartamento.length}</p>
        <p><strong>Registros:</strong> ${costosGRUK.length}</p>
      </div>
    `;
  }

  if (contenedor) {
    if (!costosGRUK.length) {
      contenedor.innerHTML = "<p>No hay costos registrados.</p>";
      return;
    }

    contenedor.innerHTML = `
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th>Concepto</th>
            <th>Tipo</th>
            <th>Valor</th>
            <th>Departamento</th>
            <th>Método</th>
            <th>Fecha</th>
          </tr>
        </thead>
        <tbody>
          ${costosGRUK.map(c => `
            <tr>
              <td>${c.concepto}</td>
              <td>${traducirTipoCostoGRUK(c.tipo)}</td>
              <td>${formatoCOPCostos(c.valor)}</td>
              <td>${c.departamentoNombre}</td>
              <td>${traducirMetodoCostoGRUK(c.metodo)}</td>
              <td>${new Date(c.fecha).toLocaleDateString("es-CO")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }
}

function traducirTipoCostoGRUK(tipo) {
  const tipos = {
    materia_prima: "Materia prima",
    mano_obra: "Mano de obra",
    servicio_publico: "Servicio público",
    lavanderia: "Lavandería",
    depreciacion: "Depreciación",
    gasto_anticipado: "Gasto anticipado",
    cargo_diferido: "Cargo diferido",
    alimentacion_empleados: "Alimentación empleados",
    mantenimiento: "Mantenimiento",
    otro: "Otro"
  };

  return tipos[tipo] || tipo;
}

function traducirMetodoCostoGRUK(metodo) {
  const metodos = {
    directo: "Directo",
    porcentaje: "Porcentaje manual",
    empleados: "Número de empleados",
    area: "Área ocupada",
    consumo: "Consumo real",
    prendas: "Prendas procesadas"
  };

  return metodos[metodo] || metodo;
}

function analizarServicioPublicoGRUK() {
  const tipo = document.getElementById("servicioPublicoTipo")?.value;
  const valor = Number(document.getElementById("servicioPublicoValor")?.value || 0);
  const consumo = Number(document.getElementById("servicioPublicoConsumo")?.value || 0);
  const unidad = document.getElementById("servicioPublicoUnidad")?.value.trim();

  if (!valor || !consumo || !unidad) {
    alert("Completa valor, consumo y unidad.");
    return;
  }

  const costoUnidad = valor / consumo;

  const contenedor = document.getElementById("resultadoServiciosGRUK");

  contenedor.innerHTML = `
    <div class="card">
      <h3>⚡ Análisis de servicio público</h3>
      <p><strong>Servicio:</strong> ${tipo}</p>
      <p><strong>Valor factura:</strong> ${formatoCOPCostos(valor)}</p>
      <p><strong>Consumo:</strong> ${consumo} ${unidad}</p>
      <p><strong>Costo por unidad:</strong> ${formatoCOPCostos(costoUnidad)} por ${unidad}</p>

      <p>
        GRUK recomienda distribuir este costo por consumo real cuando sea posible.
        Si no hay medidores por departamento, puede usarse área ocupada,
        número de equipos o criterio técnico definido por administración.
      </p>
    </div>
  `;
}

function calcularLavanderiaGRUK() {
  const totalCargos = Number(document.getElementById("lavanderiaTotalCargos")?.value || 0);
  const totalPrendas = Number(document.getElementById("lavanderiaTotalPrendas")?.value || 0);
  const departamento = document.getElementById("lavanderiaDepartamento")?.value;
  const prendasDepto = Number(document.getElementById("lavanderiaPrendasDepartamento")?.value || 0);

  if (!totalCargos || !totalPrendas || !departamento || !prendasDepto) {
    alert("Completa los datos de lavandería.");
    return;
  }

  const costoPrenda = totalCargos / totalPrendas;
  const costoDepartamento = costoPrenda * prendasDepto;

  const contenedor = document.getElementById("resultadoLavanderiaGRUK");

  contenedor.innerHTML = `
    <div class="card">
      <h3>🧺 Aplicación de gastos de lavandería</h3>

      <p><strong>Total cargos lavandería:</strong> ${formatoCOPCostos(totalCargos)}</p>
      <p><strong>Total prendas procesadas:</strong> ${totalPrendas}</p>
      <p><strong>Costo por prenda:</strong> ${formatoCOPCostos(costoPrenda)}</p>

      <hr>

      <p><strong>Departamento:</strong> ${obtenerNombreCentroCostoGRUK(departamento)}</p>
      <p><strong>Prendas del departamento:</strong> ${prendasDepto}</p>
      <p><strong>Costo aplicado:</strong> ${formatoCOPCostos(costoDepartamento)}</p>

      <button onclick="registrarCostoCalculadoGRUK('Lavandería', 'lavanderia', ${costoDepartamento}, '${departamento}', 'prendas')">
        Registrar como costo
      </button>
    </div>
  `;
}

function calcularDepreciacionGRUK() {
  const activo = document.getElementById("activoNombre")?.value.trim();
  const departamento = document.getElementById("activoDepartamento")?.value;
  const costo = Number(document.getElementById("activoCosto")?.value || 0);
  const vidaUtil = Number(document.getElementById("activoVidaUtil")?.value || 0);
  const adiciones = Number(document.getElementById("activoAdiciones")?.value || 0);

  if (!activo || !departamento || !costo || !vidaUtil) {
    alert("Completa activo, departamento, costo y vida útil.");
    return;
  }

  const baseDepreciable = costo + adiciones;
  const depreciacionMensual = baseDepreciable / vidaUtil;
  const depreciacionDiaria = depreciacionMensual / 30;

  const contenedor = document.getElementById("resultadoDepreciacionGRUK");

  contenedor.innerHTML = `
    <div class="card">
      <h3>🏗 Depreciación del activo</h3>

      <p><strong>Activo:</strong> ${activo}</p>
      <p><strong>Departamento:</strong> ${obtenerNombreCentroCostoGRUK(departamento)}</p>
      <p><strong>Base depreciable:</strong> ${formatoCOPCostos(baseDepreciable)}</p>
      <p><strong>Vida útil:</strong> ${vidaUtil} meses</p>

      <hr>

      <p><strong>Depreciación mensual:</strong> ${formatoCOPCostos(depreciacionMensual)}</p>
      <p><strong>Depreciación diaria:</strong> ${formatoCOPCostos(depreciacionDiaria)}</p>

      <button onclick="registrarCostoCalculadoGRUK('Depreciación ${activo}', 'depreciacion', ${depreciacionMensual}, '${departamento}', 'directo')">
        Registrar depreciación mensual
      </button>
    </div>
  `;
}

function calcularAlimentacionEmpleadosGRUK() {
  const valor = Number(document.getElementById("alimentacionValor")?.value || 0);
  const empleados = Number(document.getElementById("alimentacionEmpleados")?.value || 0);
  const dias = Number(document.getElementById("alimentacionDias")?.value || 0);
  const departamento = document.getElementById("alimentacionDepartamento")?.value;

  if (!valor || !empleados || !dias || !departamento) {
    alert("Completa alimentación, empleados, días y departamento.");
    return;
  }

  const costoEmpleadoDia = valor / (empleados * dias);

  const contenedor = document.getElementById("resultadoAlimentacionGRUK");

  contenedor.innerHTML = `
    <div class="card">
      <h3>🍽 Alimentación de empleados</h3>

      <p><strong>Valor total:</strong> ${formatoCOPCostos(valor)}</p>
      <p><strong>Empleados:</strong> ${empleados}</p>
      <p><strong>Días:</strong> ${dias}</p>
      <p><strong>Costo por empleado/día:</strong> ${formatoCOPCostos(costoEmpleadoDia)}</p>
      <p><strong>Departamento:</strong> ${obtenerNombreCentroCostoGRUK(departamento)}</p>

      <button onclick="registrarCostoCalculadoGRUK('Alimentación empleados', 'alimentacion_empleados', ${valor}, '${departamento}', 'empleados')">
        Registrar alimentación
      </button>
    </div>
  `;
}

function registrarCostoCalculadoGRUK(concepto, tipo, valor, departamento, metodo) {
  costosGRUK.push({
    id: Date.now(),
    restaurantId: getRestaurantIdCostosGRUK(),
    concepto,
    tipo,
    valor: Number(valor || 0),
    departamento,
    departamentoNombre: obtenerNombreCentroCostoGRUK(departamento),
    metodo,
    observacion: "Costo calculado automáticamente por GRUK.",
    fecha: new Date().toISOString()
  });

  guardarCostosLocalGRUK();
  pintarCostosGRUK();

  mostrarToast("Costo calculado registrado.", "success");
}

function diagnosticoCostosGRUK() {
  const contenedor = document.getElementById("resultadoDiagnosticoCostosGRUK");

  if (!contenedor) return;

  const total = costosGRUK.reduce((acc, c) => acc + Number(c.valor || 0), 0);

  const porDepartamento = centrosCostoGRUK.map(dep => {
    const totalDep = costosGRUK
      .filter(c => String(c.departamento) === String(dep.codigo))
      .reduce((acc, c) => acc + Number(c.valor || 0), 0);

    return {
      ...dep,
      total: totalDep,
      porcentaje: total > 0 ? (totalDep / total) * 100 : 0
    };
  }).filter(d => d.total > 0)
    .sort((a, b) => b.total - a.total);

  const mayor = porDepartamento[0];

  let mensaje = "El comportamiento de costos es estable.";

  if (mayor && mayor.porcentaje >= 50) {
    mensaje = `El centro de costo ${mayor.nombre} concentra más del 50% de los costos registrados. GRUK recomienda revisar si esta concentración corresponde a consumo real o si existen costos mal distribuidos.`;
  }

  if (!costosGRUK.length) {
    mensaje = "Aún no hay suficientes costos registrados para emitir un diagnóstico completo.";
  }

  contenedor.innerHTML = `
    <div class="card">
      <h2>🧠 Asesor Empresarial de Costos GRUK</h2>

      <p><strong>${obtenerSaludoCostosGRUK()}.</strong></p>

      <p>
        He analizado los costos registrados por departamento, tipo de gasto
        y método de distribución para identificar riesgos, concentraciones
        y oportunidades de mejora.
      </p>

      <h3>Resumen</h3>

      <p><strong>Total de costos registrados:</strong> ${formatoCOPCostos(total)}</p>
      <p><strong>Registros analizados:</strong> ${costosGRUK.length}</p>

      ${
        mayor
          ? `<p><strong>Mayor centro de costo:</strong> ${mayor.nombre} con ${formatoCOPCostos(mayor.total)} (${mayor.porcentaje.toFixed(2)}%)</p>`
          : ""
      }

      <h3>Recomendación GRUK</h3>
      <p>${mensaje}</p>

      <h3>Distribución por departamento</h3>

      ${
        porDepartamento.length
          ? `<ul>${porDepartamento.map(d => `
              <li>${d.nombre}: ${formatoCOPCostos(d.total)} — ${d.porcentaje.toFixed(2)}%</li>
            `).join("")}</ul>`
          : `<p>No hay distribución disponible.</p>`
      }
    </div>
  `;
}

function obtenerSaludoCostosGRUK() {
  const hora = new Date().getHours();

  if (hora >= 5 && hora < 12) return "Buenos días";
  if (hora >= 12 && hora < 18) return "Buenas tardes";
  return "Buenas noches";
}