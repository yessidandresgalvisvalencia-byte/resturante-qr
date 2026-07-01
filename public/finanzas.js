function formatoCOPFinanzas(valor) {
  return "$" + Math.round(Number(valor || 0)).toLocaleString("es-CO");
}

function getRestaurantIdFinanzas() {
  return (
    new URLSearchParams(window.location.search).get("restaurantId") ||
    localStorage.getItem("adminRestaurantId") ||
    "rest1"
  );
}

function normalizarCategoriaGastoGRUK(g) {
  const categoria = String(g.categoria || "").toLowerCase();
  const nombre = String(g.nombre || "").toLowerCase();

  if (
    categoria.includes("publicidad") ||
    categoria.includes("ventas") ||
    nombre.includes("publicidad") ||
    nombre.includes("marketing")
  ) return "Ventas";

  if (
    categoria.includes("logística") ||
    categoria.includes("logistica") ||
    nombre.includes("domicilio") ||
    nombre.includes("domiciliario") ||
    nombre.includes("domciliario") ||   // ← agregado
    nombre.includes("transporte")
  ) return "Logística";

  if (
    categoria.includes("financiero") ||
    nombre.includes("credito") ||
    nombre.includes("crédito") ||
    nombre.includes("interes") ||
    nombre.includes("banco")
  ) return "Financieros";

  if (
    categoria.includes("producción") ||
    categoria.includes("produccion") ||
    categoria.includes("insumo") ||
    nombre.includes("materia prima") ||
    nombre.includes("insumo")
  ) return "Producción";

  if (
    categoria.includes("administración") ||
    categoria.includes("administracion") ||
    nombre.includes("gerente") ||
    nombre.includes("contador") ||
    nombre.includes("papeleria")
  ) return "Administración";

  return "Otro";
}


async function obtenerDatosFinancierosGRUK(restaurantId) {
  const gastos =
    JSON.parse(localStorage.getItem(`gastos_${restaurantId}`)) || [];

  const pagosCaja =
    JSON.parse(localStorage.getItem(`pagos_caja_${restaurantId}`)) || [];

  let datosVentas = [];
  let personal = [];

  try {
    let resVentas =
      await fetch(`/estadisticas/pareto?restaurantId=${restaurantId}`);

    if (!resVentas.ok) {
      resVentas =
        await fetch(`/estadisticas/pareto?restaurant=${restaurantId}`);
    }

    if (resVentas.ok) {
      datosVentas = await resVentas.json();
    }
  } catch (error) {
    console.log("Error cargando ventas financieras:", error);
  }

  try {
    const resPersonal =
      await fetch(`/api/personal?restaurantId=${restaurantId}`);

    if (resPersonal.ok) {
      personal = await resPersonal.json();
    }
  } catch (error) {
    console.log("Error cargando personal financiero:", error);
  }

  return {
    gastos,
    pagosCaja,
    datosVentas,
    personal
  };
}

function calcularIngresosGRUK(datosVentas, pagosCaja) {
  const ventasOrdenadas =
    datosVentas
      .map(p => ({
        producto: p.producto || "Producto sin nombre",
        categoria: p.categoria || "",
        precioUnitarioActual: Number(p.precioUnitarioActual || 0),
        costoMateriaPrimaTotal: Number(p.costoMateriaPrimaTotal || 0),
        ventas: Number(p.ventas || 0),
        totalDinero: Number(p.totalCalculado || 0)
      }))
      .filter(p =>
        p.ventas > 0 &&
        p.precioUnitarioActual > 0 &&
        p.totalDinero > 0
      );

  const ventasQR =
    ventasOrdenadas.reduce((acc, p) => acc + p.totalDinero, 0);

  const ventasManualCaja =
    pagosCaja
      .filter(p => p.tipoVenta === "manual")
      .reduce((acc, p) => acc + Number(p.total || 0), 0);

  const ventasQRCaja =
    pagosCaja
      .filter(p => p.tipoVenta === "qr")
      .reduce((acc, p) => acc + Number(p.total || 0), 0);

  const ingresosTotales =
    ventasQR + ventasManualCaja;

  const costosMateriaPrima =
    ventasOrdenadas.reduce(
      (acc, p) => acc + Number(p.costoMateriaPrimaTotal || 0),
      0
    );

  return {
    ventasOrdenadas,
    ventasQR,
    ventasManualCaja,
    ventasQRCaja,
    ingresosTotales,
    costosMateriaPrima
  };
}

function clasificarGastosGRUK(gastos) {
  const totalGastos =
    gastos.reduce((acc, g) => acc + Number(g.valor || 0), 0);

  const gastosAdministracion =
    gastos.filter(g => normalizarCategoriaGastoGRUK(g) === "Administración")
      .reduce((acc, g) => acc + Number(g.valor || 0), 0);

  const gastosVentas =
    gastos.filter(g => normalizarCategoriaGastoGRUK(g) === "Ventas")
      .reduce((acc, g) => acc + Number(g.valor || 0), 0);

  const gastosLogistica =
    gastos.filter(g => normalizarCategoriaGastoGRUK(g) === "Logística")
      .reduce((acc, g) => acc + Number(g.valor || 0), 0);

  const gastosFinancieros =
    gastos.filter(g => normalizarCategoriaGastoGRUK(g) === "Financieros")
      .reduce((acc, g) => acc + Number(g.valor || 0), 0);

  const gastosProduccion =
    gastos.filter(g => normalizarCategoriaGastoGRUK(g) === "Producción")
      .reduce((acc, g) => acc + Number(g.valor || 0), 0);

  const gastosOtro =
    gastos.filter(g => normalizarCategoriaGastoGRUK(g) === "Otro")
      .reduce((acc, g) => acc + Number(g.valor || 0), 0);

  return {
    totalGastos,
    gastosAdministracion,
    gastosVentas,
    gastosLogistica,
    gastosFinancieros,
    gastosProduccion,
    gastosOtro
  };
}

function calcularNominaGRUK(personal) {
  return personal.reduce(
    (acc, p) => acc + Number(p.salario || 0),
    0
  );
}

function calcularEstadoResultadosGRUK(datos) {
  const ventasBrutas =
    datos.ingresosTotales;

  const descuentosVentas = 0;
  const devolucionesVentas = 0;

  const ventasNetas =
    ventasBrutas - descuentosVentas - devolucionesVentas;

  const costoProduccionVentas =
    datos.costosMateriaPrima + datos.gastosProduccion;

  const utilidadBruta =
    ventasNetas - costoProduccionVentas;

  const gastosOperativosRegistrados =
    datos.totalGastos;

  const estructuraGlobalGastos =
    gastosOperativosRegistrados + datos.gastoNomina;

  const utilidadOperacional =
    utilidadBruta -
    gastosOperativosRegistrados -
    datos.gastoNomina;

  const otrosIngresos = 0;
  const otrosEgresos = datos.gastosFinancieros || 0;

  const utilidadAntesImpuestos =
    utilidadOperacional + otrosIngresos - otrosEgresos;

  const utilidadNeta =
    utilidadAntesImpuestos;

  const rentabilidadReal =
    datos.ingresosTotales > 0
      ? (utilidadOperacional / datos.ingresosTotales) * 100
      : 0;
const totalCostoYGasto =

  costoProduccionVentas +
  gastosOperativosRegistrados +
  datos.gastoNomina;
  const costoPrimo =
  costoProduccionVentas +
  datos.gastoNomina;

const costosIndirectosServicio =
  gastosOperativosRegistrados;

const costoProduccionTotal =
  costoPrimo +
  costosIndirectosServicio;

const margenRentabilidad =
  datos.ingresosTotales -
  totalCostoYGasto;

const porcentajeMargenRentabilidad =
  totalCostoYGasto > 0
    ? (margenRentabilidad / totalCostoYGasto) * 100
    : 0;
  return {
  ventasBrutas,
  descuentosVentas,
  devolucionesVentas,
  ventasNetas,
  costoProduccionVentas,
  utilidadBruta,
  gastosOperativosRegistrados,
  estructuraGlobalGastos,
  utilidadOperacional,
  otrosIngresos,
  otrosEgresos,
  utilidadAntesImpuestos,
  utilidadNeta,
  rentabilidadReal,

  costoPrimo,
  costosIndirectosServicio,
  costoProduccionTotal,

  totalCostoYGasto,
  margenRentabilidad,
  porcentajeMargenRentabilidad
};
}

function calcularSemaforoGRUK(utilidadOperacional, rentabilidadReal) {
  if (utilidadOperacional < 0) {
    return {
      semaforo: "🔴 Rojo — Riesgo financiero crítico",
      mensajeSemaforo:
        "GRUK detecta que la carga estructural fija está consumiendo más recursos de los que genera el negocio. Se recomienda revisar nómina, logística, publicidad, precios, desperdicio y productos de baja rentabilidad."
    };
  }

  if (rentabilidadReal < 10) {
    return {
      semaforo: "🟡 Amarillo — Rentabilidad baja",
      mensajeSemaforo:
        "El restaurante genera utilidad, pero el margen es bajo. GRUK recomienda fortalecer productos rentables, controlar gastos y revisar precios."
    };
  }

  return {
    semaforo: "🟢 Verde — Rentabilidad saludable",
    mensajeSemaforo:
      "La operación presenta rentabilidad positiva. GRUK recomienda mantener control de costos, inventario y gastos."
  };
}

