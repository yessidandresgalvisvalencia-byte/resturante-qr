const paramsCaja = new URLSearchParams(window.location.search);

const restaurantIdCaja =
paramsCaja.get("restaurantId") ||
localStorage.getItem("adminRestaurantId") ||
"rest1";

let ultimoPagoCaja = null;

function formatoCOPCaja(valor) {
return "$" + Math.round(Number(valor || 0)).toLocaleString("es-CO");
}

function calcularCaja() {
const total = Number(document.getElementById("totalCaja").value || 0);
const recibido = Number(document.getElementById("dineroRecibidoCaja").value || 0);
const metodo = document.getElementById("metodoPagoCaja").value;

let cambio = 0;

if (metodo === "Efectivo") {
cambio = recibido - total;

if (recibido < total) {
alert("El dinero recibido es menor al total a pagar");
return;
}
}

document.getElementById("resultadoCaja").innerHTML = `
<div class="card">
<h3>Resultado de caja</h3>

<p><strong>Total a pagar:</strong> ${formatoCOPCaja(total)}</p>
<p><strong>Método de pago:</strong> ${metodo}</p>

${
metodo === "Efectivo"
? `
<p><strong>Dinero recibido:</strong> ${formatoCOPCaja(recibido)}</p>
<p><strong>Cambio / devuelta:</strong> ${formatoCOPCaja(cambio)}</p>
`
: `
<p><strong>Pago registrado:</strong> No requiere cálculo de cambio.</p>
`
}
</div>
`;
}

function guardarPagoCaja() {
  const cliente = document.getElementById("clienteCaja").value.trim();
  const descripcion = document.getElementById("descripcionCaja").value.trim();
  const total = Number(document.getElementById("totalCaja").value || 0);
  const metodo = document.getElementById("metodoPagoCaja").value;
  const tipoVenta = document.getElementById("tipoVentaCaja").value;
  const recibido = Number(document.getElementById("dineroRecibidoCaja").value || 0);

  if (!cliente || !descripcion || !total) {
    alert("Completa cliente/mesa, descripción y total");
    return;
  }

  let cambio = 0;

  if (metodo === "Efectivo") {
    if (recibido < total) {
      alert("El dinero recibido es menor al total");
      return;
    }
    cambio = recibido - total;
  }

  const pago = {
    id: Date.now(),
    numeroInternoGruk: Date.now(),
    restaurantId: restaurantIdCaja,

    tipoVenta,

    cliente,
    descripcion,

    total,
    metodo,
    recibido,
    cambio,

    facturaElectronica: {
      enviadaDIAN: false,
      estado: "pendiente",
      numeroDIAN: null,
      cufe: null,
      pdfUrl: null,
      xmlUrl: null,
      mensaje: "Factura interna GRUK. Pendiente de validación DIAN."
    },

    fecha: new Date().toISOString()
  };

  const pagos =
    JSON.parse(localStorage.getItem(`pagos_caja_${restaurantIdCaja}`)) || [];

  pagos.push(pago);

  localStorage.setItem(
    `pagos_caja_${restaurantIdCaja}`,
    JSON.stringify(pagos)
  );

  ultimoPagoCaja = pago;
  facturarPagoCaja(pago);

  alert("Pago guardado correctamente");

  cargarHistorialCaja();
}
async function facturarPagoCaja(pago) {
  try {
    const res = await fetch("/api/facturacion/caja", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pago),
    });

    const data = await res.json();

    console.log("Respuesta facturación:", data);

    if (data.ok && data.factura) {
      pago.facturaElectronica.estado = data.factura.estado || "simulada";
      pago.facturaElectronica.mensaje = data.factura.mensaje || "";
      pago.facturaElectronica.numeroDIAN = data.factura.reference_code || null;

      const pagos =
        JSON.parse(localStorage.getItem(`pagos_caja_${restaurantIdCaja}`)) || [];

      const pagosActualizados = pagos.map((p) =>
        p.id === pago.id ? pago : p
      );

      localStorage.setItem(
        `pagos_caja_${restaurantIdCaja}`,
        JSON.stringify(pagosActualizados)
      );

      ultimoPagoCaja = pago;
    }
  } catch (error) {
    console.error("Error enviando factura a backend:", error);
  }
}
function cargarHistorialCaja() {
const pagos =
JSON.parse(localStorage.getItem(`pagos_caja_${restaurantIdCaja}`)) || [];

const contenedor =
document.getElementById("historialCaja");

contenedor.innerHTML = "";

pagos
.slice()
.reverse()
.forEach(pago => {
contenedor.innerHTML += `
<div class="card">
<h3>${pago.cliente}</h3>
<p><strong>Total:</strong> ${formatoCOPCaja(pago.total)}</p>
<p><strong>Método:</strong> ${pago.metodo}</p>
<p>
<strong>Origen:</strong>
${
pago.tipoVenta === "manual"
? "💵 Venta manual"
: "📲 Pedido QR"
}
</p>
<p><strong>Recibido:</strong> ${formatoCOPCaja(pago.recibido)}</p>
<p><strong>Cambio:</strong> ${formatoCOPCaja(pago.cambio)}</p>
<p><strong>Fecha:</strong> ${new Date(pago.fecha).toLocaleString("es-CO")}</p>
<p><strong>Pedido:</strong><br>${pago.descripcion}</p>
</div>
`;
});
}

