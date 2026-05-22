const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({
  restaurantId: { type: String, required: true, unique: true },
  usuario: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

module.exports = mongoose.model("Admin", adminSchema);
const paramsLogo = new URLSearchParams(window.location.search);
const restaurantIdLogo = paramsLogo.get("restaurantId");

async function cargarLogoRestaurante() {
  if (!restaurantIdLogo) return;

  const res = await fetch(`/api/restaurants/${restaurantIdLogo}`);
  const data = await res.json();

  if (data.ok && data.restaurante.logoUrl) {
    const logo = document.getElementById("logoRestaurante");

    if (logo) {
      logo.src = data.restaurante.logoUrl;
    }

    document.body.style.setProperty(
      "--fondo-restaurante",
      `url(${data.restaurante.logoUrl})`
    );
  }
}

cargarLogoRestaurante();
function calcularPrecioInteligente() {

const producto =
document.getElementById("productoPrecio").value;

const materiaPrima =
Number(
document.getElementById("costoMateriaPrima").value
);

const costoOperativo =
Number(
document.getElementById("costoOperativo").value
);

const tiempo =
Number(
document.getElementById("tiempoPreparacion").value
);

const tipo =
document.getElementById("tipoProductoPrecio").value;

const demanda =
document.getElementById("demandaProducto").value;

if (
!producto ||
!materiaPrima ||
!costoOperativo ||
!tiempo
) {
alert("Completa todos los campos");
return;
}

const costoTotal =
materiaPrima + costoOperativo;

let margenMinimo = 0.25;
let margenRecomendado = 0.45;
let margenPremium = 0.65;

if (tipo === "ancla") {
margenMinimo = 0.18;
margenRecomendado = 0.30;
margenPremium = 0.38;
}

if (tipo === "estrella") {
margenMinimo = 0.35;
margenRecomendado = 0.52;
margenPremium = 0.70;
}

if (tipo === "diamante") {
margenMinimo = 0.45;
margenRecomendado = 0.68;
margenPremium = 0.95;
}

if (demanda === "alta") {
margenRecomendado += 0.05;
margenPremium += 0.08;
}

if (demanda === "baja") {
margenRecomendado -= 0.08;
margenPremium -= 0.10;
}

const precioMinimo =
Math.round(
costoTotal / (1 - margenMinimo)
);

const precioRecomendado =
Math.round(
costoTotal / (1 - margenRecomendado)
);

const precioPremium =
Math.round(
costoTotal / (1 - margenPremium)
);

let lectura = "";
let recomendacion = "";
let riesgo = "";

if (tipo === "ancla") {

lectura =
`
${producto} tiene perfil de circulación comercial.
Su función principal es atraer flujo de clientes
y aumentar frecuencia de compra.
`;

recomendacion =
`
No competir por lujo.
El objetivo debe ser velocidad,
rotación y recompra.
`;

riesgo =
`
Subir demasiado el precio podría reducir tráfico.
`;

}

if (tipo === "estrella") {

lectura =
`
${producto} tiene perfil de acumulación rentable.
Cada venta fortalece significativamente
la caja operativa del restaurante.
`;

recomendacion =
`
Debe ocupar posiciones principales
del menú y combinarse
con productos ancla.
`;

riesgo =
`
Descuentos agresivos pueden destruir margen.
`;

}

if (tipo === "diamante") {

lectura =
`
${producto} tiene perfil premium.
No necesita venderse masivamente;
su función es elevar ticket promedio
y percepción de valor.
`;

recomendacion =
`
Utilizar fotografías premium,
nombres fuertes
y presentación visual dominante.
`;

riesgo =
`
Bajar demasiado el precio
destruye percepción de exclusividad.
`;

}

document.getElementById(
"resultadoPrecioInteligente"
).innerHTML = `

<div class="card">

<h3>
Diagnóstico estratégico de precio
</h3>

<p>
<strong>Producto:</strong>
${producto}
</p>

<p>
<strong>Costo total estimado:</strong>
$${costoTotal.toLocaleString("es-CO")}
</p>

<p>
<strong>Precio mínimo sostenible:</strong>
$${precioMinimo.toLocaleString("es-CO")}
</p>

<p>
<strong>Precio rentable recomendado:</strong>
$${precioRecomendado.toLocaleString("es-CO")}
</p>

<p>
<strong>Precio premium estratégico:</strong>
$${precioPremium.toLocaleString("es-CO")}
</p>

<p>
<strong>Lectura económica:</strong><br>
${lectura}
</p>

<p>
<strong>Recomendación estratégica:</strong><br>
${recomendacion}
</p>

<p>
<strong>Control de riesgo:</strong><br>
${riesgo}
</p>

<p>
<strong>Margen proyectado:</strong><br>

Mínimo:
${Math.round(margenMinimo * 100)}%

<br>

Recomendado:
${Math.round(margenRecomendado * 100)}%

<br>

Premium:
${Math.round(margenPremium * 100)}%

</p>

<p>
<strong>Interpretación GRUK:</strong><br>

${
demanda === "alta"

?

`El mercado ya muestra validación suficiente para soportar precios más altos sin destruir demanda.`

:

demanda === "media"

?

`El producto debe crecer de forma gradual manteniendo equilibrio entre margen y aceptación.`

:

`El producto todavía necesita validación comercial antes de aumentar agresivamente el precio.`
}

</p>

</div>
`;

}