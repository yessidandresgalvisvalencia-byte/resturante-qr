let datosManualDashboard = [];

function getRestaurantIdManual() {
  const input = document.getElementById("restaurantIdInput");
  return input ? input.value || "rest1" : getRestaurantId();
}

function guardarDatosDashboard() {
  guardarDatosManualDashboard();
}

function agregarDatoManualDashboard() {
  const producto = document.getElementById("productoManual")?.value.trim();
  const cantidad = Number(document.getElementById("cantidadManual")?.value);
  const precio = Number(document.getElementById("precioManual")?.value);

  if (!producto || cantidad <= 0 || precio <= 0) {
    alert("Completa producto, cantidad y precio correctamente.");
    return;
  }

  datosManualDashboard.push({
    producto,
    ventas: cantidad,
    totalDinero: cantidad * precio,
    precioUnitario: precio
  });

  document.getElementById("productoManual").value = "";
  document.getElementById("cantidadManual").value = "";
  document.getElementById("precioManual").value = "";

  pintarDatosManualDashboard();
}

function pintarDatosManualDashboard() {
  const lista = document.getElementById("listaDatosManual");
  if (!lista) return;

  if (!datosManualDashboard.length) {
    lista.innerHTML = "<p>No hay datos manuales agregados.</p>";
    return;
  }

  lista.innerHTML = datosManualDashboard.map((item, index) => `
    <div class="card">
      <strong>${item.producto}</strong>
      <p>Cantidad: ${item.ventas}</p>
      <p>Precio unitario: $${item.precioUnitario.toLocaleString("es-CO")}</p>
      <p>Total: $${item.totalDinero.toLocaleString("es-CO")}</p>
      <button onclick="eliminarDatoManualDashboard(${index})">Eliminar</button>
    </div>
  `).join("");
}

function eliminarDatoManualDashboard(index) {
  datosManualDashboard.splice(index, 1);
  pintarDatosManualDashboard();
}

function guardarDatosManualDashboard() {
  const restaurantId = getRestaurantIdManual();

  if (!datosManualDashboard.length) {
    alert("Primero agrega al menos un producto.");
    return;
  }

  localStorage.setItem(
    `dashboard_manual_${restaurantId}`,
    JSON.stringify(datosManualDashboard)
  );

  alert("Datos manuales guardados para el dashboard.");
}

function limpiarDatosManualDashboard() {
  const restaurantId = getRestaurantIdManual();

  datosManualDashboard = [];
  localStorage.removeItem(`dashboard_manual_${restaurantId}`);

  pintarDatosManualDashboard();

  alert("Datos manuales eliminados.");
}

