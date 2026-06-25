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

  if (categoria.includes("publicidad") || nombre.includes("publicidad") || nombre.includes("marketing")) return "Ventas";
  if (categoria.includes("venta") || categoria.includes("ventas")) return "Ventas";

  if (categoria.includes("domicilio") || categoria.includes("logística") || categoria.includes("logistica") || nombre.includes("domicilio")) return "Logística";

  if (categoria.includes("financiero") || nombre.includes("interes") || nombre.includes("crédito") || nombre.includes("credito") || nombre.includes("banco")) return "Financieros";

  if (categoria.includes("insumo") || categoria.includes("producción") || categoria.includes("produccion") || categoria.includes("servicio") || nombre.includes("materia prima")) return "Producción";

  if (categoria.includes("administración") || categoria.includes("administracion") || nombre.includes("contador") || nombre.includes("gerente") || nombre.includes("papeleria")) return "Administración";

  return "Otro";
}

async function calcularFinanzasGRUK(restaurantIdParam) {
  const restaurantId = restaurantIdParam || getRestaurantIdFinanzas();

  const gastos = JSON.parse(localStorage.getItem(`gastos_${restaurantId}`)) || [];
  const pagosCaja = JSON.parse(localStorage.getItem(`pagos_caja_${restaurantId}`)) || [];

  let datosVentas = [];
  let personal = [];

  try {
    let resVentas = await fetch(`/estadisticas/pareto?restaurantId=${restaurantId}`);

    if (!resVentas.ok) {
      resVentas = await fetch(`/estadisticas/pareto?restaurant=${restaurantId}`);
    }

    if (resVentas.ok) {
      datosVentas = await resVentas.json();
    }
  } catch (error) {
    console.log("Error cargando ventas financieras:", error);
  }

  try {
    const resPersonal = await fetch(`/api/personal?restaurantId=${restaurantId}`);

    if (resPersonal.ok) {
      personal = await resPersonal.json();
    }
  } catch (error) {
    console.log("Error cargando personal financiero:", error);
  }

  const ventasOrdenadas = datosVentas
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

  const ventasQR = ventasOrdenadas.reduce((acc, p) => acc + p.totalDinero, 0);

  const ventasManualCaja = pagosCaja
    .filter(p => p.tipoVenta === "manual")
    .reduce((acc, p) => acc + Number(p.total || 0), 0);

  const ventasQRCaja = pagosCaja
    .filter(p => p.tipoVenta === "qr")
    .reduce((acc, p) => acc + Number(p.total || 0), 0);

  const ingresosTotales = ventasQR + ventasManualCaja;

  const costosMateriaPrima = ventasOrdenadas.reduce(
    (acc, p) => acc + Number(p.costoMateriaPrimaTotal || 0),
    0
  );

  const gastoNomina = personal.reduce(
    (acc, p) => acc + Number(p.salario || 0),
    0
  );

  const gastosAdministracion = gastos
    .filter(g => normalizarCategoriaGastoGRUK(g) === "Administración")
    .reduce((acc, g) => acc + Number(g.valor || 0), 0);

  const gastosVentas = gastos
    .filter(g => normalizarCategoriaGastoGRUK(g) === "Ventas")
    .reduce((acc, g) => acc + Number(g.valor || 0), 0);

  const gastosFinancieros = gastos
    .filter(g => normalizarCategoriaGastoGRUK(g) === "Financieros")
    .reduce((acc, g) => acc + Number(g.valor || 0), 0);

  const gastosProduccion = gastos
    .filter(g => normalizarCategoriaGastoGRUK(g) === "Producción")
    .reduce((acc, g) => acc + Number(g.valor || 0), 0);

  const gastosLogistica = gastos
    .filter(g => normalizarCategoriaGastoGRUK(g) === "Logística")
    .reduce((acc, g) => acc + Number(g.valor || 0), 0);

  const gastosOtro = gastos
    .filter(g => normalizarCategoriaGastoGRUK(g) === "Otro")
    .reduce((acc, g) => acc + Number(g.valor || 0), 0);

  const totalGastos = gastos.reduce(
    (acc, g) => acc + Number(g.valor || 0),
    0
  );

  const ventasBrutas = ingresosTotales;
  const descuentosVentas = 0;
  const devolucionesVentas = 0;

  const ventasNetas =
    ventasBrutas -
    descuentosVentas -
    devolucionesVentas;

  const costoProduccionVentas =
    costosMateriaPrima +
    gastosProduccion;

  const utilidadBruta =
    ventasNetas -
    costoProduccionVentas;

  const utilidadOperacional =
    utilidadBruta -
    gastosAdministracion -
    gastosVentas -
    gastosLogistica -
    gastoNomina -
    gastosOtro;

  const otrosIngresos = 0;
  const otrosEgresos = gastosFinancieros;

  const utilidadAntesImpuestos =
    utilidadOperacional +
    otrosIngresos -
    otrosEgresos;

  const utilidadNeta =
    utilidadAntesImpuestos;

  const rentabilidad =
    ingresosTotales > 0
      ? (utilidadNeta / ingresosTotales) * 100
      : 0;

  let semaforo = "";
  let mensajeSemaforo = "";

  if (utilidadNeta < 0) {
    semaforo = "🔴 Rojo — Riesgo financiero";
    mensajeSemaforo = "GRUK detecta que el negocio está consumiendo más recursos de los que genera. Se recomienda revisar precios, nómina, gastos, desperdicio y productos de baja rentabilidad.";
  } else if (rentabilidad < 10) {
    semaforo = "🟡 Amarillo — Rentabilidad baja";
    mensajeSemaforo = "El restaurante tiene utilidad, pero el margen es bajo. GRUK recomienda fortalecer productos rentables y controlar gastos.";
  } else {
    semaforo = "🟢 Verde — Rentabilidad saludable";
    mensajeSemaforo = "La operación presenta rentabilidad positiva. GRUK recomienda mantener control de costos, inventario y gastos.";
  }

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

  const historicoFinanciero =
    JSON.parse(localStorage.getItem(`historicoFinanciero_${restaurantId}`)) || [];

  return {
    restaurantId,
    ventasQR,
    ventasManualCaja,
    ventasQRCaja,
    ingresosTotales,
    ventasBrutas,
    descuentosVentas,
    devolucionesVentas,
    ventasNetas,
    costosMateriaPrima,
    gastosProduccion,
    costoProduccionVentas,
    utilidadBruta,
    gastosAdministracion,
    gastosVentas,
    gastosLogistica,
    gastosFinancieros,
    gastosOtro,
    totalGastos,
    gastoNomina,
    utilidadOperacional,
    otrosIngresos,
    otrosEgresos,
    utilidadAntesImpuestos,
    utilidadNeta,
    rentabilidad,
    semaforo,
    mensajeSemaforo,
    presupuestoVentas,
    presupuestoUtilidad,
    cumplimientoVentas,
    cumplimientoUtilidad,
    historicoFinanciero
  };
}

