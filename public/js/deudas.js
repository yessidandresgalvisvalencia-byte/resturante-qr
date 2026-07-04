let deudasGRUK = [];

async function inicializarDeudaGRUK() {
  cargarDeudasGRUK();
  mostrarDeudasGRUK();

  const finanzas = await calcularFinanzasGRUK(getRestaurantId());

  const presupuesto =
    Number(finanzas.utilidadNeta || finanzas.utilidadOperacional || finanzas.saldoCaja || 0);

  const input = document.getElementById("deudaPresupuestoGRUK");

  if (input) {
    input.value = formatoCOP(presupuesto);
  }
}

async function calcularDeudaGRUK() {
  const nombre = document.getElementById("deudaNombre").value.trim();
  const valor = Number(document.getElementById("deudaValor").value);
  const tasaMensual = Number(document.getElementById("deudaTasa").value) / 100;
  const meses = Number(document.getElementById("deudaMeses").value);
  const pagoMensual = Number(document.getElementById("deudaPago").value);
  const finanzas = await calcularFinanzasGRUK(getRestaurantId());

const utilidadMensual =
  Number(finanzas.utilidadNeta || finanzas.utilidadOperacional || finanzas.saldoCaja || 0);

  if (!nombre || valor <= 0 || meses <= 0) {
    mostrarToast("Completa los datos principales de la deuda", "error");
    return;
  }

  const valorFuturo = valor * Math.pow(1 + tasaMensual, meses);
  const totalPagado = pagoMensual * meses;
  const intereses = totalPagado - valor;
  const cargaMensual = utilidadMensual > 0 ? (pagoMensual / utilidadMensual) * 100 : 0;

  let riesgo = "Saludable";
  let recomendacion = "La deuda parece manejable para el restaurante.";

  if (cargaMensual > 30) {
    riesgo = "Alto";
    recomendacion = "La cuota compromete demasiado la utilidad mensual. GRUK recomienda negociar una cuota menor o ampliar el plazo.";
  } else if (cargaMensual > 20) {
    riesgo = "Moderado";
    recomendacion = "La deuda puede asumirse, pero debe vigilarse el flujo de caja mensual.";
  }

  const deuda = {
    id: Date.now(),
    nombre,
    valor,
    tasaMensual,
    meses,
    pagoMensual,
    utilidadMensual,
    valorFuturo,
    totalPagado,
    intereses,
    cargaMensual,
    riesgo,
    recomendacion,
    fecha: new Date().toISOString()
  };

  deudasGRUK.push(deuda);
  guardarDeudasGRUK();
  mostrarResultadoDeudaGRUK(deuda);
  mostrarDeudasGRUK();

  mostrarToast("Deuda analizada correctamente", "success");
}

function mostrarResultadoDeudaGRUK(d) {
  const contenedor = document.getElementById("resultadoDeudaGRUK");

  contenedor.innerHTML = `
    <div class="card">
      <h2>🧠 Diagnóstico Financiero GRUK</h2>

      <p><strong>${d.nombre}</strong></p>

      <table>
        <tr><td>Valor solicitado</td><td>${formatoCOP(d.valor)}</td></tr>
        <tr><td>Tasa mensual</td><td>${(d.tasaMensual * 100).toFixed(2)}%</td></tr>
        <tr><td>Plazo</td><td>${d.meses} meses</td></tr>
        <tr><td>Pago mensual</td><td>${formatoCOP(d.pagoMensual)}</td></tr>
        <tr><td>Total pagado</td><td>${formatoCOP(d.totalPagado)}</td></tr>
        <tr><td>Intereses aproximados</td><td>${formatoCOP(d.intereses)}</td></tr>
        <tr><td>Valor futuro estimado</td><td>${formatoCOP(d.valorFuturo)}</td></tr>
        <tr><td>Carga sobre utilidad</td><td>${d.cargaMensual.toFixed(2)}%</td></tr>
        <tr><td>Nivel de riesgo</td><td><strong>${d.riesgo}</strong></td></tr>
      </table>

      <br>

      <p>
        <strong>Recomendación GRUK:</strong><br>
        ${d.recomendacion}
      </p>
    </div>
  `;
}

function mostrarDeudasGRUK() {
  const contenedor = document.getElementById("listaDeudasGRUK");
  if (!contenedor) return;

  if (deudasGRUK.length === 0) {
    contenedor.innerHTML = "<p>No hay simulaciones registradas.</p>";
    return;
  }

  contenedor.innerHTML = deudasGRUK.map(d => `
    <div class="card">
      <h3>${d.nombre}</h3>
      <p><strong>Valor:</strong> ${formatoCOP(d.valor)}</p>
      <p><strong>Pago mensual:</strong> ${formatoCOP(d.pagoMensual)}</p>
      <p><strong>Total pagado:</strong> ${formatoCOP(d.totalPagado)}</p>
      <p><strong>Riesgo:</strong> ${d.riesgo}</p>

      <button onclick="eliminarDeudaGRUK(${d.id})">
        Eliminar
      </button>
    </div>
  `).join("");
}

function eliminarDeudaGRUK(id) {
  deudasGRUK = deudasGRUK.filter(d => d.id !== id);
  guardarDeudasGRUK();
  mostrarDeudasGRUK();
  mostrarToast("Simulación eliminada", "info");
}

function guardarDeudasGRUK() {
  localStorage.setItem("deudasGRUK", JSON.stringify(deudasGRUK));
}

function cargarDeudasGRUK() {
  deudasGRUK = JSON.parse(localStorage.getItem("deudasGRUK")) || [];
}