function calcularPresupuestoGRUK(restaurantId, ingresosTotales, utilidadNeta) {
  const presupuestoVentas =
    Number(localStorage.getItem(`presupuestoVentas_${restaurantId}`) || 0);

  const presupuestoUtilidad =
    Number(localStorage.getItem(`presupuestoUtilidad_${restaurantId}`) || 0);

  const cumplimientoVentas =
    presupuestoVentas > 0
      ? (ingresosTotales / presupuestoVentas) * 100
      : 0;

  const cumplimientoUtilidad =
    presupuestoUtilidad > 0
      ? (utilidadNeta / presupuestoUtilidad) * 100
      : 0;

  return {
    presupuestoVentas,
    presupuestoUtilidad,
    cumplimientoVentas,
    cumplimientoUtilidad
  };
}
function calcularVariacionesMensualesGRUK(historico) {
  if (!historico || historico.length < 2) {
    return {
      hayVariacion: false,
      mensaje: "Aún no hay suficientes meses cerrados para calcular variaciones."
    };
  }

  const anterior =
    historico[historico.length - 2];

  const actual =
    historico[historico.length - 1];

  function variacion(valorActual, valorAnterior) {
    valorActual = Number(valorActual || 0);
    valorAnterior = Number(valorAnterior || 0);

    if (valorAnterior === 0) return 0;

    return ((valorActual - valorAnterior) / valorAnterior) * 100;
  }

  return {
    hayVariacion: true,

    mesAnterior: anterior.mes,
    mesActual: actual.mes,

    ingresos: variacion(actual.ingresos, anterior.ingresos),
    materiaPrima: variacion(actual.materia_prima, anterior.materia_prima),
    gastosOperativos: variacion(actual.gastos_operativos, anterior.gastos_operativos),
    nomina: variacion(actual.nomina, anterior.nomina),
    utilidadOperacional: variacion(actual.utilidad_operacional, anterior.utilidad_operacional),
    rentabilidadReal: variacion(actual.rentabilidad_real, anterior.rentabilidad_real)
  };
}
function generarControlCostosGRUK(f) {

  if (
    !f.historicoFinanciero ||
    f.historicoFinanciero.length < 2
  ) {
    return null;
  }

  const actual =
    f.historicoFinanciero[f.historicoFinanciero.length - 1];

  const anterior =
    f.historicoFinanciero[f.historicoFinanciero.length - 2];

  const variacion = (a, b) => {
    a = Number(a || 0);
    b = Number(b || 0);

    if (b === 0) return 0;

    return Number((((a - b) / b) * 100).toFixed(2));
  };

  const materiaPrima = variacion(
    actual.costosMateriaPrima || actual.materia_prima,
    anterior.costosMateriaPrima || anterior.materia_prima
  );

  const nomina = variacion(
    actual.gastoNomina || actual.nomina,
    anterior.gastoNomina || anterior.nomina
  );

  const utilidad = variacion(
    actual.utilidadOperacional || actual.utilidad_operacional || actual.utilidadNeta,
    anterior.utilidadOperacional || anterior.utilidad_operacional || anterior.utilidadNeta
  );

  const margen = variacion(
    actual.rentabilidadReal || actual.rentabilidad_real,
    anterior.rentabilidadReal || anterior.rentabilidad_real
  );
let indiceControlCostos = 10;

if (materiaPrima > 5) indiceControlCostos -= 1.5;
if (nomina > 5) indiceControlCostos -= 1.5;
if (utilidad < -10) indiceControlCostos -= 2;
if (margen < -5) indiceControlCostos -= 2;

if (materiaPrima < -5) indiceControlCostos += 0.5;
if (nomina < -5) indiceControlCostos += 0.5;
if (utilidad > 10) indiceControlCostos += 1;
if (margen > 5) indiceControlCostos += 1;

indiceControlCostos =
  Math.min(10, Math.max(0, indiceControlCostos));

let lecturaIndiceControl = "";

if (indiceControlCostos >= 8) {
  lecturaIndiceControl =
    "🟢 Control de costos sólido. El restaurante muestra buena disciplina financiera frente al mes anterior.";
} else if (indiceControlCostos >= 5) {
  lecturaIndiceControl =
    "🟡 Control de costos medio. Hay señales mixtas que deben vigilarse para evitar deterioro financiero.";
} else {
  lecturaIndiceControl =
    "🔴 Control de costos débil. GRUK recomienda revisar urgentemente materia prima, nómina, gastos, precios y margen operacional.";
}
  const diagnostico = [];

  if (materiaPrima > 5) {
    diagnostico.push(
      "⚠️ La materia prima aumentó de forma relevante. GRUK recomienda revisar proveedores, desperdicio, gramajes, porciones y cambios en precios de compra."
    );
  } else if (materiaPrima < -5) {
    diagnostico.push(
      "✅ La materia prima disminuyó. Esto puede indicar mejor negociación, menor desperdicio o mayor control en recetas."
    );
  } else {
    diagnostico.push(
      "🟡 La materia prima se mantiene estable frente al mes anterior."
    );
  }

  if (nomina > 5) {
    diagnostico.push(
      "⚠️ La nómina aumentó. Se recomienda revisar turnos, horas extra, productividad del personal y relación entre ventas y carga laboral."
    );
  } else if (nomina < -5) {
    diagnostico.push(
      "✅ La nómina disminuyó. GRUK detecta una mejora potencial en eficiencia laboral, siempre que no afecte la calidad del servicio."
    );
  } else {
    diagnostico.push(
      "🟡 La nómina se mantiene dentro de un rango estable."
    );
  }

  if (utilidad > 10) {
    diagnostico.push(
      "🟢 La utilidad operacional mejoró de forma importante. Las estrategias comerciales y el control de costos están generando mejor resultado financiero."
    );
  } else if (utilidad < -10) {
    diagnostico.push(
      "🔴 La utilidad operacional se deterioró. GRUK recomienda revisar costos, gastos, precios, nómina y productos de bajo margen."
    );
  } else {
    diagnostico.push(
      "🟡 La utilidad operacional se mantiene relativamente estable."
    );
  }

  if (margen > 5) {
    diagnostico.push(
      "🟢 El margen operacional mejoró. El restaurante está convirtiendo mejor sus ingresos en utilidad."
    );
  } else if (margen < -5) {
    diagnostico.push(
      "🔴 El margen operacional cayó. Aunque las ventas puedan aumentar, los costos o gastos están consumiendo más rentabilidad."
    );
  } else {
    diagnostico.push(
      "🟡 El margen operacional no tuvo cambios fuertes frente al periodo anterior."
    );
  }

  return {
    materiaPrima,
    nomina,
    utilidad,
    margen,

    semaforoMateriaPrima: obtenerSemaforoVariacion(materiaPrima, "costo"),
    semaforoNomina: obtenerSemaforoVariacion(nomina, "costo"),
    semaforoUtilidad: obtenerSemaforoVariacion(utilidad, "utilidad"),
    semaforoMargen: obtenerSemaforoVariacion(margen, "costo"),

    diagnostico,
    indiceControlCostos,
lecturaIndiceControl,

    mesActual: actual.mes,
    mesAnterior: anterior.mes
  };
}
function obtenerSemaforoVariacion(valor, tipo) {

  if (tipo === "utilidad") {

    if (valor >= 10) return "🟢 Excelente";
    if (valor >= 0) return "🟡 Estable";
    return "🔴 En deterioro";

  }

  // Materia prima, nómina y margen

  if (valor <= -5) return "🟢 Mejoró";
  if (valor <= 5) return "🟡 Estable";
  return "🔴 Empeoró";

}

function generarCausasAutomaticasGRUK(variaciones) {
  if (!variaciones || !variaciones.hayVariacion) {
    return [
      "Aún no hay suficientes meses cerrados para detectar causas automáticas."
    ];
  }

  const causas = [];

  if (variaciones.materiaPrima > 10) {
    causas.push(
      "⚠️ Materia prima aumentó de forma importante. Posibles causas: desperdicio, compra costosa, inflación, mala negociación con proveedores, robo hormiga, porciones mal estandarizadas o errores en recetas."
    );
  }

  if (variaciones.gastosOperativos > 10) {
    causas.push(
      "⚠️ Los gastos operativos aumentaron. Posibles causas: publicidad sin retorno, gastos innecesarios, servicios más costosos, mantenimiento no planeado o mala clasificación de gastos."
    );
  }

  if (variaciones.nomina > 10) {
    causas.push(
      "⚠️ La nómina aumentó. Posibles causas: contratación adicional, horas extra, personal improductivo, mala programación de turnos o bajo volumen de ventas frente al personal contratado."
    );
  }

  if (variaciones.ingresos < -10) {
    causas.push(
      "📉 Los ingresos disminuyeron. Posibles causas: baja demanda, pérdida de clientes, productos poco atractivos, mala estrategia comercial, precios mal ajustados o caída en pedidos."
    );
  }

  if (variaciones.utilidadOperacional < -10) {
    causas.push(
      "🔴 La utilidad operacional empeoró. Posibles causas: gastos creciendo más rápido que ventas, aumento de costos, nómina pesada, logística costosa o productos con margen insuficiente."
    );
  }

  if (causas.length === 0) {
    causas.push(
      "✅ No se detectan variaciones críticas. Los cambios del periodo parecen estar dentro de un rango controlado."
    );
  }

  return causas;
}


async function calcularFinanzasGRUK(restaurantIdParam) {
  const restaurantId =
    restaurantIdParam || getRestaurantIdFinanzas();

  const base =
    await obtenerDatosFinancierosGRUK(restaurantId);

  const ingresos =
    calcularIngresosGRUK(base.datosVentas, base.pagosCaja);

  const gastos =
    clasificarGastosGRUK(base.gastos);

  const gastoNomina =
    calcularNominaGRUK(base.personal);

  const estado =
    calcularEstadoResultadosGRUK({
      ...ingresos,
      ...gastos,
      gastoNomina
    });

  const semaforo =
    calcularSemaforoGRUK(
      estado.utilidadOperacional,
      estado.rentabilidadReal
    );

  const presupuesto =
    calcularPresupuestoGRUK(
      restaurantId,
      ingresos.ingresosTotales,
      estado.utilidadNeta
    );

  const historicoFinanciero =
  JSON.parse(localStorage.getItem(`historicoFinanciero_${restaurantId}`)) || [];

const variacionesMensuales =
  calcularVariacionesMensualesGRUK(historicoFinanciero);
const causasAutomaticas =
  generarCausasAutomaticasGRUK(variacionesMensuales);

const resultadoFinanciero = {
  restaurantId,

  ...ingresos,
  ...gastos,

  gastoNomina,

  ...estado,
  ...semaforo,
  ...presupuesto,

  historicoFinanciero,
  variacionesMensuales,
  causasAutomaticas
};

resultadoFinanciero.controlCostos =
  generarControlCostosGRUK(resultadoFinanciero);

return resultadoFinanciero; 
}

async function cerrarMesFinanciero() {
  const restaurantId =
    getRestaurantIdFinanzas();

  const f =
    await calcularFinanzasGRUK(restaurantId);

  const mesActual =
    new Date().toLocaleString("es-CO", {
      month: "long",
      year: "numeric"
    });

  const historico =
    JSON.parse(localStorage.getItem(`historicoFinanciero_${restaurantId}`)) || [];

console.log("FINANZAS:", f);

  const yaExiste =
    historico.some(h => h.mes === mesActual);

  if (yaExiste) {
    alert("Este mes ya fue cerrado. No se puede cerrar dos veces.");
    return;
  }


  historico.push({
    mes: mesActual,
    ingresos: f.ingresosTotales,
    ventasQR: f.ventasQR,
    ventasManualCaja: f.ventasManualCaja,
    materia_prima: f.costosMateriaPrima,
    gastos_operativos: f.gastosOperativosRegistrados,
    nomina: f.gastoNomina,
    estructura_global_gastos: f.estructuraGlobalGastos,
    utilidad_bruta: f.utilidadBruta,
    utilidad_operacional: f.utilidadOperacional,
    rentabilidad_real: f.rentabilidadReal,
    fechaCierre: new Date().toISOString()
  });

  localStorage.setItem(
    `historicoFinanciero_${restaurantId}`,
    JSON.stringify(historico)
  );

  const estado =
    document.getElementById("estadoCierreMensual");

  if (estado) {
    estado.innerHTML = `
      <div class="card">
        <p><strong>Mes cerrado:</strong> ${mesActual}</p>
        <p><strong>Ingresos reales:</strong> ${formatoCOPFinanzas(f.ingresosTotales)}</p>
        <p><strong>Utilidad operacional:</strong> ${formatoCOPFinanzas(f.utilidadOperacional)}</p>
        <p><strong>Rentabilidad real:</strong> ${f.rentabilidadReal.toFixed(2)}%</p>
      </div>
    `;
  }

  alert("Mes financiero cerrado correctamente");
}

function porcentajeSobreIngresos(valor, ingresos) {
  return ingresos > 0
    ? ((Number(valor || 0) / ingresos) * 100).toFixed(2) + "%"
    : "0.00%";
}

