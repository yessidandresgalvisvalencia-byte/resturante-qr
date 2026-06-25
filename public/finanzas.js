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
    rentabilidadReal
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
return {
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
<td><strong>Utilidad operacional antes de impuestos</strong></td>
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
<td>${Number(h.rentabilidad_real || h.rentabilidadReal || 0).toFixed(2)}%</td>
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
window.calcularFinanzasGRUK = calcularFinanzasGRUK;
window.generarBloqueFinancieroGRUK = generarBloqueFinancieroGRUK;
window.cerrarMesFinanciero = cerrarMesFinanciero;
window.calcularPrecioVentaGRUK = calcularPrecioVentaGRUK;
window.simularFinanzasGRUK = simularFinanzasGRUK;
window.guardarPresupuestoGRUK = guardarPresupuestoGRUK;