function recomendarMargenSeguridad() {
  const riesgoInsumos = document.getElementById("riesgoInsumos")?.value || "bajo";
  const riesgoDescuentos = document.getElementById("riesgoDescuentos")?.value || "bajo";
  const riesgoDesperdicio = document.getElementById("riesgoDesperdicio")?.value || "bajo";

  let margen = 0.02;

  if (riesgoInsumos === "medio") margen += 0.01;
  if (riesgoInsumos === "alto") margen += 0.02;

  if (riesgoDescuentos === "medio") margen += 0.01;
  if (riesgoDescuentos === "alto") margen += 0.02;

  if (riesgoDesperdicio === "medio") margen += 0.01;
  if (riesgoDesperdicio === "alto") margen += 0.02;

  margen = Number(margen.toFixed(2));

  const input = document.getElementById("margenSeguridadGeneral");
  if (input) input.value = margen;

  const estado = document.getElementById("estadoConfiguracionFinanciera");
  if (estado) {
    estado.innerHTML = `
      <div class="card">
        <p>Margen de seguridad recomendado por GRUK: <strong>${(margen * 100).toFixed(0)}%</strong></p>
      </div>
    `;
  }
}

function guardarConfiguracionFinanciera() {
  const restaurantId = getRestaurantId();

  const margenSeguridad =
    Number(document.getElementById("margenSeguridadGeneral")?.value || 0.02);

  const config = {
    margenSeguridad,
    fechaActualizacion: new Date().toISOString()
  };

  localStorage.setItem(
    `configFinanciera_${restaurantId}`,
    JSON.stringify(config)
  );

  const estado = document.getElementById("estadoConfiguracionFinanciera");

  if (estado) {
    estado.innerHTML = `
      <div class="card">
        <p>✅ Configuración financiera guardada.</p>
        <p>Margen de seguridad: <strong>${(margenSeguridad * 100).toFixed(2)}%</strong></p>
      </div>
    `;
  }
}

function cargarConfiguracionFinanciera() {
  const restaurantId = getRestaurantId();

  const config =
    JSON.parse(localStorage.getItem(`configFinanciera_${restaurantId}`)) || {
      margenSeguridad: 0.02
    };

  const input = document.getElementById("margenSeguridadGeneral");

  if (input) {
    input.value = config.margenSeguridad;
  }

  const estado = document.getElementById("estadoConfiguracionFinanciera");

  if (estado) {
    estado.innerHTML = `
      <div class="card">
        <p>Configuración actual cargada.</p>
        <p>Margen de seguridad: <strong>${(Number(config.margenSeguridad || 0.02) * 100).toFixed(2)}%</strong></p>
      </div>
    `;
  }
}