function generarBloqueFinancieroGRUK(f) {
  let diagnosticoGeneral = "";

if (
  porcentajeSobreIngresos(
    f.costosMateriaPrima,
    f.ingresosTotales
  ).replace("%","") > 35
){

diagnosticoGeneral +=
"• El costo de materia prima es elevado.<br>";

}

if (
  porcentajeSobreIngresos(
    f.gastoNomina,
    f.ingresosTotales
  ).replace("%","") > 30
){

diagnosticoGeneral +=
"• La nómina consume una parte importante de los ingresos.<br>";

}

if (
  porcentajeSobreIngresos(
    f.gastosOperativosRegistrados,
    f.ingresosTotales
  ).replace("%","") > 20
){

diagnosticoGeneral +=
"• Los gastos operativos están creciendo más rápido que las ventas.<br>";

}

if(f.utilidadOperacional < 0){

diagnosticoGeneral +=
"• El negocio presenta pérdida operacional.<br>";

}

if(diagnosticoGeneral===""){

diagnosticoGeneral =
"Todos los indicadores financieros se encuentran dentro de parámetros saludables.";

}
  return `

<h2>Fundamentos de costos y gastos GRUK</h2>

<div class="card">
<p><strong>¿Qué es un costo?</strong><br>
Es todo recurso necesario para producir un bien o prestar un servicio. En restaurantes incluye materia prima, insumos, mano de obra directa y elementos necesarios para dejar el producto disponible para venta o consumo.
</p>

<p><strong>¿Qué es un gasto?</strong><br>
Es el recurso consumido para administrar, vender, financiar o sostener el negocio, sin formar parte directa del producto.
</p>

<p><strong>Costo directo:</strong> Tiene relación directa con el producto o servicio. Ejemplo: materia prima, mano de obra directa y contrataciones necesarias para producir.</p>

<p><strong>Costo indirecto:</strong> No forma parte material del producto, pero es indispensable para producir o prestar el servicio. Ejemplo: energía, combustible, mantenimiento, seguros, arriendo o depreciación.</p>
</div>

<h2>Estado de Resultados Profesional GRUK</h2>

<div class="card">
<table>
<thead>
<tr>
<th>Concepto</th>
<th>Valor</th>
<th>% sobre ingresos</th>
</tr>
</thead>

<tbody>
<tr>
<td><strong>Ventas brutas</strong></td>
<td><strong>${formatoCOPFinanzas(f.ventasBrutas)}</strong></td>
<td>100.00%</td>
</tr>

<tr>
<td>Menos: Descuentos</td>
<td>${formatoCOPFinanzas(f.descuentosVentas)}</td>
<td>${porcentajeSobreIngresos(f.descuentosVentas, f.ingresosTotales)}</td>
</tr>

<tr>
<td>Menos: Devoluciones</td>
<td>${formatoCOPFinanzas(f.devolucionesVentas)}</td>
<td>${porcentajeSobreIngresos(f.devolucionesVentas, f.ingresosTotales)}</td>
</tr>

<tr>
<td><strong>Ventas netas</strong></td>
<td><strong>${formatoCOPFinanzas(f.ventasNetas)}</strong></td>
<td>${porcentajeSobreIngresos(f.ventasNetas, f.ingresosTotales)}</td>
</tr>

<tr>
<td>Menos: Costo de producción / materia prima</td>
<td>${formatoCOPFinanzas(f.costosMateriaPrima)}</td>
<td>${porcentajeSobreIngresos(f.costosMateriaPrima, f.ingresosTotales)}</td>
</tr>

<tr>
<td><strong>Utilidad bruta</strong></td>
<td><strong>${formatoCOPFinanzas(f.utilidadBruta)}</strong></td>
<td><strong>${porcentajeSobreIngresos(f.utilidadBruta, f.ingresosTotales)}</strong></td>
</tr>

<tr>
<td>Menos: Gastos de administración</td>
<td>${formatoCOPFinanzas(f.gastosAdministracion)}</td>
<td>${porcentajeSobreIngresos(f.gastosAdministracion, f.ingresosTotales)}</td>
</tr>

<tr>
<td>Menos: Gastos en ventas</td>
<td>${formatoCOPFinanzas(f.gastosVentas)}</td>
<td>${porcentajeSobreIngresos(f.gastosVentas, f.ingresosTotales)}</td>
</tr>

<tr>
<td>Menos: Gastos de logística / domicilios</td>
<td>${formatoCOPFinanzas(f.gastosLogistica)}</td>
<td>${porcentajeSobreIngresos(f.gastosLogistica, f.ingresosTotales)}</td>
</tr>

<tr>
<td>Menos: Nómina</td>
<td>${formatoCOPFinanzas(f.gastoNomina)}</td>
<td>${porcentajeSobreIngresos(f.gastoNomina, f.ingresosTotales)}</td>
</tr>

<tr>
<td><strong>Utilidad Operacional</strong></td>
<td><strong>${formatoCOPFinanzas(f.utilidadOperacional)}</strong></td>
<td><strong>${f.rentabilidadReal.toFixed(2)}%</strong></td>
</tr>
</tbody>
</table>

<p>
<strong>Lectura GRUK:</strong><br>
GRUK calcula una sola utilidad operacional usando ingresos reales, materia prima, gastos operativos registrados y nómina. Este valor alimenta el semáforo financiero, el histórico y la rentabilidad real para evitar descuadres entre secciones.
</p>
</div>

<h2>Resumen de Control de Operación</h2>

<div class="card">
<table>
<tbody>
<tr><td>Total ingresos reales</td><td>${formatoCOPFinanzas(f.ingresosTotales)}</td></tr>
<tr><td>Costos estimados de materia prima</td><td>${formatoCOPFinanzas(f.costosMateriaPrima)}</td></tr>
<tr><td>Gastos operativos registrados</td><td>${formatoCOPFinanzas(f.gastosOperativosRegistrados)}</td></tr>
<tr><td>Nómina mensual</td><td>${formatoCOPFinanzas(f.gastoNomina)}</td></tr>
<tr><td><strong>Estructura global de gastos</strong></td><td><strong>${formatoCOPFinanzas(f.estructuraGlobalGastos)}</strong></td></tr>
</tbody>
</table>
</div>

<h2>Semáforo Financiero GRUK</h2>

<div class="card">
<h3>${f.semaforo}</h3>
<p><strong>Rentabilidad operacional real:</strong> ${f.rentabilidadReal.toFixed(2)}%</p>
<p>${f.mensajeSemaforo}</p>
</div>

<h2>Estado Comparativo Gerencial</h2>

<div class="card">
<table>
<thead>
<tr>
<th>Concepto</th>
<th>Real</th>
<th>Presupuesto</th>
<th>Cumplimiento</th>
</tr>
</thead>
<tbody>
<tr>
<td>Ingresos reales</td>
<td>${formatoCOPFinanzas(f.ingresosTotales)}</td>
<td>${formatoCOPFinanzas(f.presupuestoVentas)}</td>
<td>${f.cumplimientoVentas.toFixed(1)}%</td>
</tr>
<tr>
<td>Utilidad operacional</td>
<td>${formatoCOPFinanzas(f.utilidadOperacional)}</td>
<td>${formatoCOPFinanzas(f.presupuestoUtilidad)}</td>
<td>${f.cumplimientoUtilidad.toFixed(1)}%</td>
</tr>
</tbody>
</table>
</div>

<h2>Histórico Financiero Cerrado GRUK</h2>

<div class="card">
<table>
<thead>
<tr>
<th>Mes</th>
<th>Ingresos</th>
<th>Materia prima</th>
<th>Gastos operativos</th>
<th>Nómina</th>
<th>Utilidad operacional</th>
<th>Rentabilidad</th>
</tr>
</thead>
<tbody>
${
f.historicoFinanciero.length > 0
? f.historicoFinanciero.map(h => `
<tr>
<td>${h.mes}</td>
<td>${formatoCOPFinanzas(h.ingresos || h.ingresosTotales)}</td>
<td>${formatoCOPFinanzas(h.materia_prima || h.costosMateriaPrima)}</td>
<td>${formatoCOPFinanzas(h.gastos_operativos || h.totalGastos)}</td>
<td>${formatoCOPFinanzas(h.nomina || h.gastoNomina)}</td>
<td>${formatoCOPFinanzas(h.utilidad_operacional || h.utilidadNeta)}</td>
<td>
${Number(
  (
    (
      Number(h.utilidad_operacional || h.utilidadNeta || 0)
      /
      Number(h.ingresos || h.ingresosTotales || 1)
    ) * 100
  )
).toFixed(2)}%
</td>
</tr>
`).join("")
: `
<tr>
<td colspan="7">No hay meses cerrados todavía.</td>
</tr>
`
}
</tbody>
</table>
</div>
<h2>Costos de Producción GRUK</h2>

<div class="card">

<table>

<tr>
<td><strong>Materia prima</strong></td>
<td>${formatoCOPFinanzas(f.costosMateriaPrima)}</td>
</tr>

<tr>
<td><strong>Mano de obra directa (Nómina)</strong></td>
<td>${formatoCOPFinanzas(f.gastoNomina)}</td>
</tr>

<tr>
<td><strong>Costo Primo</strong></td>
<td><strong>${formatoCOPFinanzas(f.costoPrimo)}</strong></td>
</tr>

<tr>
<td><strong>Costos Indirectos de Servicio (CIS)</strong></td>
<td>${formatoCOPFinanzas(f.costosIndirectosServicio)}</td>
</tr>

<tr>
<td><strong>Costo Total de Producción</strong></td>
<td><strong>${formatoCOPFinanzas(f.costoProduccionTotal)}</strong></td>
</tr>
<tr>
<td><strong>Participación del Costo Primo</strong></td>
<td>${((f.costoPrimo / f.costoProduccionTotal) * 100).toFixed(2)}%</td>
</tr>

<tr>
<td><strong>Participación de Costos Indirectos</strong></td>
<td>${((f.costosIndirectosServicio / f.costoProduccionTotal) * 100).toFixed(2)}%</td>
</tr>

</table>

</div>
<div class="card">

<h3>Interpretación GRUK</h3>

<p>

${
f.costosIndirectosServicio >
f.costoPrimo

?

"⚠️ Los costos indirectos de servicio superan el costo primo. El restaurante está destinando más recursos a sostener la operación que a producir. Se recomienda revisar logística, publicidad, administración y demás costos fijos."

:

"✅ El costo primo representa la mayor parte del costo de producción, indicando una estructura de costos más saludable para la operación."

}

</p>

</div>
<h2>Rendimiento sobre el Costo Total GRUK</h2>

<div class="card">

<table>
<tbody>

<tr>
<td><strong>Ingresos Totales</strong></td>
<td>${formatoCOPFinanzas(f.ingresosTotales)}</td>
</tr>

<tr>
<td><strong>Costo Total de Producción y Operación</strong></td>
<td>${formatoCOPFinanzas(f.totalCostoYGasto)}</td>
</tr>

<tr>
<td><strong>Resultado Operacional</strong></td>
<td>${formatoCOPFinanzas(f.margenRentabilidad)}</td>
</tr>

<tr>
<td><strong>% Rendimiento sobre el Costo Total</strong></td>
<td>${Number(f.porcentajeMargenRentabilidad || 0).toFixed(2)}%</td>
</tr>

</tbody>
</table>

<p><strong>Lectura GRUK:</strong><br>
${
f.porcentajeMargenRentabilidad >= 35
? "🟢 El margen de rentabilidad es saludable."
: f.porcentajeMargenRentabilidad >= 20
? "🟡 El margen es aceptable, pero debe vigilarse."
: "🔴 El margen de rentabilidad es insuficiente. Se recomienda revisar precios, costos, gastos, nómina y desperdicios."
}
</p>

</div>

<h3>Arquitectura Financiera GRUK</h3>

<p>

GRUK analiza el restaurante desde dos perspectivas complementarias.

<br><br>

<strong>Margen Operacional:</strong> mide la capacidad del negocio para convertir las ventas en utilidad.

<br><br>

<strong>Rendimiento sobre el Costo Total:</strong> mide qué tan eficiente es el restaurante administrando todos los recursos invertidos en producir y operar.

<br><br>

Mientras el <strong>Margen Operacional</strong> responde cómo se comporta el negocio frente al mercado, el <strong>Rendimiento sobre el Costo Total</strong> responde qué tan bien administra internamente cada peso invertido.

<br><br>

La combinación de ambos indicadores permite evaluar simultáneamente la rentabilidad comercial y la eficiencia operativa del restaurante.

</p>
<div class="card">

<h3>Lectura GRUK</h3>

<p>

${
f.porcentajeMargenRentabilidad >= 20

?

"🟢 El rendimiento sobre el costo total es saludable. Cada peso invertido en la operación está generando una rentabilidad adecuada y el restaurante mantiene una estructura financiera eficiente."

:

f.porcentajeMargenRentabilidad >= 0

?

"🟡 El rendimiento sobre el costo total es positivo, pero todavía existe poco margen para absorber incrementos en costos o gastos. Se recomienda fortalecer la eficiencia operativa."

:

"🔴 El rendimiento sobre el costo total es negativo. Actualmente el restaurante destruye valor económico por cada peso invertido en producir y operar. GRUK recomienda revisar precios, costos, desperdicios, logística, nómina y estructura operativa para recuperar la rentabilidad."

}

</p>

</div>
<h2>Variación Mensual GRUK</h2>

<div class="card">

${
f.variacionesMensuales && f.variacionesMensuales.hayVariacion
? `
<p>
<strong>Comparación:</strong>
${f.variacionesMensuales.mesAnterior}
vs
${f.variacionesMensuales.mesActual}
</p>

<table>
<thead>
<tr>
<th>Concepto</th>
<th>Variación</th>
<th>Lectura GRUK</th>
</tr>
</thead>

<tbody>

<tr>
<td>Ingresos</td>
<td>${f.variacionesMensuales.ingresos.toFixed(2)}%</td>
<td>${f.variacionesMensuales.ingresos >= 0 ? "📈 Aumentaron los ingresos." : "📉 Disminuyeron los ingresos."}</td>
</tr>

<tr>
<td>Materia prima</td>
<td>${f.variacionesMensuales.materiaPrima.toFixed(2)}%</td>
<td>${f.variacionesMensuales.materiaPrima > 0 ? "⚠️ Subió el costo de materia prima." : "✅ Bajó o se controló la materia prima."}</td>
</tr>

<tr>
<td>Gastos operativos</td>
<td>${f.variacionesMensuales.gastosOperativos.toFixed(2)}%</td>
<td>${f.variacionesMensuales.gastosOperativos > 0 ? "⚠️ Aumentaron los gastos operativos." : "✅ Se redujeron los gastos operativos."}</td>
</tr>

<tr>
<td>Nómina</td>
<td>${f.variacionesMensuales.nomina.toFixed(2)}%</td>
<td>${f.variacionesMensuales.nomina > 0 ? "⚠️ Aumentó la carga de nómina." : "✅ La nómina se mantuvo o bajó."}</td>
</tr>

<tr>
<td>Utilidad operacional</td>
<td>${f.variacionesMensuales.utilidadOperacional.toFixed(2)}%</td>
<td>${f.variacionesMensuales.utilidadOperacional >= 0 ? "📈 Mejoró la utilidad operacional." : "📉 Empeoró la utilidad operacional."}</td>
</tr>

</tbody>
</table>
`
: `
<p>
Aún necesitas cerrar al menos dos meses financieros para que GRUK calcule variaciones mensuales.
</p>
`
}

</div>

<div class="card">

<p>
<strong>Margen Bruto:</strong>
${porcentajeSobreIngresos(f.utilidadBruta, f.ingresosTotales)}
</p>

<p>
<strong>Margen Operacional:</strong>
${f.rentabilidadReal.toFixed(2)}%
</p>

<p>
<strong>Costo de Materia Prima:</strong>
${porcentajeSobreIngresos(f.costosMateriaPrima, f.ingresosTotales)}
</p>

<p>
<strong>Peso de Nómina:</strong>
${porcentajeSobreIngresos(f.gastoNomina, f.ingresosTotales)}
</p>

<p>
<strong>Peso de Gastos Operativos:</strong>
${porcentajeSobreIngresos(f.gastosOperativosRegistrados, f.ingresosTotales)}
</p>


</div>
<div class="card">




<h3>Interpretación automática GRUK</h3>

<p>

${diagnosticoGeneral}

</p>

</div>
<h2>Control de Costos GRUK</h2>

<div class="card">

${
f.controlCostos
?

`

<p>

<strong>Comparación:</strong>

${f.controlCostos.mesAnterior}

vs

${f.controlCostos.mesActual}

</p>

<table>

<thead>

<tr>

<th>Indicador</th>

<th>Variación</th>

<th>Semáforo</th>

</tr>

</thead>

<tbody>

<tr>

<td>Materia Prima</td>

<td>

${f.controlCostos.materiaPrima>=0?"📈":"📉"}

${f.controlCostos.materiaPrima.toFixed(2)}%

</td>

<td>

${f.controlCostos.semaforoMateriaPrima}

</td>

</tr>

<tr>

<td>Nómina</td>

<td>

${f.controlCostos.nomina>=0?"📈":"📉"}

${f.controlCostos.nomina.toFixed(2)}%

</td>

<td>

${f.controlCostos.semaforoNomina}

</td>

</tr>

<tr>

<td>Utilidad Operacional</td>

<td>

${f.controlCostos.utilidad>=0?"📈":"📉"}

${f.controlCostos.utilidad.toFixed(2)}%

</td>

<td>

${f.controlCostos.semaforoUtilidad}

</td>

</tr>

<tr>

<td>Margen Operacional</td>

<td>

${f.controlCostos.margen>=0?"📈":"📉"}

${f.controlCostos.margen.toFixed(2)}%

</td>

<td>

${f.controlCostos.semaforoMargen}

</td>

</tr>

</tbody>

</table>
<h3>Índice de Control de Costos GRUK</h3>

<p>
<strong>${f.controlCostos.indiceControlCostos.toFixed(1)} / 10</strong>
</p>

<p>
${f.controlCostos.lecturaIndiceControl}
</p>
<h3>Diagnóstico Automático GRUK</h3>

<p>
${f.controlCostos.diagnostico.join("<br><br>")}
</p>

`

:

`

<p>

Aún se necesitan al menos dos meses financieros cerrados para que GRUK pueda comparar automáticamente la evolución de los costos y la rentabilidad.

</p>

`

}

</div>
`;
}

