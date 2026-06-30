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