function inicializarConfiguracionGRUK() {
  cargarConfiguracionFinanciera();
}
function guardarConfiguracionFinanciera() {

const restaurantId = getRestaurantId();

const margenSeguridad =
Number(
document.getElementById(
"margenSeguridadGeneral"
).value || 0.02
);

let nivelMargen = "";
let explicacionMargen = "";

if (margenSeguridad <= 0.02) {

  nivelMargen = "Protección mínima";

  explicacionMargen =
    "Este margen es bajo. Sirve para negocios con costos estables, poca variación de precios y descuentos muy controlados.";

} else if (margenSeguridad <= 0.10) {

  nivelMargen = "Protección moderada";

  explicacionMargen =
    "Este margen ayuda a proteger el restaurante frente a pequeños errores, desperdicios normales o descuentos ocasionales.";

} else if (margenSeguridad <= 0.20) {

  nivelMargen = "Protección alta";

  explicacionMargen =
    "Este margen es útil cuando el restaurante tiene variación en insumos, promociones frecuentes o riesgo de desperdicio.";

} else {

  nivelMargen = "Protección agresiva";

  explicacionMargen =
    "Este margen exige precios más altos y limita más los descuentos. Es recomendable cuando el negocio quiere proteger fuertemente su caja y evitar vender barato.";

}

localStorage.setItem(
  `configFinanciera_${restaurantId}`,
  JSON.stringify({
    margenSeguridad,
    nivelMargen,
    explicacionMargen
  })
);

const estado =
document.getElementById(
"estadoConfiguracionFinanciera"
);

if (estado) {

  estado.innerHTML = `
  <div class="card">
    <p><strong>Configuración guardada correctamente.</strong></p>

    <p>
      <strong>Nivel detectado:</strong>
      ${nivelMargen}
    </p>

    <p>
      <strong>Explicación GRUK:</strong><br>
      ${explicacionMargen}
    </p>
  </div>
  `;

}

}
function cargarConfiguracionFinanciera() {

const restaurantId =
getRestaurantId();

const config =
JSON.parse(
localStorage.getItem(
`configFinanciera_${restaurantId}`
)
) || {
margenSeguridad: 0.02
};

const input =
document.getElementById(
"margenSeguridadGeneral"
);

if (input) {
input.value =
config.margenSeguridad;
}
}
function recomendarMargenSeguridad() {
  const riesgoInsumos =
    document.getElementById("riesgoInsumos").value;

  const riesgoDescuentos =
    document.getElementById("riesgoDescuentos").value;

  const riesgoDesperdicio =
    document.getElementById("riesgoDesperdicio").value;

  let margenSeguridad = 0.02;

  let razones = [
    "GRUK parte de un piso mínimo obligatorio del 2% para proteger el restaurante ante imprevistos básicos"
  ];

  if (riesgoInsumos === "medio") {
    margenSeguridad += 0.03;
    razones.push("aumenta 3% porque los costos de insumos tienen variación media");
  }

  if (riesgoInsumos === "alto") {
    margenSeguridad += 0.08;
    razones.push("aumenta 8% porque los costos de insumos son altamente variables");
  }

  if (riesgoDescuentos === "medio") {
    margenSeguridad += 0.03;
    razones.push("aumenta 3% porque el restaurante aplica descuentos ocasionales");
  }

  if (riesgoDescuentos === "alto") {
    margenSeguridad += 0.06;
    razones.push("aumenta 6% porque el restaurante usa promociones frecuentes");
  }

  if (riesgoDesperdicio === "medio") {
    margenSeguridad += 0.06;
    razones.push("aumenta 6% porque existe riesgo moderado de desperdicio o vencimiento");
  }

  if (riesgoDesperdicio === "alto") {
    margenSeguridad += 0.12;
    razones.push("aumenta 12% porque existe alto riesgo de desperdicio o vencimiento");
  }

  margenSeguridad =
    Math.min(margenSeguridad, 0.35);

  let nivelMargen = "";

  if (margenSeguridad <= 0.05) {
    nivelMargen = "Protección mínima";
  } else if (margenSeguridad <= 0.15) {
    nivelMargen = "Protección moderada";
  } else if (margenSeguridad <= 0.25) {
    nivelMargen = "Protección alta";
  } else {
    nivelMargen = "Protección agresiva";
  }

  document.getElementById("margenSeguridadGeneral").value =
    margenSeguridad.toFixed(2);

  let explicacionCompleta = "";

  if (margenSeguridad <= 0.05) {

    explicacionCompleta = `
    GRUK recomienda un margen de seguridad del
    ${(margenSeguridad * 100).toFixed(0)}%.

    Este valor parte del piso mínimo obligatorio del 2%, diseñado para proteger
    al restaurante frente a pequeños imprevistos operativos como errores de caja,
    desperdicios menores, devoluciones ocasionales o variaciones normales del negocio.

    Debido a que los riesgos detectados son relativamente bajos, no es necesario
    exigir un colchón financiero mayor. Un margen superior podría elevar
    innecesariamente los precios y afectar la competitividad.
    `;

  } else if (margenSeguridad <= 0.15) {

    explicacionCompleta = `
    GRUK recomienda un margen de seguridad del
    ${(margenSeguridad * 100).toFixed(0)}%.

    Aunque el sistema mantiene el piso mínimo de protección del 2%,
    detectó factores que incrementan el riesgo operativo del restaurante.

    Entre ellos se encuentran variaciones en los costos de insumos,
    promociones comerciales o riesgos moderados de desperdicio.

    Por esta razón GRUK aumenta automáticamente el margen recomendado
    para que el negocio pueda absorber estos impactos sin comprometer
    la rentabilidad de los productos.
    `;

  } else if (margenSeguridad <= 0.25) {

    explicacionCompleta = `
    GRUK recomienda un margen de seguridad del
    ${(margenSeguridad * 100).toFixed(0)}%.

    El análisis financiero detectó varios factores de riesgo que pueden
    afectar directamente la utilidad del restaurante.

    Entre ellos se encuentran fluctuaciones importantes en los costos,
    descuentos frecuentes y pérdidas potenciales por desperdicio
    o vencimiento de inventario.

    Un margen menor podría dejar al negocio expuesto a pérdidas
    operativas, por lo que GRUK recomienda fortalecer el colchón
    financiero mediante un nivel de protección alto.
    `;

  } else {

    explicacionCompleta = `
    GRUK recomienda un margen de seguridad del
    ${(margenSeguridad * 100).toFixed(0)}%.

    El restaurante presenta un perfil de riesgo elevado.

    La combinación de alta variación de costos, promociones frecuentes
    o riesgo significativo de desperdicio puede generar fugas importantes
    de rentabilidad si no existe una protección financiera adecuada.

    Por esta razón el sistema recomienda un margen agresivo que permita
    blindar los precios, limitar descuentos excesivos y proteger la caja
    del negocio frente a escenarios adversos.
    `;
  }

  document.getElementById("estadoConfiguracionFinanciera").innerHTML = `
    <div class="card">
      <p><strong>Margen recomendado por GRUK:</strong> ${(margenSeguridad * 100).toFixed(0)}%</p>
      <p><strong>Nivel:</strong> ${nivelMargen}</p>
      <p><strong>Análisis financiero GRUK:</strong><br>
${explicacionCompleta}
</p>
    </div>
  `;
}