function calcularPrecioVentaGRUK(costoProduccion, rentabilidadDeseada) {
  const cp = Number(costoProduccion || 0);
  const r = Number(rentabilidadDeseada || 0);

  if (cp <= 0 || r <= 0 || r >= 100) {
    return 0;
  }

  return cp / (1 - r / 100);
}
async function simularFinanzasGRUK() {
  const restaurantId =
    getRestaurantIdFinanzas();

  const f =
    await calcularFinanzasGRUK(restaurantId);

  const cambioVentas =
    Number(document.getElementById("simVentas")?.value || 0);

  const cambioMateriaPrima =
    Number(document.getElementById("simMateriaPrima")?.value || 0);

    const tipoVentas =
  document.getElementById("simTipoVentas")?.value || "precio";

  const cambioGastos =
    Number(document.getElementById("simGastos")?.value || 0);

  const cambioNomina =
    Number(document.getElementById("simNomina")?.value || 0);

  const ingresosSimulados =
    f.ingresosTotales * (1 + cambioVentas / 100);

  let materiaPrimaSimulada =
  f.costosMateriaPrima * (1 + cambioMateriaPrima / 100);

if (tipoVentas === "volumen") {
  materiaPrimaSimulada =
    materiaPrimaSimulada * (1 + cambioVentas / 100);
}

  const gastosSimulados =
    f.gastosOperativosRegistrados * (1 + cambioGastos / 100);

  const nominaSimulada =
    f.gastoNomina * (1 + cambioNomina / 100);

  const utilidadBrutaSimulada =
    ingresosSimulados -
    materiaPrimaSimulada;

  const utilidadOperacionalSimulada =
    utilidadBrutaSimulada -
    gastosSimulados -
    nominaSimulada;

  const rentabilidadSimulada =
    ingresosSimulados > 0
      ? (utilidadOperacionalSimulada / ingresosSimulados) * 100
      : 0;
const porcentajeMateriaPrimaSimulada =
  ingresosSimulados > 0
    ? materiaPrimaSimulada / ingresosSimulados
    : 0;

const denominadorEquilibrio =
  1 - porcentajeMateriaPrimaSimulada;

const ventasEquilibrio =
  denominadorEquilibrio > 0
    ? (gastosSimulados + nominaSimulada) / denominadorEquilibrio
    : 0;
  let lectura = "";

  if (utilidadOperacionalSimulada < 0) {
    lectura =
      "🔴 El escenario simulado genera pérdida operacional. GRUK recomienda revisar precios, gastos, nómina o volumen mínimo de ventas.";
  } else if (rentabilidadSimulada < 10) {
    lectura =
      "🟡 El escenario simulado genera utilidad, pero con rentabilidad baja. Conviene mejorar margen o reducir costos.";
  } else {
    lectura =
      "🟢 El escenario simulado muestra una operación financieramente saludable.";
  }

  const contenedor =
    document.getElementById("resultadoSimuladorFinanciero");

  if (!contenedor) return;

  contenedor.innerHTML = `
    <div class="card">
      <h3>Resultado de simulación</h3>

      <p><strong>Ingresos actuales:</strong> ${formatoCOPFinanzas(f.ingresosTotales)}</p>
      <p><strong>Ingresos simulados:</strong> ${formatoCOPFinanzas(ingresosSimulados)}</p>

      <p><strong>Materia prima simulada:</strong> ${formatoCOPFinanzas(materiaPrimaSimulada)}</p>
      <p><strong>Gastos simulados:</strong> ${formatoCOPFinanzas(gastosSimulados)}</p>
      <p><strong>Nómina simulada:</strong> ${formatoCOPFinanzas(nominaSimulada)}</p>

      <p><strong>Utilidad operacional simulada:</strong> ${formatoCOPFinanzas(utilidadOperacionalSimulada)}</p>
      <p><strong>Rentabilidad simulada:</strong> ${rentabilidadSimulada.toFixed(2)}%</p>
      <p>
<strong>Ventas mínimas de equilibrio:</strong>
${formatoCOPFinanzas(ventasEquilibrio)}
</p>

<p>
<strong>Lectura de equilibrio GRUK:</strong><br>
Para no perder dinero en este escenario, el restaurante necesita facturar mínimo
${formatoCOPFinanzas(ventasEquilibrio)}.
</p>

      <p><strong>Lectura GRUK:</strong><br>${lectura}</p>
    </div>
  `;
}
function guardarPresupuestoGRUK() {
  const restaurantId =
    getRestaurantIdFinanzas();

  const ventas =
    Number(document.getElementById("presupuestoVentas").value || 0);

  const utilidad =
    Number(document.getElementById("presupuestoUtilidad").value || 0);

  localStorage.setItem(
    `presupuestoVentas_${restaurantId}`,
    ventas
  );

  localStorage.setItem(
    `presupuestoUtilidad_${restaurantId}`,
    utilidad
  );

  document.getElementById("resultadoPresupuestoGRUK").innerHTML = `
    <div class="card">
      <p>✅ Presupuesto guardado.</p>
      <p>Meta ingresos: <strong>${formatoCOPFinanzas(ventas)}</strong></p>
      <p>Meta utilidad: <strong>${formatoCOPFinanzas(utilidad)}</strong></p>
    </div>
  `;
}
function calcularPrecioInteligenteGRUK(producto, finanzas) {

  const costoMateriaPrima = Number(producto.costo || 0);

  const porcentajeCostosIndirectos =
    finanzas.costoProduccionTotal > 0
      ? finanzas.costosIndirectosServicio / finanzas.costoProduccionTotal
      : 0;

  const costoIndirecto =
    costoMateriaPrima * porcentajeCostosIndirectos;

  const costoReal =
    costoMateriaPrima + costoIndirecto;

  const margenObjetivo = 0.60;

  const precioSugerido =
    costoReal / (1 - margenObjetivo);

  const margenActual =
    producto.precio > 0
      ? ((producto.precio - costoReal) / producto.precio) * 100
      : 0;

  return {

    costoMateriaPrima,

    costoIndirecto,

    costoReal,

    precioActual: producto.precio,

    precioSugerido,

    margenActual,

    margenObjetivo

  };

}
function interpretarPrecioGRUK(r){

  if(r.margenActual<20){

    return "🔴 El margen del producto es insuficiente. Se recomienda aumentar el precio o reducir costos.";

  }

  if(r.margenActual<40){

    return "🟡 El margen es aceptable, aunque existe oportunidad para mejorar la rentabilidad.";

  }

  if(r.margenActual<60){

    return "🟢 El margen es saludable para la operación.";

  }

  return "⭐ Producto con margen premium. Conviene proteger su calidad y posicionamiento.";

}
function analizarGasto() {
  const nombre = document.getElementById("nombreGasto").value.trim();
  const valor = Number(document.getElementById("valorGasto").value);
  const categoria = document.getElementById("categoriaGasto").value;
  const impacto = document.getElementById("impactoGasto").value;
  const objetivo = document.getElementById("objetivoGasto").value;
  const observacion = document.getElementById("observacionGasto").value.trim();

  const gastoPertenece = document.getElementById("gastoPertenece").value;
  const restauranteBeneficiado = document.getElementById("restauranteBeneficiado").value.trim();
  const pedidoRelacionado = document.getElementById("pedidoRelacionado").value.trim();
  const esCostoRecuperable = gastoPertenece === "no";

  if (!nombre || !valor || !categoria || !impacto || !objetivo) {
    alert("Completa todos los datos del gasto");
    return;
  }

  const texto = `${nombre} ${categoria} ${objetivo} ${observacion}`.toLowerCase();

  const contiene = (palabras) =>
    palabras.some(palabra => texto.includes(palabra));

  const esCampanaGanadora = contiene([
    "black friday", "hot sale", "tráfico", "trafico", "roi", "retorno",
    "vendimos todo", "quebró stock", "quebro stock", "agotó stock",
    "agoto stock", "stock agotado", "triplicó", "triplico", "duplicó", "duplico"
  ]);

  const esExperienciaCliente = contiene([
    "clientes felices", "cliente feliz", "satisfacción", "satisfaccion",
    "fidelización", "fidelizacion", "recompra", "quejas", "espera", "fila",
    "atención", "atencion", "experiencia", "tiempo de espera", "servicio"
  ]);

  const esInfraestructura = contiene([
    "infraestructura", "equipo", "equipos", "maquinaria", "nevera", "horno",
    "licuadora", "computador", "tablet", "mobiliario", "sillas", "mesas",
    "adecuación", "adecuacion"
  ]);

  const esOperacionBase =
    objetivo === "operacion" ||
    contiene([
      "arriendo", "nómina", "nomina", "servicios", "luz", "agua", "gas",
      "internet", "software", "domicilio", "transporte", "mantenimiento"
    ]);

  let metodo = "";
  let diagnostico = "";
  let analisis = "";
  let decision = "";
  let recomendacion = "";

  let porcentajeCambio = 0;
  let tipoCambio = "reducción";
  let usoDinero = "";
  let controlRiesgo = "";
  let nuevoValor = valor;

  if (esCostoRecuperable) {
    metodo = "Método 8 — Recuperación de capital operativo externo";
    tipoCambio = "recaudo";
    porcentajeCambio = 0;
    nuevoValor = valor;

    diagnostico = "Se detectó un gasto operativo utilizado por un tercero y no por este restaurante.";

    analisis = `El gasto en ${nombre} no representa una pérdida operativa interna real. El recurso fue utilizado para beneficiar una operación externa, por lo que el capital debe recuperarse mediante cobro administrativo y no mediante reducción de personal o recorte logístico.`;

    decision = "Generar cuenta de cobro inmediata al restaurante beneficiado.";

    recomendacion = `📊 Orden de Recaudo de GRUK:<br><br>
Se detectó una fuga de capital de $${valor.toLocaleString("es-CO")} en el rubro logístico.<br><br>
Pedido relacionado: ${pedidoRelacionado || "Sin ID asociado"}.<br><br>
GRUK recomienda generar cuenta de cobro inmediata a: ${restauranteBeneficiado || "Restaurante beneficiado"}.<br><br>
No reduzca personal ni capacidad logística. El problema no es exceso operativo: el problema es capital no recuperado.`;

    usoDinero = "El dinero recuperado debe regresar a liquidez operativa y caja menor.";
    controlRiesgo = "Si estos costos externos no se cobran rápidamente, el restaurante puede aparentar pérdidas falsas y tomar decisiones equivocadas de recorte.";
  }

  else if (impacto === "alto" && esCampanaGanadora && objetivo === "ventas") {
    metodo = "Método 4 — Escalamiento controlado de oportunidad validada";
    tipoCambio = "aumento";
    porcentajeCambio = 60;
    nuevoValor = Math.round(valor * 1.6);

    diagnostico = "El gasto muestra señales de oportunidad validada: generó demanda, retorno inmediato o agotamiento de stock. No debe tratarse como un gasto a recortar.";
    analisis = `El gasto en ${nombre} funcionó como una inversión comercial comprobada. Cuando el mercado responde con tráfico, ventas o quiebre de inventario, el problema no es haber gastado, sino no haber preparado suficiente capacidad para capturar toda la demanda.`;
    decision = "Escalar en la próxima fecha comercial equivalente, no repetir mecánicamente en un mes normal.";
    recomendacion = `Aumentar el presupuesto de forma controlada de $${valor.toLocaleString("es-CO")} a cerca de $${nuevoValor.toLocaleString("es-CO")}, pero solo para eventos equivalentes como Black Friday, temporada de descuentos o campañas con demanda comparable.`;
    usoDinero = "60% al canal que ya convirtió, 25% a inventario de productos ganadores, 10% a refuerzo operativo y 5% a reserva de contingencia.";
    controlRiesgo = "Si el costo por pedido sube más del 20%, si la rotación cae o si el stock no alcanza, se debe frenar la inversión. Escalar sin medición sería especulación, no estrategia.";
  }

  else if (esExperienciaCliente && objetivo === "fidelizacion") {
    metodo = "Método 5 — Protección de retención y experiencia";
    tipoCambio = "ajuste";
    porcentajeCambio = impacto === "bajo" ? 10 : impacto === "medio" ? 5 : 0;
    nuevoValor = Math.round(valor * (1 - porcentajeCambio / 100));

    diagnostico = "Este gasto pertenece a experiencia de cliente. Aunque no siempre aumenta el ticket inmediato, puede proteger recompra, reputación y retención.";
    analisis = `El gasto en ${nombre} no debe evaluarse solo por ventas inmediatas. Si reduce filas, tiempos de espera, quejas o mejora satisfacción, puede estar defendiendo ingresos futuros. Recortarlo sin medir retención puede generar ahorro aparente y pérdida comercial posterior.`;
    decision = porcentajeCambio > 0 ? "Ajustar de forma leve y medir experiencia antes de recortar fuerte." : "Mantener y medir indicadores de fidelización.";
    recomendacion = `Antes de reducir este gasto, mide quejas, tiempo de espera, calificaciones, recompra y comentarios de clientes. Si esos indicadores mejoran, el gasto debe mantenerse o rediseñarse, no eliminarse.`;
    usoDinero = "40% a experiencia directa del cliente, 25% a reducción de tiempos, 20% a capacitación o servicio y 15% a medición de satisfacción.";
    controlRiesgo = "No recortar más del 10% sin comparar indicadores de satisfacción. El ahorro inmediato puede destruir valor si aumenta la pérdida de clientes.";
  }

  else if (esInfraestructura) {
    metodo = "Método 6 — Evaluación de activo operativo";
    tipoCambio = "amortización";
    porcentajeCambio = 0;
    nuevoValor = valor;

    diagnostico = "Este gasto parece ser infraestructura o equipo. No debe juzgarse como gasto mensual simple, sino como activo operativo que debe producir eficiencia durante varios periodos.";
    analisis = `El gasto en ${nombre} debe evaluarse por uso, duración, ahorro de tiempo, reducción de errores o aumento de capacidad. Si el equipo permite producir más, atender más rápido o bajar desperdicio, su valor debe medirse en varios meses, no solo en el día de compra.`;
    decision = "Mantener, medir uso real y calcular recuperación del valor.";
    recomendacion = "Divide el valor del gasto entre los meses de uso esperado. Luego compara si el ahorro de tiempo, aumento de producción o reducción de desperdicio supera esa cuota mensual.";
    usoDinero = "70% debe justificarse por capacidad productiva, 20% por reducción de tiempos y 10% por mantenimiento preventivo.";
    controlRiesgo = "Si el equipo no se usa de forma recurrente o no reduce costos, se convierte en capital inmovilizado. Debe tener responsable, frecuencia de uso y métrica de recuperación.";
  }

  else if (esOperacionBase) {
    metodo = "Método 7 — Control de gasto estructural";
    tipoCambio = "renegociación";
    porcentajeCambio = impacto === "bajo" ? 12 : impacto === "medio" ? 8 : 5;
    nuevoValor = Math.round(valor * (1 - porcentajeCambio / 100));

    diagnostico = "Este gasto parece operativo o fijo. No debe eliminarse de forma agresiva, pero sí revisarse porque puede volverse una carga silenciosa.";
    analisis = `El gasto en ${nombre} sostiene la operación base del restaurante. En estos casos, la estrategia no es cortar sin criterio, sino renegociar, comparar proveedores, controlar consumo y evitar que el costo fijo crezca más rápido que las ventas.`;
    decision = "Renegociar, controlar consumo y buscar eficiencia gradual.";
    recomendacion = `Buscar una mejora del ${porcentajeCambio}% mediante negociación, cambio de proveedor, consumo eficiente o revisión de frecuencia.`;
    usoDinero = "50% del ahorro debe ir a liquidez operativa, 30% a insumos críticos y 20% a reserva para pagos fijos.";
    controlRiesgo = "No comprometer la continuidad operativa. Si el recorte afecta servicio, tiempos o calidad, debe revertirse.";
  }

  else if (impacto === "bajo") {
    metodo = "Método 1 — Corrección de gasto sin retorno";
    tipoCambio = "reducción";
    porcentajeCambio =
      categoria === "Publicidad" ? 25 :
      categoria === "Personal" ? 12 :
      categoria === "Equipos" ? 10 :
      categoria === "Insumos" ? 30 :
      35;

    nuevoValor = Math.round(valor * (1 - porcentajeCambio / 100));

    diagnostico = "El gasto no demuestra retorno suficiente frente al dinero invertido.";
    analisis = `El gasto en ${nombre} consume recursos sin evidenciar ventas, eficiencia, rotación o protección de clientes. En este caso, conservarlo igual sería permitir que el dinero se quede en una actividad de bajo rendimiento.`;
    decision = "Reducir, medir y reasignar.";
    recomendacion = `Aplicar una reducción del ${porcentajeCambio}% y reasignar ese dinero a productos, procesos o canales con mejor rendimiento verificable.`;
    usoDinero = "50% a productos de alta rotación, 25% a insumos críticos, 15% a mejora operativa y 10% a reserva de caja.";
    controlRiesgo = "Si después del recorte no bajan las ventas ni la satisfacción, confirma que el gasto era prescindible.";
  }

  else if (impacto === "medio") {
    metodo = "Método 2 — Validación de retorno financiero";
    tipoCambio = "reducción controlada";
    porcentajeCambio =
      categoria === "Publicidad" ? 15 :
      categoria === "Personal" ? 7 :
      categoria === "Equipos" ? 5 :
      categoria === "Insumos" ? 18 :
      20;

    nuevoValor = Math.round(valor * (1 - porcentajeCambio / 100));

    diagnostico = "El gasto tiene utilidad parcial, pero todavía no justifica completamente su valor.";
    analisis = `El gasto en ${nombre} puede estar ayudando, pero no demuestra con claridad que el beneficio supere el costo. Debe conservarse bajo prueba, no como gasto automático.`;
    decision = "Reducir parcialmente y comprobar retorno.";
    recomendacion = `Reducirlo en ${porcentajeCambio}% durante un periodo de prueba. Si el resultado no empeora, el restaurante estaba pagando más de lo necesario.`;
    usoDinero = "45% a actividades con retorno medible, 30% a operación esencial, 15% a servicio al cliente y 10% a reserva.";
    controlRiesgo = "No eliminar hasta confirmar con datos. La reducción debe ser reversible si afecta ventas, tiempos o calidad.";
  }

  else {
    metodo = "Método 3 — Optimización de gasto útil";
    tipoCambio = "optimización";
    porcentajeCambio =
      categoria === "Publicidad" ? 10 :
      categoria === "Personal" ? 5 :
      categoria === "Equipos" ? 5 :
      categoria === "Insumos" ? 8 :
      8;

    nuevoValor = Math.round(valor * (1 - porcentajeCambio / 100));

    diagnostico = "El gasto sí parece útil, pero puede optimizarse sin perder el beneficio.";
    analisis = `El gasto en ${nombre} genera un resultado visible. No debe eliminarse, pero sí revisarse para pagar mejor, comprar mejor o ejecutar con mayor eficiencia.`;
    decision = "Mantener, comparar y optimizar.";
    recomendacion = `Buscar una optimización de ${porcentajeCambio}% mediante negociación, mejor planificación, medición del canal o ajuste de cantidades.`;
    usoDinero = "60% debe conservarse en la actividad que funciona, 20% puede destinarse a prueba de mejora, 10% a medición y 10% a reserva.";
    controlRiesgo = "No tocar lo que funciona sin medir. Optimizar no significa recortar por tacañería, sino conservar resultado pagando mejor.";
  }

  const diferencia = Math.abs(valor - nuevoValor);

  document.getElementById("resultadoControlGasto").innerHTML = `
    <div class="card">
      <h3>${metodo}</h3>
      <p><strong>Gasto analizado:</strong> ${nombre}</p>
      <p><strong>Categoría:</strong> ${categoria}</p>
      <p><strong>Objetivo del gasto:</strong> ${
        objetivo === "ventas" ? "Ventas inmediatas" :
        objetivo === "operacion" ? "Operación base" :
        "Fidelización a largo plazo"
      }</p>
      <p><strong>Valor registrado:</strong> $${valor.toLocaleString("es-CO")}</p>
      <p><strong>Diagnóstico experto:</strong><br>${diagnostico}</p>
      <p><strong>Análisis financiero:</strong><br>${analisis}</p>
      <p><strong>Decisión recomendada:</strong><br>${decision}</p>
      <p><strong>Recomendación estratégica:</strong><br>${recomendacion}</p>
      <p><strong>Impacto proyectado:</strong><br>
      Tipo de acción: ${tipoCambio}. Porcentaje sugerido: ${porcentajeCambio}%.
      Valor proyectado: $${nuevoValor.toLocaleString("es-CO")}.
      Diferencia estimada: $${diferencia.toLocaleString("es-CO")}.
      </p>
      <p><strong>Distribución sugerida:</strong><br>${usoDinero}</p>
      <p><strong>Control de riesgo:</strong><br>${controlRiesgo}</p>
      <p><strong>Observación registrada:</strong><br>${observacion || "Sin observación adicional."}</p>
    </div>
  `;

  const restaurantId = getRestaurantId();

  const gastosGuardados =
    JSON.parse(localStorage.getItem(`gastos_${restaurantId}`)) || [];

  gastosGuardados.push({
    nombre,
    valor,
    categoria,
    impacto,
    objetivo,
    observacion,
    gastoPertenece,
    restauranteBeneficiado,
    pedidoRelacionado,
    esCostoRecuperable,
    fecha: new Date().toISOString()
  });

  localStorage.setItem(
    `gastos_${restaurantId}`,
    JSON.stringify(gastosGuardados)
  );
}
window.calcularFinanzasGRUK = calcularFinanzasGRUK;
window.generarBloqueFinancieroGRUK = generarBloqueFinancieroGRUK;
window.cerrarMesFinanciero = cerrarMesFinanciero;
window.calcularPrecioVentaGRUK = calcularPrecioVentaGRUK;
window.simularFinanzasGRUK = simularFinanzasGRUK;
window.guardarPresupuestoGRUK = guardarPresupuestoGRUK;
window.normalizarCosto = function(valor) {
  const numero = Number(valor);

  if (!numero) return 0;

  if (numero > 0 && numero < 1000) {
    return numero * 1000;
  }

  return numero;
};

