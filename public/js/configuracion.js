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

function escaparConfiguracionGRUK(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pintarEstadoConfiguracionInteligenciaGRUK(
  configuracion
) {
  const estado =
    document.getElementById(
      "estadoConfiguracionInteligenciaGRUK"
    );

  if (!estado) return;

  const faltantes =
    Array.isArray(
      configuracion?.faltantes
    )
      ? configuracion.faltantes
      : [];

  const completo =
    Boolean(
      configuracion?.completo
    );

  estado.innerHTML = `
    <div class="card">
      <p>
        <strong>Preparación de Inteligencia:</strong>
        ${completo ? "✅ COMPLETA" : "⚠️ PENDIENTE"}
      </p>
      <p>
        ${Number(configuracion?.configurados || 0)}
        de
        ${Number(configuracion?.total || 5)}
        datos configurados
        ·
        ${Number(configuracion?.porcentaje || 0)}%
      </p>
      ${faltantes.length
        ? `<p><strong>Falta:</strong> ${faltantes
            .map(
              (item) =>
                escaparConfiguracionGRUK(
                  item.etiqueta
                )
            )
            .join(", ")}</p>`
        : "<p>Las cinco referencias base ya están disponibles para las neuronas.</p>"}
    </div>
  `;
}

function pintarGuiaEmpresarialGRUK(configuracion) {
  const contenedor = document.getElementById("guiaConfiguracionGRUK");
  if (!contenedor) return;

  const faltantes = Array.isArray(configuracion?.faltantes) ? configuracion.faltantes : [];
  if (!faltantes.length) {
    const valores = configuracion?.valores || {};
    const moneda = (valor) => Number(valor || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 });
    contenedor.innerHTML = `
      <div class="card">
        <h3>GRUK ya tiene la base para orientarte</h3>
        <p>Ahora puedo comparar lo que ocurre en tu negocio con las referencias que configuraste. No son números decorativos: cada una tiene un trabajo concreto.</p>
      </div>
      <div class="card">
        <h3>Qué hice</h3>
        <p>Organicé cinco referencias empresariales: margen objetivo <strong>${escaparConfiguracionGRUK(valores.margen_objetivo)}%</strong>, punto de equilibrio <strong>${moneda(valores.punto_equilibrio)}</strong>, ticket objetivo <strong>${moneda(valores.ticket_objetivo)}</strong>, CAC máximo <strong>${moneda(valores.cac_maximo)}</strong> y <strong>${escaparConfiguracionGRUK(valores.empleados_actuales)}</strong> personas.</p>
      </div>
      <div class="card">
        <h3>Cómo lo hice</h3>
        <p>Convertí esos datos en referencias de control. Finanzas puede contrastar rentabilidad y equilibrio; Ventas, el valor promedio vendido; Marketing, cuánto cuesta adquirir un cliente; y GRUK puede entender mejor el tamaño operativo del negocio.</p>
      </div>
      <div class="card">
        <h3>Por qué lo hice</h3>
        <p>Un número aislado no dice si el negocio va bien. Vender más no garantiza ganar más, y tener utilidad no garantiza tener caja. Estas referencias permiten comparar resultados reales contra objetivos explícitos.</p>
      </div>
      <div class="card">
        <h3>Para qué te sirve</h3>
        <p>Para que GRUK pueda pasar de mostrar datos a explicarte situaciones concretas: qué se está desviando, qué merece atención y qué acción empresarial conviene evaluar.</p>
      </div>
      <div class="card">
        <h3>Resultado esperado</h3>
        <p>Que recibas recomendaciones entendibles y accionables en lugar de tener que interpretar reportes por tu cuenta. Si los datos reales no son suficientes, GRUK debe decirlo antes de recomendar.</p>
      </div>
      <div class="card">
        <h3>Cómo lo mediremos</h3>
        <p>Cada recomendación deberá quedar asociada a un KPI. Después compararemos el resultado real con la referencia correspondiente para saber si la acción mejoró, empeoró o no produjo un cambio medible.</p>
      </div>`;
    return;
  }

  const explicaciones = {
    margen_objetivo: ["Margen objetivo", "Sirve para saber cuánto debe quedar después del costo directo de vender.", "Primero necesitamos costos confiables. No voy a inventarte un porcentaje universal."],
    punto_equilibrio: ["Punto de equilibrio", "Te dice cuánto necesitas vender para cubrir la estructura del negocio.", "Se construye con tus costos fijos y tu margen real; no con una cifra genérica."],
    ticket_objetivo: ["Ticket objetivo", "Permite saber cuánto debería dejar, en promedio, cada venta.", "GRUK puede ayudarte a definirlo comparando tu ticket real, mezcla y meta comercial."],
    cac_maximo: ["Costo máximo por cliente", "Evita gastar en marketing más de lo que económicamente soporta cada cliente.", "Antes de recomendarlo necesito margen, recurrencia y atribución de ventas."],
    empleados_actuales: ["Personas del negocio", "Permite entender capacidad y activar funciones como Gente cuando realmente hacen falta.", "Este dato sí puedes indicarlo directamente: cuántas personas trabajan hoy."]
  };

  const tarjetas = faltantes.map((item) => {
    const e = explicaciones[item.campo] || [item.etiqueta, "GRUK necesita este dato para analizar mejor tu empresa.", "Te explicaré cómo obtenerlo antes de pedirte que lo configures."];
    return `<div class="card"><h3>${escaparConfiguracionGRUK(e[0])}</h3><p><strong>¿Por qué te lo pido?</strong> ${escaparConfiguracionGRUK(e[1])}</p><p><strong>Mi recomendación:</strong> ${escaparConfiguracionGRUK(e[2])}</p></div>`;
  }).join("");

  contenedor.innerHTML = `
    <div class="card">
      <h3>No tienes que llenar todo a ciegas</h3>
      <p>Faltan ${faltantes.length} referencias. GRUK no las tratará como errores ni inventará valores. Te irá guiando para obtenerlas con datos reales.</p>
    </div>
    ${tarjetas}`;
}