async function cerrarMesFinanciero() {
  const restaurantId = getRestaurantIdFinanzas();
  const f = await calcularFinanzasGRUK(restaurantId);

  const mesActual = new Date().toLocaleString("es-CO", {
    month: "long",
    year: "numeric"
  });

  const historico =
    JSON.parse(localStorage.getItem(`historicoFinanciero_${restaurantId}`)) || [];

  const yaExiste =
    historico.some(h => h.mes === mesActual);

  if (yaExiste) {
    alert("Este mes ya fue cerrado. No se puede cerrar dos veces.");
    return;
  }

  historico.push({
    mes: mesActual,
    ingresosTotales: f.ingresosTotales,
    ventasQR: f.ventasQR,
    ventasManualCaja: f.ventasManualCaja,
    costosMateriaPrima: f.costosMateriaPrima,
    costoProduccionVentas: f.costoProduccionVentas,
    utilidadBruta: f.utilidadBruta,
    gastosAdministracion: f.gastosAdministracion,
    gastosVentas: f.gastosVentas,
    gastosLogistica: f.gastosLogistica,
    gastosFinancieros: f.gastosFinancieros,
    gastoNomina: f.gastoNomina,
    utilidadOperacional: f.utilidadOperacional,
    utilidadNeta: f.utilidadNeta,
    rentabilidad: f.rentabilidad,
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
        <p><strong>Utilidad neta:</strong> ${formatoCOPFinanzas(f.utilidadNeta)}</p>
        <p><strong>Rentabilidad:</strong> ${f.rentabilidad.toFixed(2)}%</p>
      </div>
    `;
  }

  alert("Mes financiero cerrado correctamente");
}

function generarBloqueFinancieroGRUK(f) {
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
</tr>
</thead>
<tbody>
<tr><td><strong>Ventas brutas</strong></td><td><strong>${formatoCOPFinanzas(f.ventasBrutas)}</strong></td></tr>
<tr><td>Menos: Descuentos</td><td>${formatoCOPFinanzas(f.descuentosVentas)}</td></tr>
<tr><td>Menos: Devoluciones</td><td>${formatoCOPFinanzas(f.devolucionesVentas)}</td></tr>
<tr><td><strong>Ventas netas</strong></td><td><strong>${formatoCOPFinanzas(f.ventasNetas)}</strong></td></tr>
<tr><td>Costo de producción y ventas</td><td>${formatoCOPFinanzas(f.costoProduccionVentas)}</td></tr>
<tr><td><strong>Utilidad bruta</strong></td><td><strong>${formatoCOPFinanzas(f.utilidadBruta)}</strong></td></tr>
<tr><td>Gastos de administración</td><td>${formatoCOPFinanzas(f.gastosAdministracion)}</td></tr>
<tr><td>Gastos en ventas</td><td>${formatoCOPFinanzas(f.gastosVentas)}</td></tr>
<tr><td>Logística / domicilios</td><td>${formatoCOPFinanzas(f.gastosLogistica)}</td></tr>
<tr><td>Nómina</td><td>${formatoCOPFinanzas(f.gastoNomina)}</td></tr>
<tr><td><strong>Utilidad operacional</strong></td><td><strong>${formatoCOPFinanzas(f.utilidadOperacional)}</strong></td></tr>
<tr><td>Otros ingresos</td><td>${formatoCOPFinanzas(f.otrosIngresos)}</td></tr>
<tr><td>Otros egresos / financieros</td><td>${formatoCOPFinanzas(f.otrosEgresos)}</td></tr>
<tr><td><strong>Utilidad antes de impuestos</strong></td><td><strong>${formatoCOPFinanzas(f.utilidadAntesImpuestos)}</strong></td></tr>
</tbody>
</table>
</div>

<h2>Clasificación Gerencial de Costos y Gastos</h2>

<div class="card">
<table>
<thead>
<tr>
<th>Clasificación</th>
<th>Valor</th>
<th>Explicación GRUK</th>
</tr>
</thead>
<tbody>
<tr>
<td>Costo directo / materia prima</td>
<td>${formatoCOPFinanzas(f.costosMateriaPrima)}</td>
<td>Recursos directamente relacionados con la preparación del producto.</td>
</tr>
<tr>
<td>Producción / servicio</td>
<td>${formatoCOPFinanzas(f.gastosProduccion)}</td>
<td>Gastos asociados a producir o prestar el servicio.</td>
</tr>
<tr>
<td>Administración</td>
<td>${formatoCOPFinanzas(f.gastosAdministracion)}</td>
<td>Gerencia, contabilidad, auditoría, papelería y control administrativo.</td>
</tr>
<tr>
<td>Ventas</td>
<td>${formatoCOPFinanzas(f.gastosVentas)}</td>
<td>Publicidad, promociones, mercadeo y campañas comerciales.</td>
</tr>
<tr>
<td>Financieros</td>
<td>${formatoCOPFinanzas(f.gastosFinancieros)}</td>
<td>Intereses, créditos, comisiones bancarias o financiación.</td>
</tr>
<tr>
<td>Logística</td>
<td>${formatoCOPFinanzas(f.gastosLogistica)}</td>
<td>Domicilios, transporte, combustible y distribución.</td>
</tr>
</tbody>
</table>
</div>

<h2>Semáforo Financiero GRUK</h2>

<div class="card">
<h3>${f.semaforo}</h3>
<p><strong>Rentabilidad neta:</strong> ${f.rentabilidad.toFixed(2)}%</p>
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
<td>Utilidad neta</td>
<td>${formatoCOPFinanzas(f.utilidadNeta)}</td>
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
<th>Gastos</th>
<th>Nómina</th>
<th>Utilidad</th>
<th>Rentabilidad</th>
</tr>
</thead>
<tbody>
${
f.historicoFinanciero.length > 0
? f.historicoFinanciero.map(h => `
<tr>
<td>${h.mes}</td>
<td>${formatoCOPFinanzas(h.ingresosTotales)}</td>
<td>${formatoCOPFinanzas(h.costosMateriaPrima)}</td>
<td>${formatoCOPFinanzas((h.gastosAdministracion || 0) + (h.gastosVentas || 0) + (h.gastosLogistica || 0) + (h.gastosFinancieros || 0))}</td>
<td>${formatoCOPFinanzas(h.gastoNomina)}</td>
<td>${formatoCOPFinanzas(h.utilidadNeta)}</td>
<td>${Number(h.rentabilidad || 0).toFixed(2)}%</td>
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

window.calcularFinanzasGRUK = calcularFinanzasGRUK;
window.generarBloqueFinancieroGRUK = generarBloqueFinancieroGRUK;
window.cerrarMesFinanciero = cerrarMesFinanciero;
window.calcularPrecioVentaGRUK = calcularPrecioVentaGRUK;