window.normalizarPrecio = function(valor) {
  const numero = Number(valor);

  if (!numero) return 0;

  if (numero > 0 && numero < 1000) {
    return numero * 1000;
  }

  return numero;
};
async function calcularPrecioInteligente() {
  const producto = document.getElementById("productoPrecio").value.trim();

  const materiaPrima = window.normalizarCosto(
    document.getElementById("costoMateriaPrima").value
  );

  const costoOperativo = window.normalizarCosto(
    document.getElementById("costoOperativo").value
  );

  const precioActual = window.normalizarPrecio(
    document.getElementById("precioActualVenta").value
  );

  const tiempo = Number(document.getElementById("tiempoPreparacion").value);
  const tipo = document.getElementById("tipoProductoPrecio").value;
  const demanda = document.getElementById("demandaProducto").value;

  if (!producto || !materiaPrima || !costoOperativo || !precioActual || !tiempo) {
    alert("Completa todos los campos");
    return;
  }
  const finanzasActuales =
  typeof calcularFinanzasGRUK === "function"
    ? await calcularFinanzasGRUK(getRestaurantId())
    : null;

const factorIndirectoGRUK =
  finanzasActuales && finanzasActuales.costoProduccionTotal > 0
    ? finanzasActuales.costosIndirectosServicio / finanzasActuales.costoProduccionTotal
    : 0;

const costoIndirectoGRUK =
  materiaPrima * factorIndirectoGRUK;

  const textoProducto = producto.toLowerCase();

  const esBebidaBasica =
    textoProducto.includes("tinto") ||
    textoProducto.includes("cafe") ||
    textoProducto.includes("café") ||
    textoProducto.includes("agua") ||
    textoProducto.includes("aromatica") ||
    textoProducto.includes("aromática");

  const esEntradaBasica =
    textoProducto.includes("empanada") ||
    textoProducto.includes("pan") ||
    textoProducto.includes("arepa") ||
    textoProducto.includes("papita") ||
    textoProducto.includes("papas pequeñas") ||
    textoProducto.includes("entrada");

  const esPostre =
    textoProducto.includes("postre") ||
    textoProducto.includes("volcan") ||
    textoProducto.includes("volcán") ||
    textoProducto.includes("arequipe") ||
    textoProducto.includes("brownie") ||
    textoProducto.includes("torta") ||
    textoProducto.includes("helado") ||
    textoProducto.includes("flan");

  const esPlatoFuerte =
    textoProducto.includes("carne") ||
    textoProducto.includes("punta") ||
    textoProducto.includes("anca") ||
    textoProducto.includes("costilla") ||
    textoProducto.includes("lomo") ||
    textoProducto.includes("pollo") ||
    textoProducto.includes("filete") ||
    textoProducto.includes("parrilla") ||
    textoProducto.includes("asado") ||
    textoProducto.includes("asada");

  const puedeSerGancho =
    tipo === "ancla" &&
    (esBebidaBasica || esEntradaBasica) &&
    !esPostre &&
    !esPlatoFuerte;

  const costoBase =
  materiaPrima +
  costoOperativo +
  costoIndirectoGRUK;

  const costoTrabajo =
    tiempo >= 45 ? 18000 :
    tiempo >= 30 ? 12000 :
    tiempo >= 20 ? 8000 :
    tiempo >= 10 ? 5000 :
    tiempo >= 5 ? 1500 :
    500;

  const costoTotal = costoBase + costoTrabajo;

  const configFinanciera =
    JSON.parse(localStorage.getItem(`configFinanciera_${getRestaurantId()}`)) || {
      margenSeguridad: 0.02
    };
  
  const MS = Number(configFinanciera.margenSeguridad || 0.02);


const PB =
  costoTotal / (1 - MS);

if (precioActual < PB) {
  Dmax = 0;
} else {
  Dmax =
    1 - (PB / precioActual);
}

Dmax = Math.max(0, Math.min(Dmax, MS));

  let margenMinimo = 0.25;
  let margenRecomendado = 0.45;
  let margenPremium = 0.65;

  if (tipo === "ancla") {
    margenMinimo = 0.05;
    margenRecomendado = 0.18;
    margenPremium = 0.30;
  }

  if (tipo === "estrella") {
    margenMinimo = 0.35;
    margenRecomendado = 0.52;
    margenPremium = 0.70;
  }

  if (tipo === "diamante") {
    margenMinimo = 0.45;
    margenRecomendado = 0.68;
    margenPremium = 0.88;
  }

  if (demanda === "alta" && !puedeSerGancho) {
    margenRecomendado += 0.05;
    margenPremium += 0.08;
  }

  if (demanda === "baja") {
    margenRecomendado -= 0.08;
    margenPremium -= 0.10;
  }

  margenMinimo = Math.min(Math.max(margenMinimo, 0.03), 0.85);
  margenRecomendado = Math.min(Math.max(margenRecomendado, 0.08), 0.88);
  margenPremium = Math.min(Math.max(margenPremium, 0.12), 0.90);

  const precioMinimo = Math.round(costoTotal / (1 - margenMinimo));
  const precioRecomendado = Math.round(costoTotal / (1 - margenRecomendado));
  const precioPremium = Math.round(costoTotal / Math.max(0.08, 1 - margenPremium));

  let descuentoRecomendado = 0;
  let explicacionDescuento = "";

  if (precioActual < PB) {
    descuentoRecomendado = 0;

    explicacionDescuento = `
    No se recomienda aplicar descuentos.

    El precio actual está por debajo del Precio Blindado de ${formatoCOP(PB)}.

    Antes de pensar en promociones, GRUK recomienda primero alcanzar el precio blindado para proteger el margen de seguridad.
    `;
  } else if (precioActual >= PB && precioActual < precioPremium) {
    descuentoRecomendado = Math.min((Dmax * 100) * 0.5, 10);

    explicacionDescuento = `
    El producto ya supera el Precio Blindado.

    Se recomienda un descuento prudente de hasta ${descuentoRecomendado.toFixed(2)}%.

    Esto permite incentivar ventas sin sacrificar excesivamente el margen de seguridad.
    `;
  } else {
    descuentoRecomendado = Math.min((Dmax * 100) * 0.7, 15);

    explicacionDescuento = `
    El producto se encuentra en una zona premium.

    Existe espacio para aplicar descuentos tácticos sin comprometer la rentabilidad del producto.

    GRUK recomienda no superar ${descuentoRecomendado.toFixed(2)}%.
    `;
  }

  const margenActual =
    precioActual > 0
      ? ((precioActual - costoTotal) / precioActual) * 100
      : 0;
      let indiceRentabilidad = 0;

if (margenActual >= 70)
  indiceRentabilidad = 10;

else if (margenActual >= 60)
  indiceRentabilidad = 9;

else if (margenActual >= 50)
  indiceRentabilidad = 8;

else if (margenActual >= 40)
  indiceRentabilidad = 7;

else if (margenActual >= 30)
  indiceRentabilidad = 6;

else if (margenActual >= 20)
  indiceRentabilidad = 5;

else if (margenActual >= 10)
  indiceRentabilidad = 4;

else
  indiceRentabilidad = 2;
let clasificacion = "";

if (margenActual >= 60) {

  clasificacion = "⭐ Producto Premium";

}

else if (margenActual >= 40) {

  clasificacion = "🟢 Producto Estrella";

}

else if (margenActual >= 20) {

  clasificacion = "🟡 Producto Rentable";

}

else {

  clasificacion = "🔴 Producto de Bajo Margen";

}


let recomendaciones = [];

if (margenActual < 20) {

  recomendaciones.push(
    "• Aumentar precio de venta."
  );

}

if (demanda === "alta") {

  recomendaciones.push(
    "• Existe capacidad para incrementar precio sin afectar significativamente la demanda."
  );

}

if (tipo === "ancla" && margenActual < 40) {
  recomendaciones.push(
    "• Utilizar como producto de atracción y complementar con venta cruzada."
  );
}

if (tipo === "ancla" && margenActual >= 40) {
  recomendaciones.push(
    "• Aunque fue marcado como producto ancla, su margen es alto. GRUK recomienda tratarlo como producto estrella o premium antes de usarlo como gancho."
  );
}

if (tipo === "estrella") {

  recomendaciones.push(
    "• Mantener disponibilidad permanente y reforzar publicidad."
  );

}

if (tipo === "diamante") {

  recomendaciones.push(
    "• Mantener percepción Premium evitando descuentos frecuentes."
  );

}

if (recomendaciones.length === 0) {

  recomendaciones.push(
    "• Mantener estrategia actual."
  );

}

  const utilidadActual = precioActual - costoTotal;

  const perdidaPorVenta = Math.max(0, costoTotal - precioActual);

  const destruccionMensual = perdidaPorVenta * 30;

  let semaforo = "";
  let decision = "";
  let accion = "";
  let interpretacion = "";

  if (precioActual < costoTotal && puedeSerGancho) {
    semaforo = "🔵 Azul — producto gancho subsidiado";
    decision = "Mantener solo si genera venta cruzada comprobada";
    accion = "No subir automáticamente. Validar si arrastra compras rentables.";

    interpretacion = `
      ${producto} está por debajo de su costo total, pero puede cumplir una función estratégica como producto gancho de entrada.

      Este precio solo tiene sentido si atrae tráfico al inicio del consumo y empuja compras de mayor margen.

      Si no existe venta cruzada real, el subsidio deja de ser estrategia y se convierte en pérdida.
    `;
  }

  else if (precioActual < costoTotal && (esPostre || esPlatoFuerte)) {
    semaforo = "🔴 Rojo de emergencia — cuello de botella operativo";
    decision = "Suspender subsidio y subir precio de inmediato";
    accion = `Subir mínimo hasta ${formatoCOP(precioMinimo)}.`;

    interpretacion = `
      ${producto} no debe tratarse como producto gancho.

      Cada venta destruye aproximadamente ${formatoCOP(perdidaPorVenta)} de margen operativo.

      GRUK recomienda suspender el subsidio y corregir el precio hacia el mínimo sostenible de ${formatoCOP(precioMinimo)}.
    `;
  }

  else if (precioActual < costoTotal) {
    semaforo = "🔴 Rojo de emergencia — pérdida real por unidad";
    decision = "Subir precio de forma inmediata";
    accion = `Subir mínimo hasta ${formatoCOP(precioMinimo)}.`;

    interpretacion = `
      El precio actual está por debajo del costo total estratégico.

      Cada venta destruye aproximadamente ${formatoCOP(perdidaPorVenta)} de margen operativo.
    `;
  }

  else if (precioActual < PB) {
    semaforo = "🟡 Amarillo — precio no blindado";
    decision = "Subir hacia el Precio Blindado";
    accion = `Ajustar el precio mínimo a ${formatoCOP(PB)}.`;

    interpretacion = `
      El precio actual de ${formatoCOP(precioActual)} cubre parte de la estructura económica,
      pero no alcanza el Precio Blindado de ${formatoCOP(PB)}.

      Esto significa que no se está respetando el Margen de Seguridad del ${(MS * 100).toFixed(2)}%.

      GRUK recomienda no marcar este precio como sano hasta que alcance o supere el Precio Blindado.
    `;
  }

  else if (precioActual >= precioRecomendado && precioActual <= precioPremium) {
    semaforo = "🟢 Verde — precio estratégicamente sano";
    decision = "Mantener y medir";
    accion = "No subir todavía. Medir aceptación, rotación y recompra.";

    interpretacion = `
      El precio actual está dentro del rango óptimo calculado y además respeta el Precio Blindado.

      Aquí la mejor decisión no es subir por subir, sino defender el equilibrio entre margen, demanda y percepción de valor.
    `;
  }

  else if (precioActual >= precioMinimo && precioActual < precioRecomendado) {
    semaforo = "🟡 Amarillo — precio conservador";
    decision = "Subir gradualmente";
    accion = `Mover el precio hacia ${formatoCOP(precioRecomendado)}.`;

    interpretacion = `
      El precio actual ya supera el mínimo sostenible, pero todavía no captura todo el valor económico del producto.
    `;
  }

  else {
    semaforo = "🟣 Morado — precio premium alto";
    decision = "Validar percepción de valor";
    accion = "Mantener solo si la demanda sigue estable y el cliente percibe valor superior.";

    interpretacion = `
      El precio actual supera el rango premium calculado.

      Puede funcionar solo si existe reputación, presentación fuerte, experiencia superior y demanda sostenida.
    `;
  }
const inteligenciaGRUK =
  generarMotorInteligenciaGRUK({
    margenActual,
    precioActual,
    precioRecomendado,
    precioPremium,
    PB,
    indiceRentabilidad,
    clasificacion,
    tipo,
    demanda
  });

  document.getElementById("resultadoPrecioInteligente").innerHTML = `
    <div class="card">
      <h3>Diagnóstico estratégico de precio</h3>

      <p><strong>Producto:</strong> ${producto}</p>

      <p><strong>Costo materia prima:</strong> ${formatoCOP(materiaPrima)}</p>
      <p><strong>Costo operativo:</strong> ${formatoCOP(costoOperativo)}</p>
      <p><strong>Costo trabajo/tiempo estimado:</strong> ${formatoCOP(costoTrabajo)}</p>
      <p><strong>Costo total estratégico:</strong> ${formatoCOP(costoTotal)}</p>
      <p><strong>Margen de Seguridad (MS):</strong> ${(MS * 100).toFixed(2)}%</p>
      <p><strong>Precio Blindado (PB):</strong> ${formatoCOP(PB)}</p>
      <p><strong>Descuento Máximo Permitido (Dmax):</strong> ${(Dmax * 100).toFixed(2)}%</p>

      <p><strong>Descuento recomendado por GRUK:</strong> ${descuentoRecomendado.toFixed(2)}%</p>

      <p><strong>Justificación del descuento:</strong><br>${explicacionDescuento}</p>

      <p><strong>Precio actual:</strong> ${formatoCOP(precioActual)}</p>
      <p><strong>Utilidad actual por unidad:</strong> ${formatoCOP(utilidadActual)}</p>

      <p><strong>Precio mínimo sostenible:</strong> ${formatoCOP(precioMinimo)}</p>
      <p><strong>Precio rentable recomendado:</strong> ${formatoCOP(precioRecomendado)}</p>
      <p><strong>Precio premium estratégico:</strong> ${formatoCOP(precioPremium)}</p>

      <p><strong>Semáforo GRUK:</strong><br>${semaforo}</p>

      <p><strong>Margen actual estimado:</strong><br>
      ${margenActual.toFixed(1)}%
      </p>
      <p>
<strong>Índice de Rentabilidad GRUK:</strong><br>
${indiceRentabilidad}/10
</p>

<p>
<strong>Clasificación Estratégica:</strong><br>
${clasificacion}
</p>

<p>
<strong>Recomendaciones GRUK:</strong><br>
${recomendaciones.join("<br>")}
</p>

      <p><strong>Decisión recomendada:</strong><br>${decision}</p>

      <p><strong>Acción sugerida:</strong><br>${accion}</p>
      <h3>Centro de Inteligencia Comercial GRUK</h3>

<p>

<strong>Contexto Comercial Detectado</strong>

<br><br>

${inteligenciaGRUK.contexto.join("<br>")}

</p>

<br>

<p>

<strong>Diagnóstico Estratégico</strong>

<br><br>

${inteligenciaGRUK.recomendaciones.join("<br><br>")}

</p>

      <p><strong>Interpretación GRUK:</strong><br>${interpretacion}</p>
    </div>
  `;
}
function guardarInteligenciaGRUK() {
  const restaurantId = getRestaurantId();

  const presupuestoVentas =
    Number(localStorage.getItem(`presupuestoVentas_${restaurantId}`) || 0);

  const presupuestoUtilidad =
    Number(localStorage.getItem(`presupuestoUtilidad_${restaurantId}`) || 0);

  const datos = {
    competencia: document.getElementById("competenciaGRUK").value,
    ciudad: document.getElementById("ciudadGRUK").value.trim(),
    temporada: document.getElementById("temporadaGRUK").value,
    marketing: document.getElementById("marketingGRUK").value,
    valor: document.getElementById("valorGRUK").value,
    metaVentasMensual: presupuestoVentas,
    metaUtilidadMensual: presupuestoUtilidad,
    fechaActualizacion: new Date().toISOString()
  };

  localStorage.setItem(
    `inteligenciaGRUK_${restaurantId}`,
    JSON.stringify(datos)
  );

  alert(
    "Inteligencia Comercial GRUK guardada. Las estrategias se ajustarán a las metas mensuales de ventas y utilidad."
  );
}