function cargarValoresConfiguracionInteligenciaGRUK(
  valores
) {
  const campos = {
    configInteligenciaMargen:
      valores?.margen_objetivo,
    configInteligenciaPuntoEquilibrio:
      valores?.punto_equilibrio,
    configInteligenciaTicket:
      valores?.ticket_objetivo,
    configInteligenciaCAC:
      valores?.cac_maximo,
    configInteligenciaEmpleados:
      valores?.empleados_actuales
  };

  for (
    const [id, valor] of
    Object.entries(campos)
  ) {
    const input =
      document.getElementById(id);

    if (!input) continue;

    input.value =
      valor === null ||
      valor === undefined
        ? ""
        : valor;
  }
}

async function cargarConfiguracionInteligenciaGRUK() {
  const res =
    await grukFetch(
      "/api/configuracion-inteligencia"
    );

  const data =
    await res.json();

  if (!res.ok || !data.ok) {
    throw new Error(
      data.error ||
      "No fue posible cargar la configuración base de Inteligencia."
    );
  }

  cargarValoresConfiguracionInteligenciaGRUK(
    data.configuracion?.valores || {}
  );

  pintarEstadoConfiguracionInteligenciaGRUK(
    data.configuracion
  );

  pintarGuiaEmpresarialGRUK(data.configuracion);

  return data.configuracion;
}

async function guardarConfiguracionInteligenciaGRUK() {
  const estado =
    document.getElementById(
      "estadoConfiguracionInteligenciaGRUK"
    );

  const body = {
    margen_objetivo:
      Number(
        document.getElementById(
          "configInteligenciaMargen"
        )?.value
      ),
    punto_equilibrio:
      Number(
        document.getElementById(
          "configInteligenciaPuntoEquilibrio"
        )?.value
      ),
    ticket_objetivo:
      Number(
        document.getElementById(
          "configInteligenciaTicket"
        )?.value
      ),
    cac_maximo:
      Number(
        document.getElementById(
          "configInteligenciaCAC"
        )?.value
      ),
    empleados_actuales:
      Number(
        document.getElementById(
          "configInteligenciaEmpleados"
        )?.value
      )
  };

  const camposVacios = [
    [
      "Margen objetivo",
      document.getElementById(
        "configInteligenciaMargen"
      )?.value
    ],
    [
      "Punto de equilibrio",
      document.getElementById(
        "configInteligenciaPuntoEquilibrio"
      )?.value
    ],
    [
      "Ticket objetivo",
      document.getElementById(
        "configInteligenciaTicket"
      )?.value
    ],
    [
      "CAC máximo",
      document.getElementById(
        "configInteligenciaCAC"
      )?.value
    ],
    [
      "Empleados actuales",
      document.getElementById(
        "configInteligenciaEmpleados"
      )?.value
    ]
  ]
    .filter(
      ([, valor]) =>
        valor === "" ||
        valor === null ||
        valor === undefined
    )
    .map(
      ([nombre]) =>
        nombre
    );

  if (camposVacios.length) {
    if (estado) {
      estado.innerHTML = `
        <div class="card">
          <p>⚠️ Completa primero: ${camposVacios
            .map(escaparConfiguracionGRUK)
            .join(", ")}.</p>
        </div>
      `;
    }

    return;
  }

  try {
    const res =
      await grukFetch(
        "/api/configuracion-inteligencia",
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json"
          },
          body:
            JSON.stringify(
              body
            )
        }
      );

    const data =
      await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(
        data.error ||
        "No fue posible guardar la configuración base."
      );
    }

    pintarEstadoConfiguracionInteligenciaGRUK(
      data.configuracion
    );

    pintarGuiaEmpresarialGRUK(data.configuracion);

    if (estado) {
      estado.insertAdjacentHTML(
        "beforeend",
        "<p>✅ Guardado. GRUK está recalculando las neuronas con estas referencias.</p>"
      );
    }
  } catch (error) {
    if (estado) {
      estado.innerHTML = `
        <div class="card">
          <p>❌ ${escaparConfiguracionGRUK(
            error.message
          )}</p>
        </div>
      `;
    }
  }
}