function inicializarReportesGRUK() {
  const restaurantId = getRestaurantIdManual();

  datosManualDashboard =
    JSON.parse(localStorage.getItem(`dashboard_manual_${restaurantId}`)) || [];

  pintarDatosManualDashboard();
}
async function generarReporteEjecutivo() {
  const restaurantId =
    new URLSearchParams(window.location.search).get("restaurantId") ||
    localStorage.getItem("adminRestaurantId") ||
    "rest1";

  console.log("REPORTE restaurantId:", restaurantId);

  const periodo =
    document.getElementById("periodoReporte")?.value || "mensual";

  const totalVendido =
    document.getElementById("totalVendido")?.innerText || "$0";

  const pedidosActivos =
    document.getElementById("pedidosActivos")?.innerText || "0";

  const fecha =
    new Date().toLocaleDateString("es-CO");

  const estrategias =
    JSON.parse(localStorage.getItem(`estrategias_${restaurantId}`)) || [];

  const gastos =
    JSON.parse(localStorage.getItem(`gastos_${restaurantId}`)) || [];

  const totalGastos =
    gastos.reduce((acc, g) => acc + Number(g.valor || 0), 0);
   function normalizarCategoriaGasto(g) {
  const categoria =
    String(g.categoria || "").toLowerCase();

  const nombre =
    String(g.nombre || "").toLowerCase();

  if (
    categoria.includes("publicidad") ||
    nombre.includes("publicidad") ||
    nombre.includes("marketing") ||
    nombre.includes("campaña") ||
    nombre.includes("promocion")
  ) {
    return "Ventas";
  }

  if (
    categoria.includes("domicilio") ||
    categoria.includes("logística") ||
    categoria.includes("logistica") ||
    nombre.includes("domicilio") ||
    nombre.includes("domiciliario") ||
    nombre.includes("transporte")
  ) {
    return "Logística";
  }

  if (
    categoria.includes("financiero") ||
    nombre.includes("interes") ||
    nombre.includes("crédito") ||
    nombre.includes("credito") ||
    nombre.includes("banco")
  ) {
    return "Financieros";
  }

  if (
    categoria.includes("insumo") ||
    categoria.includes("producción") ||
    categoria.includes("produccion") ||
    categoria.includes("servicio") ||
    nombre.includes("materia prima") ||
    nombre.includes("insumo")
  ) {
    return "Producción";
  }

  if (
    categoria.includes("personal") ||
    categoria.includes("administración") ||
    categoria.includes("administracion") ||
    nombre.includes("contador") ||
    nombre.includes("gerente") ||
    nombre.includes("papelería") ||
    nombre.includes("papeleria")
  ) {
    return "Administración";
  }

  return "Otro";
}

const gastosAdministracion =
  gastos
    .filter(g => normalizarCategoriaGasto(g) === "Administración")
    .reduce((acc, g) => acc + Number(g.valor || 0), 0);

const gastosVentas =
  gastos
    .filter(g => normalizarCategoriaGasto(g) === "Ventas")
    .reduce((acc, g) => acc + Number(g.valor || 0), 0);

const gastosFinancieros =
  gastos
    .filter(g => normalizarCategoriaGasto(g) === "Financieros")
    .reduce((acc, g) => acc + Number(g.valor || 0), 0);

const gastosProduccion =
  gastos
    .filter(g => normalizarCategoriaGasto(g) === "Producción")
    .reduce((acc, g) => acc + Number(g.valor || 0), 0);

const gastosLogistica =
  gastos
    .filter(g => normalizarCategoriaGasto(g) === "Logística")
    .reduce((acc, g) => acc + Number(g.valor || 0), 0);


  let inventario = [];
  let datosVentas = [];
  let personal = [];
let gastoNomina = 0;
const pagosCaja =
JSON.parse(
localStorage.getItem(
`pagos_caja_${restaurantId}`
)
) || [];
const historicoFinanciero =
  JSON.parse(
    localStorage.getItem(`historicoFinanciero_${restaurantId}`)
  ) || [];
  const variacionesMensuales =
  calcularVariacionesMensualesGRUK(historicoFinanciero);

const ventasManualCaja =
pagosCaja
.filter(p => p.tipoVenta === "manual")
.reduce((acc, p) => {

return acc +
Number(p.total || 0);

}, 0);

const ventasQRCaja =
pagosCaja
.filter(p => p.tipoVenta === "qr")
.reduce((acc, p) => {

return acc +
Number(p.total || 0);

}, 0);
  try {
    const resInventario = await grukFetch(`/api/inventario/${restaurantId}`);
    const dataInventario = await resInventario.json();

    if (dataInventario.ok) {
      inventario = dataInventario.productos || [];
    }
  } catch (error) {
    console.log("No se pudo cargar inventario:", error);
  }

  try {
    let resVentas =
      await fetch(`/estadisticas/pareto?restaurantId=${restaurantId}`);

    if (!resVentas.ok) {
      resVentas =
        await fetch(`/estadisticas/pareto?restaurant=${restaurantId}`);
    }

    if (resVentas.ok) {
      datosVentas = await resVentas.json();
    } else {
      datosVentas = [];
    }

  } catch (error) {
    console.log("No se pudo cargar ventas:", error);
    datosVentas = [];
  }
  try {

  const resPersonal =
    await fetch(
      `/api/personal?restaurantId=${restaurantId}`
    );

  if (resPersonal.ok) {

    personal =
      await resPersonal.json();

    gastoNomina =
      personal.reduce((acc, p) => {

        return acc +
        Number(p.salario || 0);

      }, 0);

  }

} catch(error) {

  console.log(
    "No se pudo cargar personal:",
    error
  );

}

  const ventasOrdenadas =
  datosVentas
    .map(p => ({
      producto: p.producto || "Producto sin nombre",

      categoria: p.categoria || "",

      precioUnitarioActual:
        Number(p.precioUnitarioActual || 0),

      costoMateriaPrimaUnitario:
        Number(p.costoMateriaPrimaUnitario || 0),

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
)
    .sort((a, b) => b.ventas - a.ventas);
  const productoMasVendido =
    ventasOrdenadas[0] || null;

  const totalPedidosReporte =
    ventasOrdenadas.reduce((acc, p) => acc + p.ventas, 0);

  const totalDineroReporte =
  ventasOrdenadas.reduce(
    (acc, p) => acc + p.totalDinero,
    0
  );

const costosMateriaPrima =
  ventasOrdenadas.reduce(
    (acc, p) =>
      acc + Number(p.costoMateriaPrimaTotal || 0),
    0
  );


const ingresosTotales =
  totalDineroReporte +
  ventasManualCaja;

const utilidadBruta =
  ingresosTotales -
  costosMateriaPrima;

const ventasBrutas =
  ingresosTotales;

const descuentosVentas =
  0;

const devolucionesVentas =
  0;

const ventasNetas =
  ventasBrutas -
  descuentosVentas -
  devolucionesVentas;

const costoProduccionVentas =
  costosMateriaPrima;
  
const gastosAdministracionResultado =
  gastosAdministracion || 0;

const gastosVentasResultado =
  gastosVentas || 0;

const gastosLogisticaResultado =
  gastosLogistica || 0;

const gastosProduccionResultado =
  gastosProduccion || 0;

const otrosIngresos =
  0;

const otrosEgresos =
  gastosFinancieros || 0;

const utilidadOperacional =
  utilidadBruta -
  gastosAdministracionResultado -
  gastosVentasResultado -
  gastosLogisticaResultado -
  gastosProduccionResultado -
  gastoNomina;

const utilidadAntesImpuestos =
  utilidadOperacional +
  otrosIngresos -
  otrosEgresos;

const utilidadNeta =
  utilidadAntesImpuestos;

const porcentajeGastos =
  ingresosTotales > 0
    ? (totalGastos / ingresosTotales) * 100
    : 0;

const porcentajeNomina =
  ingresosTotales > 0
    ? (gastoNomina / ingresosTotales) * 100
    : 0;

const porcentajeUtilidad =
  ingresosTotales > 0
    ? (utilidadNeta / ingresosTotales) * 100
    : 0;
    const rentabilidad =
  ingresosTotales > 0
    ? (utilidadNeta / ingresosTotales) * 100
    : 0;

let colorFinanciero = "";
let mensajeFinanciero = "";

if (utilidadNeta < 0) {
  colorFinanciero = "🔴 Rojo — Riesgo financiero";

  mensajeFinanciero =
    "GRUK detecta que la operación está consumiendo más recursos de los que genera. Se recomienda revisar gastos, nómina, precios, desperdicio y productos de baja rentabilidad.";

} else if (rentabilidad < 10) {
  colorFinanciero = "🟡 Amarillo — Rentabilidad baja";

  mensajeFinanciero =
    "El restaurante genera utilidad, pero el margen es bajo. GRUK recomienda fortalecer productos de mayor margen, controlar gastos y revisar precios.";

} else {
  colorFinanciero = "🟢 Verde — Rentabilidad saludable";

  mensajeFinanciero =
    "El restaurante presenta una rentabilidad positiva y saludable. GRUK recomienda mantener control de costos, inventario y gastos para sostener el resultado.";
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
  const ticketPromedio =
    totalPedidosReporte > 0
      ? totalDineroReporte / totalPedidosReporte
      : 0;

  const productosTop =
    ventasOrdenadas.slice(0, 5);

  const productosBajaRotacion =
    ventasOrdenadas.filter(p => p.ventas <= 2);

  const inventarioRiesgo =
    inventario.filter(p =>
      p.estado === "proximo" ||
      p.estado === "vencido"
    );

  const inventarioOrdenado =
    inventario
      .slice()
      .sort((a, b) => Number(a.diasRestantes || 0) - Number(b.diasRestantes || 0))
      .slice(0, 8);

  const labelsTop =
    productosTop.map(p => p.producto);

  const dataTopVentas =
    productosTop.map(p => p.ventas);

  const dataTopDinero =
    productosTop.map(p => p.totalDinero);

  const labelsInventario =
    inventarioOrdenado.map(p => p.nombre);

  const dataInventarioDias =
    inventarioOrdenado.map(p => Number(p.diasRestantes || 0));

  const productoMasVendidoTexto =
    productoMasVendido
      ? `${productoMasVendido.producto} con ${productoMasVendido.ventas} pedidos`
      : "No hay producto líder registrado";

  const participacionTop =
    productoMasVendido && totalPedidosReporte > 0
      ? ((productoMasVendido.ventas / totalPedidosReporte) * 100).toFixed(1)
      : 0;

  const diagnosticoVentas =
    productoMasVendido
      ? `El producto más vendido fue ${productoMasVendido.producto}, concentrando aproximadamente el ${participacionTop}% de los pedidos. Si esta concentración continúa, el restaurante debe evitar depender de un solo producto y convertir esa demanda en venta cruzada hacia platos de mayor margen.`
      : "No hay suficientes datos para diagnosticar el comportamiento de ventas.";

  const diagnosticoInventario =
    inventarioRiesgo.length > 0
      ? `El inventario presenta ${inventarioRiesgo.length} producto(s) vencidos o próximos a vencer. Si esta situación continúa, el restaurante puede perder capital por desperdicio y afectar su margen operativo. Se recomienda aplicar FEFO: primero en vencer, primero en usarse.`
      : "El inventario no muestra alertas críticas de vencimiento. Esto indica una operación más controlada y menor riesgo de desperdicio.";

  const diagnosticoGraham =
    `Desde una lógica de largo plazo, GRUK recomienda no tomar decisiones solo por volumen de ventas. El restaurante debe proteger su margen de seguridad: vender más solo es sano si aumenta caja real, controla inventario, administra gastos y evita productos que roten mucho pero dejen poca utilidad.`;
const finanzasGRUK =
  await calcularFinanzasGRUK(restaurantId);

const bloqueFinancieroGRUK =
  generarBloqueFinancieroGRUK(finanzasGRUK);
  const reporte = `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte Ejecutivo GRUK</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<style>
body{
font-family:Arial, sans-serif;
padding:40px;
color:#111827;
line-height:1.6;
}

h1{
font-size:32px;
margin-bottom:5px;
}

h2{
margin-top:35px;
border-bottom:2px solid #111827;
padding-bottom:6px;
}

.card{
border:1px solid #ddd;
border-radius:12px;
padding:18px;
margin:14px 0;
page-break-inside:avoid;
}

.alerta{
background:#fff7ed;
border-left:6px solid #f97316;
}

.peligro{
background:#fef2f2;
border-left:6px solid #dc2626;
}

.exito{
background:#f0fdf4;
border-left:6px solid #16a34a;
}

.grafica{
height:360px;
margin:20px 0;
}

table{
width:100%;
border-collapse:collapse;
margin-top:12px;
}

th,td{
border:1px solid #ddd;
padding:10px;
text-align:left;
}

th{
background:#111827;
color:white;
}

@media print{
button{
display:none;
}
}
</style>
</head>

<body>

<h1>Reporte Ejecutivo GRUK</h1>
<p><strong>Restaurante ID:</strong> ${restaurantId}</p>
<p><strong>Periodo seleccionado:</strong> ${periodo}</p>
<p><strong>Fecha de generación:</strong> ${fecha}</p>

<h2>1. Resumen general</h2>

<div class="card exito">

<p><strong>Total vendido visible en panel:</strong> ${totalVendido}</p>

<p>
<strong>Total calculado por pedidos QR:</strong>
$${totalDineroReporte.toLocaleString("es-CO")}
</p>

<p>
<strong>Ventas manuales registradas en caja:</strong>
$${ventasManualCaja.toLocaleString("es-CO")}
</p>

<p>
<strong>Pedidos QR registrados desde caja:</strong>
$${ventasQRCaja.toLocaleString("es-CO")}
</p>

<p>
<strong>Total ingresos reales:</strong>
$${(
totalDineroReporte +
ventasManualCaja
).toLocaleString("es-CO")}
</p>

<p>
<strong>Diferencia detectada:</strong>
$${(
Number(String(totalVendido).replace(/[^0-9]/g, "")) -
(totalDineroReporte + ventasManualCaja)
).toLocaleString("es-CO")}
</p>

<p>
<small>
GRUK separa los ingresos entre pedidos QR y ventas manuales registradas desde caja. Si la diferencia no es cero, puede corresponder a impuestos, propinas, domicilios, pedidos anulados o registros aún no clasificados.
</small>
</p>


<p>
<strong>Total gastos registrados:</strong>
$${totalGastos.toLocaleString("es-CO")}
</p>

<p>
<strong>Nómina mensual:</strong>
$${gastoNomina.toLocaleString("es-CO")}
</p>

<p>
<strong>Gastos + Nómina:</strong>
$${(totalGastos + gastoNomina).toLocaleString("es-CO")}
</p>

<p>
<strong>Costos estimados de materia prima:</strong>
$${costosMateriaPrima.toLocaleString("es-CO")}
</p>

<p>
<strong>Utilidad operacional antes de impuestos:</strong>
$${finanzasGRUK.utilidadOperacional.toLocaleString("es-CO")}
</p>

<p><strong>Total pedidos:</strong> ${totalPedidosReporte}</p>
<p><strong>Pedidos activos:</strong> ${pedidosActivos}</p>
<p><strong>Ticket promedio estimado:</strong> $${Math.round(ticketPromedio).toLocaleString("es-CO")}</p>
<p><strong>Producto más vendido:</strong> ${productoMasVendidoTexto}</p>

<p>
<strong>Interpretación financiera GRUK:</strong><br>

${
finanzasGRUK.utilidadOperacional > 0

? `El restaurante mantiene una utilidad neta positiva estimada. Si el mercado continúa estable y los gastos permanecen controlados, la operación puede fortalecerse y aumentar caja real.`

: `La utilidad operacional antes de impuestos es negativa. Aunque el restaurante pueda vender bastante, actualmente los gastos y costos están consumiendo más dinero del que entra. GRUK recomienda revisar precios, desperdicio, gastos innecesarios, nómina, gastos fijos y productos de baja rentabilidad.`
}
</p>

</div>

<h2>2. Gráfica de productos más vendidos</h2>

<div class="card">
<div class="grafica">
<canvas id="graficaTopProductos"></canvas>
</div>

<p><strong>Lectura GRUK:</strong><br>
${diagnosticoVentas}
</p>

<p>
Si el mercado mantiene esta reacción, GRUK recomienda usar el producto líder como entrada comercial, pero no permitir que absorba toda la estrategia. La demanda debe convertirse en combos, productos complementarios y platos con mayor margen.
</p>
</div>

<h2>3. Gráfica de ingresos por producto</h2>

<div class="card">
<div class="grafica">
<canvas id="graficaIngresosProductos"></canvas>
</div>

<p><strong>Lectura GRUK:</strong><br>
Esta gráfica permite comparar si los productos más vendidos son también los que más dinero generan. Si un producto vende mucho pero genera poco ingreso, funciona como producto de tráfico; si vende menos pero genera más dinero, puede ser un producto de acumulación rentable.
</p>

<p>
La estrategia de largo plazo debe proteger los productos que fortalecen caja, no solo los que generan volumen. Esto responde al margen de seguridad: crecer sin utilidad real puede debilitar el negocio aunque las ventas aparenten subir.
</p>
</div>

<h2>4. Gráfica de inventario y vencimientos</h2>

<div class="card">
<div class="grafica">
<canvas id="graficaInventario"></canvas>
</div>

<p><strong>Lectura GRUK:</strong><br>
${diagnosticoInventario}
</p>

<p>
Si los productos próximos a vencer aumentan, el restaurante está inmovilizando capital en inventario que no rota. A largo plazo, eso reduce liquidez y puede convertir ventas aparentemente sanas en pérdidas ocultas.
</p>
</div>

<h2>5. Tabla de productos más vendidos</h2>

<table>
<thead>
<tr>
<th>Producto</th>
<th>Categoría</th>
<th>Precio unitario actual</th>
<th>Cantidad vendida</th>
<th>Total calculado</th>
</tr>
</thead>

<tbody>
${
productosTop.length > 0
? productosTop.map(p => `
<tr>
<td>${p.producto}</td>
<td>${p.categoria}</td>
<td>$${p.precioUnitarioActual.toLocaleString("es-CO")}</td>
<td>${p.ventas}</td>
<td>$${p.totalDinero.toLocaleString("es-CO")}</td>
</tr>
`).join("")
: `
<tr>
<td colspan="5">
No hay datos disponibles.
</td>
</tr>
`
}
</tbody>
</table>

<h2>6. Productos de baja rotación</h2>

${
productosBajaRotacion.length > 0
? `
<div class="card alerta">
<ul>
${productosBajaRotacion.map(p => `
<li><strong>${p.producto}</strong>: ${p.ventas} venta(s)</li>
`).join("")}
</ul>
<p>
GRUK recomienda revisar foto, precio, descripción, ubicación y posible venta cruzada. Si después de una prueba no mejora, puede estar ocupando espacio visual y capital sin retorno.
</p>
</div>
`
: `
<div class="card exito">
<p>No se detectan productos críticos de baja rotación.</p>
</div>
`
}

<h2>7. Inventario en riesgo</h2>

${
inventarioRiesgo.length > 0
? `
<div class="card peligro">
<ul>
${inventarioRiesgo.map(p => `
<li>
<strong>${p.nombre}</strong> — ${p.categoria} —
${p.estado === "vencido" ? "Vencido" : "Próximo a vencer"} —
Días restantes: ${p.diasRestantes}
</li>
`).join("")}
</ul>
<p>
Prioridad: usar primero los productos próximos a vencer. Los vencidos deben retirarse o revisarse antes de uso.
</p>
</div>
`
: `
<div class="card exito">
<p>No hay inventario crítico por vencimiento.</p>
</div>
`
}

<h2>8. Estrategias aplicadas</h2>

${
estrategias.length > 0
? `
<table>
<thead>
<tr>
<th>N°</th>
<th>Estrategia</th>
<th>Productos</th>
<th>Fecha</th>
</tr>
</thead>
<tbody>
${estrategias.map(e => `
<tr>
<td>${e.numero}</td>
<td>${e.titulo}</td>
<td>${(e.productos || []).join(", ")}</td>
<td>${e.fecha ? new Date(e.fecha).toLocaleDateString("es-CO") : ""}</td>
</tr>
`).join("")}
</tbody>
</table>
`
: `
<div class="card alerta">
<p>No hay estrategias aplicadas registradas.</p>
</div>
`
}

<h2>9. Control de gasto</h2>

${
gastos.length > 0
? `
<table>
<thead>
<tr>
<th>Gasto</th>
<th>Categoría</th>
<th>Valor</th>
<th>Objetivo</th>
<th>Impacto</th>
<th>Fecha</th>
</tr>
</thead>

<tbody>
${gastos.map(g => `
<tr>
<td>${g.nombre}</td>
<td>${g.categoria}</td>
<td>$${Number(g.valor || 0).toLocaleString("es-CO")}</td>
<td>${g.objetivo}</td>
<td>${g.impacto}</td>
<td>${g.fecha ? new Date(g.fecha).toLocaleDateString("es-CO") : ""}</td>
</tr>
`).join("")}
</tbody>
</table>

<div class="card alerta">
<p><strong>Total gastos registrados:</strong> $${totalGastos.toLocaleString("es-CO")}</p>
<p><strong>Total nómina:</strong> $${gastoNomina.toLocaleString("es-CO")}</p>
<p><strong>Estructura global de gastos:</strong> $${(totalGastos + gastoNomina).toLocaleString("es-CO")}</p>

<p>
GRUK recomienda revisar si estos gastos están generando retorno real, protegiendo operación o solo consumiendo caja sin producir valor.
</p>
</div>
`
: `
<div class="card alerta">
<p>No hay gastos registrados en control de gasto.</p>
<p><strong>Total nómina:</strong> $${gastoNomina.toLocaleString("es-CO")}</p>
<p><strong>Estructura global de gastos:</strong> $${gastoNomina.toLocaleString("es-CO")}</p>
</div>
`
}

${bloqueFinancieroGRUK}

<h2>13. Estrategia de largo plazo GRUK</h2>

<div class="card">
<p>
${diagnosticoGraham}
</p>

<p>
Si el restaurante continúa como está, debe observar cuatro señales: dependencia excesiva de un producto, acumulación de inventario próximo a vencer, diferencia entre productos que venden mucho y productos que realmente generan caja, y gastos que consumen dinero sin retorno medible.
</p>

<p>
La estrategia recomendada es construir un portafolio balanceado: productos ancla para atraer tráfico, productos estrella para fortalecer caja, productos premium para aumentar ticket, control estricto del inventario para evitar capital muerto y control de gastos para proteger el margen de seguridad.
</p>
</div>

<script>
const labelsTop = ${JSON.stringify(labelsTop)};
const dataTopVentas = ${JSON.stringify(dataTopVentas)};
const dataTopDinero = ${JSON.stringify(dataTopDinero)};
const labelsInventario = ${JSON.stringify(labelsInventario)};
const dataInventarioDias = ${JSON.stringify(dataInventarioDias)};

new Chart(document.getElementById("graficaTopProductos"), {
  type: "bar",
  data: {
    labels: labelsTop,
    datasets: [{
      label: "Cantidad vendida",
      data: dataTopVentas
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false
  }
});

new Chart(document.getElementById("graficaIngresosProductos"), {
  type: "bar",
  data: {
    labels: labelsTop,
    datasets: [{
      label: "Ingresos generados",
      data: dataTopDinero
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false
  }
});

new Chart(document.getElementById("graficaInventario"), {
  type: "bar",
  data: {
    labels: labelsInventario,
    datasets: [{
      label: "Días restantes para vencer",
      data: dataInventarioDias
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false
  }
});

setTimeout(() => {
  window.print();
}, 900);
</script>

</body>
</html>
`;

  const ventana = window.open("", "_blank");

  ventana.document.open();
  ventana.document.write(reporte);
  ventana.document.close();
}

window.generarReporteEjecutivo = generarReporteEjecutivo;