function obtenerInteligenciaGRUK() {
  return (
    JSON.parse(
      localStorage.getItem(`inteligenciaGRUK_${getRestaurantId()}`)
    ) || null
  );
}
function generarMotorInteligenciaGRUK(contexto = {}) {
  const i = obtenerInteligenciaGRUK();

  if (!i) {
    return {
      contexto: [
        "⚠️ Inteligencia Comercial no configurada."
      ],
      diagnostico: [
        "Configura competencia, ciudad, temporada, marketing y percepción de valor para activar el análisis estratégico."
      ],
      riesgo: "🟡 Medio",
      oportunidad: "🟡 Media"
    };
  }

  const margenActual = Number(contexto.margenActual || 0);
  const precioActual = Number(contexto.precioActual || 0);
  const precioRecomendado = Number(contexto.precioRecomendado || 0);
  const precioPremium = Number(contexto.precioPremium || 0);
  const PB = Number(contexto.PB || 0);
  const indiceRentabilidad = Number(contexto.indiceRentabilidad || 0);
  const clasificacion = String(contexto.clasificacion || "");
  const tipo = String(contexto.tipo || "");
  const demanda = String(contexto.demanda || "");

  const metaVentas = Number(i.metaVentasMensual || 0);
  const metaUtilidad = Number(i.metaUtilidadMensual || 0);

  let contextoDetectado = [];
  let diagnostico = [];
  let riesgoPuntos = 0;
  let oportunidadPuntos = 0;

  contextoDetectado.push(
    `Competencia: ${
      i.competencia === "muy_barata"
        ? "🔴 Muy barata"
        : i.competencia === "similar"
        ? "🟡 Similar"
        : "🟢 Más costosa"
    }`
  );

  contextoDetectado.push(
    `Ciudad: ${i.ciudad || "No configurada"}`
  );

  contextoDetectado.push(
    `Temporada: ${
      i.temporada === "alta"
        ? "🟢 Alta"
        : i.temporada === "normal"
        ? "🟡 Normal"
        : "🔴 Baja"
    }`
  );

  contextoDetectado.push(
    `Marketing: ${
      i.marketing === "alto"
        ? "🟢 Alto"
        : i.marketing === "medio"
        ? "🟡 Medio"
        : "🔴 Bajo"
    }`
  );

  contextoDetectado.push(
    `Percepción de valor: ${
      i.valor === "alta"
        ? "🟢 Alta"
        : i.valor === "media"
        ? "🟡 Media"
        : "🔴 Baja"
    }`
  );

  if (metaVentas > 0) {
    contextoDetectado.push(
      `Meta mensual de ventas: ${formatoCOP(metaVentas)}`
    );
  }

  if (metaUtilidad > 0) {
    contextoDetectado.push(
      `Meta mensual de utilidad: ${formatoCOP(metaUtilidad)}`
    );
  }

  if (i.competencia === "muy_barata") riesgoPuntos += 2;
  if (i.temporada === "baja") riesgoPuntos += 2;
  if (i.marketing === "bajo") riesgoPuntos += 1;
  if (i.valor === "baja") riesgoPuntos += 2;
  if (precioActual < PB) riesgoPuntos += 3;
  if (margenActual < 20) riesgoPuntos += 3;

  if (i.temporada === "alta") oportunidadPuntos += 2;
  if (i.marketing === "alto") oportunidadPuntos += 2;
  if (i.valor === "alta") oportunidadPuntos += 2;
  if (i.competencia === "mas_costosa") oportunidadPuntos += 2;
  if (demanda === "alta") oportunidadPuntos += 2;
  if (indiceRentabilidad >= 8) oportunidadPuntos += 2;
  if (margenActual >= 40) oportunidadPuntos += 2;

  if (i.competencia === "muy_barata" && i.valor === "alta") {
    diagnostico.push(
      "⭐ La competencia compite agresivamente por precio, pero la percepción de valor es alta. GRUK recomienda no entrar en guerra de precios; la estrategia debe enfocarse en experiencia, presentación, confianza y diferenciación."
    );
  }

  if (i.competencia === "muy_barata" && i.valor !== "alta") {
    diagnostico.push(
      "🔴 La competencia es muy barata y la percepción de valor no es suficientemente fuerte. Antes de subir precios, GRUK recomienda reforzar valor percibido, presentación, empaque, servicio o propuesta diferencial."
    );
  }

  if (i.temporada === "alta" && demanda === "alta" && margenActual >= 40) {
    diagnostico.push(
      "📈 Temporada alta + demanda alta + margen sano: existe una oportunidad real para incrementar precio de forma gradual o impulsar combos premium."
    );
  }

  if (i.temporada === "baja" && margenActual >= 40) {
    diagnostico.push(
      "📉 Temporada baja con margen saludable: se permiten promociones tácticas controladas para apoyar la meta de ventas sin destruir rentabilidad."
    );
  }

  if (i.temporada === "baja" && margenActual < 25) {
    diagnostico.push(
      "⚠️ Temporada baja con margen débil: no se recomienda competir con descuentos. GRUK recomienda corregir costos, porciones o precio antes de lanzar promociones."
    );
  }

  if (i.marketing === "alto" && i.valor === "alta" && margenActual >= 40) {
    diagnostico.push(
      "🚀 Marketing alto + valor percibido alto: el producto puede soportar una estrategia de posicionamiento premium o campaña de mayor visibilidad."
    );
  }

  if (precioActual < PB) {
    diagnostico.push(
      "🛡️ El precio actual está por debajo del Precio Blindado. GRUK recomienda no aplicar descuentos hasta proteger el margen de seguridad."
    );
  }

  if (precioActual > precioPremium && i.valor !== "alta") {
    diagnostico.push(
      "⚠️ El precio supera el rango premium, pero la percepción de valor no es alta. Se debe reforzar experiencia o ajustar el precio para evitar rechazo del cliente."
    );
  }

  if (precioActual > precioPremium && i.valor === "alta") {
    diagnostico.push(
      "🟣 El precio supera el rango premium y la percepción de valor es alta. Puede sostenerse si existe reputación, diferenciación, recompra y experiencia superior."
    );
  }

  if (tipo === "ancla" && margenActual >= 40) {
    diagnostico.push(
      "⚠️ El producto fue marcado como ancla, pero su margen es alto. GRUK recomienda tratarlo como producto estrella o premium para apoyar la meta de utilidad."
    );
  }

  if (tipo === "ancla" && margenActual < 20) {
    diagnostico.push(
      "🧲 Producto ancla con margen bajo: solo debe mantenerse si genera venta cruzada comprobable hacia productos más rentables."
    );
  }

  if (metaVentas > 0 && margenActual >= 40 && demanda === "alta") {
    diagnostico.push(
      "🎯 La estrategia de incrementar ventas se adapta a la meta mensual: priorizar exposición del producto, combos, venta cruzada y mayor visibilidad comercial."
    );
  }

  if (metaUtilidad > 0 && margenActual >= 60) {
    diagnostico.push(
      "💰 La estrategia se alinea con la meta mensual de utilidad: proteger precio, evitar descuentos agresivos y posicionar el producto como premium."
    );
  }

  if (metaVentas > 0 && metaUtilidad > 0 && margenActual < 25) {
    diagnostico.push(
      "⚠️ Hay tensión entre vender más y proteger utilidad. GRUK recomienda no aumentar volumen con productos de bajo margen; primero debe corregirse el precio o el costo."
    );
  }

  if (indiceRentabilidad >= 8) {
    diagnostico.push(
      "✅ Índice de rentabilidad alto: este producto puede actuar como palanca para cumplir metas comerciales y financieras."
    );
  }

  if (indiceRentabilidad <= 4) {
    diagnostico.push(
      "🔴 Índice de rentabilidad bajo: este producto no debe liderar estrategias de incremento de ventas hasta corregir margen, precio o costos."
    );
  }

  if (diagnostico.length === 0) {
    diagnostico.push(
      "✅ El contexto comercial es estable. GRUK recomienda mantener la estrategia actual y monitorear competencia, demanda, margen y cumplimiento de metas."
    );
  }

  const riesgo =
    riesgoPuntos >= 6
      ? "🔴 Alto"
      : riesgoPuntos >= 3
      ? "🟡 Medio"
      : "🟢 Bajo";

  const oportunidad =
    oportunidadPuntos >= 7
      ? "🟢 Alta"
      : oportunidadPuntos >= 4
      ? "🟡 Media"
      : "🔴 Baja";

  return {
    contexto: contextoDetectado,
    diagnostico: [...new Set(diagnostico)],
    riesgo,
    oportunidad
  };
}