async function inicializarConfiguracionGRUK() {
  cargarConfiguracionFinanciera();

  try {
    await cargarConfiguracionInteligenciaGRUK();
  } catch (error) {
    const estado =
      document.getElementById(
        "estadoConfiguracionInteligenciaGRUK"
      );

    if (estado) {
      estado.innerHTML = `
        <div class="card">
          <p>❌ ${escaparConfiguracionGRUK(
            error.message
          )}</p>
        </div>
      `;
    }
  }
}

window.guardarConfiguracionInteligenciaGRUK =
  guardarConfiguracionInteligenciaGRUK;

async function autorizarCompletarGRUK(){
 const boton=document.getElementById("btnCompletarGRUK"),out=document.getElementById("resultadoCompletarGRUK");
 if(boton)boton.disabled=true;if(out)out.innerHTML="<p>GRUK está revisando qué puede calcular sin inventar datos...</p>";
 try{
  const [cfgRes,juntaRes,recRes]=await Promise.all([grukFetch("/api/configuracion-inteligencia"),grukFetch("/api/junta/viva"),grukFetch("/api/configuracion-inteligencia/recomendaciones")]);
  const cfgData=await cfgRes.json(),juntaData=await juntaRes.json(),recData=await recRes.json();
  if(!cfgRes.ok||!cfgData.ok)throw new Error(cfgData.error||"No fue posible leer la configuración.");
  const cfg=cfgData.configuracion||{},valores={...(cfg.valores||{})},faltantes=new Set((cfg.faltantes||[]).map(x=>x.campo)),estado=juntaData.estado||{},reps=Array.isArray(estado.reportesNeuronas)?estado.reportesNeuronas:[];
  const completados=[],pendientes=[]; const rec=recData?.recomendacion; if(faltantes.has("margen_objetivo")&&rec?.estado==="RECOMENDADO"&&Number.isFinite(Number(rec.valor))){valores.margen_objetivo=Number(rec.valor);completados.push("Margen objetivo: "+rec.valor+"% recomendado por FINANZAS con confianza "+rec.confianza+"%. "+rec.por_que);} else if(faltantes.has("margen_objetivo")&&rec?.estado==="EVIDENCIA_INSUFICIENTE"){pendientes.push("Margen objetivo — "+rec.por_que); faltantes.delete("margen_objetivo");}
  const venta=reps.find(x=>x.neurona==="VENTAS"&&x.evaluabilidad==="EVALUABLE"&&Number.isFinite(Number(x.valorActual)));
  if(faltantes.has("ticket_objetivo")&&venta){valores.ticket_objetivo=Number(venta.valorActual);completados.push("Ticket objetivo: se tomó el ticket promedio real medido por Ventas como referencia inicial.");}
  // No inferimos margen objetivo desde margen actual: convertir desempeño observado en objetivo sería una decisión empresarial, no un cálculo.
  for(const f of (cfg.faltantes||[])){if(!completados.some(x=>x.toLowerCase().startsWith(String(f.etiqueta||"").toLowerCase().split(" ")[0]))){pendientes.push(f.etiqueta);}}
  const requeridos=["margen_objetivo","punto_equilibrio","ticket_objetivo","cac_maximo","empleados_actuales"];
  const listo=requeridos.every(k=>Number.isFinite(Number(valores[k])));
  if(completados.length&&listo){
   const save=await grukFetch("/api/configuracion-inteligencia",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(valores)});const sd=await save.json();if(!save.ok||!sd.ok)throw new Error(sd.error||"No fue posible guardar.");
   await cargarConfiguracionInteligenciaGRUK();
  }
  if(out)out.innerHTML='<div class="card"><h3>Resultado de la autorización</h3>'+(completados.length?'<p><strong>GRUK pudo derivar:</strong></p><ul>'+completados.map(x=>'<li>'+escaparConfiguracionGRUK(x)+'</li>').join("")+'</ul>':'<p><strong>Hoy no hay un dato faltante que GRUK pueda completar de forma segura.</strong></p>')+(pendientes.length?'<p><strong>Aún necesita decisión o información humana:</strong> '+pendientes.map(escaparConfiguracionGRUK).join(", ")+'. GRUK no pondrá ceros ni porcentajes genéricos para desbloquear Inteligencia.</p>':'')+'<p><strong>Regla:</strong> autorizar no significa permitir que GRUK invente. Significa permitirle usar cálculos verificables como punto de partida.</p></div>';
 }catch(e){if(out)out.innerHTML='<p>⚠️ '+escaparConfiguracionGRUK(e.message)+'</p>';}finally{if(boton)boton.disabled=false}
}