function imprimirFacturaCaja() {
  if (!ultimoPagoCaja) {
    const pagos =
      JSON.parse(localStorage.getItem(`pagos_caja_${restaurantIdCaja}`)) || [];

    ultimoPagoCaja = pagos[pagos.length - 1];
  }

  if (!ultimoPagoCaja) {
    alert("Primero guarda un pago");
    return;
  }

  const pago = ultimoPagoCaja;

  const factura = `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Factura interna GRUK</title>

<style>
body{
font-family:Arial, sans-serif;
padding:30px;
color:#111;
}

.factura{
max-width:380px;
margin:auto;
border:1px solid #ddd;
padding:20px;
border-radius:12px;
}

h1,h2{
text-align:center;
margin:6px 0;
}

hr{
border:none;
border-top:1px dashed #999;
margin:14px 0;
}

p{
font-size:14px;
margin:6px 0;
}

.total{
font-size:20px;
font-weight:bold;
}

.estado-dian{
background:#f3f3f3;
padding:8px;
border-radius:8px;
margin:10px 0;
}
</style>
</head>

<body>

<div class="factura">
<h1>GRUK</h1>
<h2>Factura interna de venta</h2>

<hr>

<p><strong>Restaurante ID:</strong> ${pago.restaurantId}</p>
<p><strong>Cliente / Mesa:</strong> ${pago.cliente}</p>
<p><strong>Fecha:</strong> ${new Date(pago.fecha).toLocaleString("es-CO")}</p>
<p><strong>N° interno GRUK:</strong> ${pago.numeroInternoGruk || pago.id}</p>

<div class="estado-dian">
<p><strong>Estado DIAN:</strong> ${pago.facturaElectronica?.estado || "pendiente"}</p>
<p><strong>N° DIAN:</strong> ${pago.facturaElectronica?.numeroDIAN || "Pendiente"}</p>
<p><strong>CUFE:</strong> ${pago.facturaElectronica?.cufe || "Pendiente"}</p>
</div>

<hr>

<p><strong>Pedido:</strong></p>
<p>${pago.descripcion}</p>

<hr>

<p class="total">Total: ${formatoCOPCaja(pago.total)}</p>
<p><strong>Método:</strong> ${pago.metodo}</p>
<p>
<strong>Origen:</strong>
${
  pago.tipoVenta === "manual"
    ? "💵 Venta manual"
    : "📲 Pedido QR"
}
</p>
<p><strong>Recibido:</strong> ${formatoCOPCaja(pago.recibido)}</p>
<p><strong>Cambio:</strong> ${formatoCOPCaja(pago.cambio)}</p>

<hr>

<p style="text-align:center;">
Gracias por tu compra.
</p>
</div>

<script>
window.print();
</script>

</body>
</html>
`;

  const ventana = window.open("", "_blank");

  ventana.document.open();
  ventana.document.write(factura);
  ventana.document.close();
}

cargarHistorialCaja();