window.calcularPrecioInteligente = calcularPrecioInteligente;
function guardarPresupuestoGerencial() {
  const restaurantId = getRestaurantId();

  const presupuestoVentas =
    Number(document.getElementById("presupuestoVentas").value || 0);

  const presupuestoUtilidad =
    Number(document.getElementById("presupuestoUtilidad").value || 0);

  localStorage.setItem(
    `presupuestoVentas_${restaurantId}`,
    presupuestoVentas
  );

  localStorage.setItem(
    `presupuestoUtilidad_${restaurantId}`,
    presupuestoUtilidad
  );

  const inteligenciaActual =
    JSON.parse(localStorage.getItem(`inteligenciaGRUK_${restaurantId}`)) || {};

  const inteligenciaActualizada = {
    ...inteligenciaActual,
    metaVentasMensual: presupuestoVentas,
    metaUtilidadMensual: presupuestoUtilidad,
    fechaActualizacionMetas: new Date().toISOString()
  };

  localStorage.setItem(
    `inteligenciaGRUK_${restaurantId}`,
    JSON.stringify(inteligenciaActualizada)
  );

  document.getElementById("estadoPresupuestoGerencial").innerHTML = `
    <div class="card">
      <p>✅ Presupuesto guardado correctamente.</p>

      <p>
        <strong>Meta mensual de ventas:</strong>
        ${formatoCOP(presupuestoVentas)}
      </p>

      <p>
        <strong>Meta mensual de utilidad:</strong>
        ${formatoCOP(presupuestoUtilidad)}
      </p>

      <p>
        GRUK conectó estas metas con la Inteligencia Comercial.
        Las estrategias de incremento de ventas, precio, promociones y productos premium
        se adaptarán automáticamente a estos objetivos.
      </p>
    </div>
  `;
}
async function cerrarMesFinanciero() {
  const restaurantId =
    getRestaurantId();

  const pagosCaja =
    JSON.parse(
      localStorage.getItem(
        `pagos_caja_${restaurantId}`
      )
    ) || [];

  const mesActual =
    new Date().toLocaleString("es-CO", {
      month: "long",
      year: "numeric"
    });

  const totalVendidoTexto =
    document.getElementById("totalVendido")?.innerText || "$0";

  const ingresosPanel =
    Number(
      String(totalVendidoTexto).replace(/[^0-9]/g, "")
    );

  const gastos =
    JSON.parse(
      localStorage.getItem(`gastos_${restaurantId}`)
    ) || [];

  const totalGastos =
    gastos.reduce(
      (acc, g) => acc + Number(g.valor || 0),
      0
    );

  const ventasManualCaja =
    pagosCaja
      .filter(p => p.tipoVenta === "manual")
      .reduce(
        (acc, p) => acc + Number(p.total || 0),
        0
      );

  let datosVentas = [];
  let personal = [];

  try {
    let resVentas =
      await fetch(`/estadisticas/pareto?restaurantId=${restaurantId}`);

    if (!resVentas.ok) {
      resVentas =
        await fetch(`/estadisticas/pareto?restaurant=${restaurantId}`);
    }

    if (resVentas.ok) {
      datosVentas = await resVentas.json();
    }
  } catch (error) {
    console.log("No se pudo cargar ventas para cierre:", error);
  }

  try {
    const resPersonal =
      await fetch(`/api/personal?restaurantId=${restaurantId}`);

    if (resPersonal.ok) {
      personal =
        await resPersonal.json();
    }
  } catch (error) {
    console.log("No se pudo cargar personal para cierre:", error);
  }

  const ventasOrdenadas =
    datosVentas
      .map(p => ({
        precioUnitarioActual:
          Number(p.precioUnitarioActual || 0),

        costoMateriaPrimaTotal:
          Number(p.costoMateriaPrimaTotal || 0),

        ventas:
          Number(p.ventas || 0),

        totalDinero:
          Number(p.totalCalculado || 0)
      }))
      .filter(p =>
        p.ventas > 0 &&
        p.precioUnitarioActual > 0 &&
        p.totalDinero > 0
      );

  const ventasQR =
    ventasOrdenadas.reduce(
      (acc, p) => acc + p.totalDinero,
      0
    );

  const costosMateriaPrima =
    ventasOrdenadas.reduce(
      (acc, p) => acc + Number(p.costoMateriaPrimaTotal || 0),
      0
    );

  const gastoNomina =
    personal.reduce(
      (acc, p) => acc + Number(p.salario || 0),
      0
    );

  const ingresosTotales =
    ventasQR +
    ventasManualCaja;

  const utilidadBruta =
    ingresosTotales -
    costosMateriaPrima;

  const utilidadNeta =
    utilidadBruta -
    totalGastos -
    gastoNomina;

  const historico =
    JSON.parse(
      localStorage.getItem(`historicoFinanciero_${restaurantId}`)
    ) || [];

  const yaExiste =
    historico.some(h => h.mes === mesActual);

  if (yaExiste) {
    alert("Este mes ya fue cerrado. No se puede cerrar dos veces.");
    return;
  }

  historico.push({
    mes: mesActual,
    ingresosPanel,
    ingresosTotales,
    ventasQR,
    ventasManualCaja,
    costosMateriaPrima,
    utilidadBruta,
    totalGastos,
    gastoNomina,
    utilidadNeta,
    fechaCierre: new Date().toISOString()
  });

  localStorage.setItem(
    `historicoFinanciero_${restaurantId}`,
    JSON.stringify(historico)
  );

  const estado =
    document.getElementById("estadoCierreMensual");

  if (estado) {
    estado.innerHTML = `
      <div class="card">
        <p><strong>Mes cerrado correctamente:</strong> ${mesActual}</p>
        <p><strong>Ingresos reales:</strong> ${formatoCOP(ingresosTotales)}</p>
        <p><strong>Utilidad neta:</strong> ${formatoCOP(utilidadNeta)}</p>
      </div>
    `;
  }

  alert("Mes financiero cerrado correctamente");
}
