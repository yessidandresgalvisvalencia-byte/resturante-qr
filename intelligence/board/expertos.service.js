"use strict";

const {
  RESPUESTA_EXPERTA_SCHEMA
} = require("./expertos.schema");
const {
  PERFILES_EXPERTOS,
  construirSystemPrompt
} = require("./expertos.prompt");

const DEPARTAMENTOS_EXPERTOS = Object.freeze([
  "FINANZAS",
  "VENTAS",
  "MARKETING",
  "OPERACIONES",
  "GENTE",
  "DIRECCION"
]);

const CONOCIMIENTO = Object.freeze({
  FINANZAS: {
    foco: PERFILES_EXPERTOS.FINANZAS.foco,
    arranque:
      "Construir primero un flujo de caja de corto plazo con saldo inicial, fecha real de cobros, obligaciones, costos variables y caja final. La utilidad contable no sustituye liquidez."
  },
  VENTAS: {
    foco: PERFILES_EXPERTOS.VENTAS.foco,
    arranque:
      "Definir cliente, oferta, ticket objetivo, proceso comercial, conversión esperada y plazo real de cobro. Una venta prometida no debe tratarse como caja disponible."
  },
  MARKETING: {
    foco: PERFILES_EXPERTOS.MARKETING.foco,
    arranque:
      "Definir cliente ideal, propuesta de valor, canal inicial, mecanismo de atribución y CAC máximo tolerable antes de escalar inversión."
  },
  OPERACIONES: {
    foco: PERFILES_EXPERTOS.OPERACIONES.foco,
    arranque:
      "Traducir la venta esperada en capacidad, compras, inventario, tiempos, calidad y responsables operativos para evitar crecer por encima de la capacidad real."
  },
  GENTE: {
    foco: PERFILES_EXPERTOS.GENTE.foco,
    arranque:
      "Asignar responsable y KPI a Dirección, Operaciones, Ventas, Finanzas y Marketing. Separar una función formal de Gente solo cuando la escala y carga lo justifiquen."
  },
  DIRECCION: {
    foco: PERFILES_EXPERTOS.DIRECCION.foco,
    arranque:
      "Cerrar primero las definiciones que hacen posible medir el negocio: cliente, oferta, economía unitaria, caja, operación, responsables y KPIs. Después se prioriza ejecución."
  }
});

const ARRANQUE_RIESGOS = Object.freeze({
  FINANZAS: [
    "Confundir utilidad proyectada con dinero disponible para pagar obligaciones.",
    "Comprometer costos fijos antes de conocer la caja de supervivencia."
  ],
  VENTAS: [
    "Proyectar ingresos sin separar venta, facturación y cobro efectivo.",
    "Perseguir volumen que no deje contribución suficiente."
  ],
  MARKETING: [
    "Comprar demanda antes de conocer CAC máximo, margen y capacidad de atención.",
    "Medir alcance o tráfico sin atribución a ventas y caja."
  ],
  OPERACIONES: [
    "Diseñar capacidad para una demanda no validada o quedarse corto frente a una demanda real.",
    "Comprar inventario sin política de rotación, reposición y merma."
  ],
  GENTE: [
    "Contratar antes de definir responsabilidades, carga real y KPI.",
    "Crear departamentos por organigrama en lugar de cubrir funciones críticas."
  ],
  DIRECCION: [
    "Intentar ejecutar simultáneamente demasiadas iniciativas sin dependencias claras.",
    "Tomar decisiones permanentes con supuestos que todavía no han sido validados."
  ]
});

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function clasificarIntencion(pregunta) {
  const p = normalizar(pregunta);

  if (
    /(desde cero|empezar de cero|comenzar de cero|crear empresa|montar empresa|arrancar)/
      .test(p)
  ) {
    return "ARRANQUE";
  }

  if (/(corrige|corregir|equivoc|eso no|no es correcto|error)/.test(p)) {
    return "CORRECCION";
  }

  if (/(que significa|por que|explica|entender)/.test(p)) {
    return "EXPLICACION";
  }

  if (/(que hacemos|que hago|como mejor|prioridad|primero)/.test(p)) {
    return "ACCION";
  }

  return "CONSULTA";
}

function numero(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }

  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function formato(valor) {
  const n = numero(valor);
  if (n === null) return null;

  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2
  }).format(n);
}

function limitarTexto(valor, maximo = 1200) {
  return String(valor || "").trim().slice(0, maximo);
}

function limitarLista(lista, {
  maxItems = 10,
  maxTexto = 500
} = {}) {
  if (!Array.isArray(lista)) return [];

  return lista
    .map((item) => limitarTexto(item, maxTexto))
    .filter(Boolean)
    .slice(0, maxItems);
}

function hechosReporte(reporte) {
  if (!reporte) return [];

  const kpi = reporte.kpi_principal || {};
  const hechos = [
    `${reporte.neurona}: ${kpi.nombre || "KPI"} — estado ${kpi.estado || "SIN_ESTADO"}.`
  ];

  const actual = formato(kpi.valor_actual);
  const objetivo = formato(kpi.valor_objetivo);

  if (actual !== null) {
    hechos.push(`Valor actual: ${actual}.`);
  }

  if (objetivo !== null) {
    hechos.push(`Objetivo: ${objetivo}.`);
  }

  return hechos.concat(
    (reporte.hallazgos || [])
      .map((h) => limitarTexto(h.evidencia, 500))
      .filter(Boolean)
  );
}

function sanitizarReporte(reporte) {
  return {
    neurona: limitarTexto(reporte?.neurona, 40),
    periodo: reporte?.periodo || null,
    kpi_principal: {
      nombre: limitarTexto(reporte?.kpi_principal?.nombre, 120),
      valor_actual: numero(reporte?.kpi_principal?.valor_actual),
      valor_objetivo: numero(reporte?.kpi_principal?.valor_objetivo),
      estado: limitarTexto(reporte?.kpi_principal?.estado, 30)
    },
    hallazgos: (reporte?.hallazgos || [])
      .slice(0, 12)
      .map((hallazgo) => ({
        tipo: limitarTexto(hallazgo?.tipo, 80),
        evidencia: limitarTexto(hallazgo?.evidencia, 700),
        impacto_financiero_estimado:
          numero(hallazgo?.impacto_financiero_estimado),
        confianza: numero(hallazgo?.confianza)
      })),
    necesita_decision_de_cerebro:
      Boolean(reporte?.necesita_decision_de_cerebro)
  };
}

function sanitizarDecision(decision) {
  if (!decision) return null;

  return {
    decision_general: {
      situacion: limitarTexto(decision?.decision_general?.situacion, 800),
      causa_raiz: limitarTexto(decision?.decision_general?.causa_raiz, 800),
      prediccion: limitarTexto(decision?.decision_general?.prediccion, 800)
    },
    ordenes_por_departamento:
      (decision?.ordenes_por_departamento || [])
        .slice(0, 20)
        .map((orden) => ({
          departamento: limitarTexto(orden?.departamento, 40),
          tarea: limitarTexto(orden?.tarea, 700),
          prioridad: limitarTexto(orden?.prioridad, 30),
          kpi_a_medir: limitarTexto(orden?.kpi_a_medir, 120),
          estado: limitarTexto(orden?.estado, 50)
        })),
    confianza_global: numero(decision?.confianza_global),
    riesgo_si_no_se_hace:
      limitarTexto(decision?.riesgo_si_no_se_hace, 900),
    como_medir_exito_en_7_dias:
      limitarTexto(decision?.como_medir_exito_en_7_dias, 900)
  };
}

function sanitizarHistorial(intervenciones) {
  return (intervenciones || [])
    .slice(-18)
    .map((item) => ({
      tipo: limitarTexto(item?.tipo, 30),
      departamento: limitarTexto(item?.departamento, 40),
      mensaje: limitarTexto(item?.mensaje, 1400),
      evidencia: limitarTexto(item?.evidencia, 1600)
    }))
    .filter((item) => item.mensaje);
}

function construirContexto({
  pregunta,
  intencion,
  decision,
  reportes,
  intervenciones
}) {
  return {
    pregunta_humana: limitarTexto(pregunta, 2000),
    intencion_detectada: intencion,
    decision_cerebro_en_discusion: sanitizarDecision(decision),
    reportes_neuronas: (reportes || [])
      .slice(0, 10)
      .map(sanitizarReporte),
    historial_conversacion: sanitizarHistorial(intervenciones),
    reglas_de_evidencia: {
      dato_gruk:
        "Hecho proveniente de reportes o decisiones persistidas por GRUK.",
      dato_humano:
        "Afirmación de la persona usuaria; sirve como contexto pero no se convierte automáticamente en hecho verificado.",
      criterio_profesional:
        "Juicio empresarial sin números inventados.",
      supuesto:
        "Hipótesis pendiente de validación que debe señalarse explícitamente."
    }
  };
}

function respuestaFallbackArranque(departamento) {
  const conocimiento = CONOCIMIENTO[departamento];

  const objeciones = {
    FINANZAS: [
      "VENTAS y MARKETING no deben tratar ventas proyectadas como caja hasta definir plazo y probabilidad real de cobro."
    ],
    VENTAS: [
      "FINANZAS necesita supuestos comerciales operables; una proyección de caja sin volumen, ticket, conversión y cobranza es incompleta."
    ],
    MARKETING: [
      "No aprobaría una escala de adquisición hasta conocer margen de contribución, CAC máximo y capacidad de atención."
    ],
    OPERACIONES: [
      "No aceptaría una meta comercial sin traducirla a compras, inventario, tiempos, personal y capacidad."
    ],
    GENTE: [
      "No contrataría por intuición: primero deben existir función, carga, responsable y KPI que justifiquen la capacidad adicional."
    ],
    DIRECCION: [
      "La discusión no debe terminar en seis planes separados. Las dependencias deben quedar ordenadas antes de que el Cerebro emita una decisión."
    ]
  };

  return {
    departamento,
    respuesta:
      `${departamento}: ${conocimiento.arranque}`,
    criterio_profesional:
      `Mi responsabilidad en este escenario es ${conocimiento.foco}. El diseño inicial debe permitir medir supervivencia y ejecución antes de optimizar crecimiento.`,
    evidencia_usada: [],
    inferencias: [
      "La pregunta plantea explícitamente un escenario desde cero; por tanto, estas conclusiones son criterios de diseño empresarial y no describen resultados históricos."
    ],
    riesgos: ARRANQUE_RIESGOS[departamento] || [],
    objeciones: objeciones[departamento] || [],
    acuerdos: [],
    datos_faltantes:
      departamento === "DIRECCION"
        ? [
            "Qué negocio se va a crear.",
            "Qué se venderá y a qué cliente.",
            "Capital disponible.",
            "Canal o ubicación de operación.",
            "Número inicial de personas."
          ]
        : [],
    confianza: 85
  };
}

function respuestaFallbackContexto({
  departamento,
  reporte,
  memoria
}) {
  const hechos = hechosReporte(reporte);
  const faltantes = [];

  if (!reporte) {
    faltantes.push(
      `No hay reporte vigente de ${departamento}.`
    );
  }

  let respuesta =
    `${departamento}: para responder con rigor revisaría ${CONOCIMIENTO[departamento].foco}.`;

  if (reporte) {
    respuesta +=
      ` El KPI disponible está ${reporte.kpi_principal?.estado || "sin estado"}; sus hallazgos son evidencia disponible, pero no prueban por sí solos una causa.`;
  } else {
    respuesta +=
      " No existe evidencia suficiente para afirmar una causa concreta desde esta función.";
  }

  if (memoria.length) {
    respuesta +=
      " Hay contexto humano previo, pero se mantiene separado de los hechos calculados por GRUK.";
  }

  return {
    departamento,
    respuesta,
    criterio_profesional:
      "Primero separaría hechos observados, hipótesis y decisiones reversibles antes de comprometer recursos.",
    evidencia_usada: hechos,
    inferencias: [],
    riesgos:
      reporte?.kpi_principal?.estado === "CRITICO"
        ? [
            "El KPI está en estado CRITICO y requiere atención prioritaria, sin asumir una causa que los datos no demuestran."
          ]
        : [],
    objeciones: [],
    acuerdos: [],
    datos_faltantes: faltantes,
    confianza: reporte ? 70 : 35
  };
}

function generarFallback({
  intencion,
  reportes,
  intervenciones
}) {
  const porNeurona = new Map(
    (reportes || []).map((reporte) => [
      reporte.neurona,
      reporte
    ])
  );

  const memoria = sanitizarHistorial(intervenciones);

  const respuestas = DEPARTAMENTOS_EXPERTOS.map(
    (departamento) => {
      if (intencion === "ARRANQUE") {
        return respuestaFallbackArranque(departamento);
      }

      return respuestaFallbackContexto({
        departamento,
        reporte:
          porNeurona.get(departamento) || null,
        memoria
      });
    }
  );

  const direccion = respuestas.find(
    (item) => item.departamento === "DIRECCION"
  );

  if (direccion && intencion !== "ARRANQUE") {
    const faltantes = respuestas
      .flatMap((item) => item.datos_faltantes)
      .filter(Boolean);

    direccion.respuesta =
      "DIRECCION: la Junta conserva separados los hechos, el criterio profesional y los datos faltantes. Antes de convertir la discusión en acción deben resolverse los vacíos que puedan cambiar materialmente la decisión.";

    direccion.datos_faltantes =
      [...new Set(faltantes)].slice(0, 10);
  }

  return {
    model: "GRUK-CONSULTIVO-FALLBACK-3",
    responseId: null,
    respuestas
  };
}

function extraerTextoRespuesta(payload) {
  if (typeof payload?.output_text === "string") {
    return payload.output_text.trim();
  }

  const textos = [];

  for (const item of payload?.output || []) {
    for (const parte of item?.content || []) {
      if (
        parte?.type === "output_text" &&
        typeof parte?.text === "string"
      ) {
        textos.push(parte.text);
      }
    }
  }

  return textos.join("\n").trim();
}

function errorProveedor(codigo, statusCode = 502) {
  const error = new Error(codigo);
  error.statusCode = statusCode;
  return error;
}

function razonamientoConfigurado() {
  const permitido = new Set([
    "none",
    "low",
    "medium",
    "high",
    "xhigh"
  ]);

  const valor = String(
    process.env.GRUK_EXPERT_REASONING_EFFORT || "high"
  ).toLowerCase();

  return permitido.has(valor) ? valor : "high";
}

async function consultarOpenAI({
  contexto,
  fetchImpl = global.fetch
}) {
  const apiKey = String(
    process.env.OPENAI_API_KEY || ""
  ).trim();

  if (!apiKey) return null;

  if (typeof fetchImpl !== "function") {
    throw errorProveedor(
      "JUNTA_IA_PROVIDER_ERROR_FETCH_NO_DISPONIBLE"
    );
  }

  const model = String(
    process.env.GRUK_EXPERT_MODEL || "gpt-5.6"
  ).trim();

  let response;

  try {
    response = await fetchImpl(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          reasoning: {
            effort: razonamientoConfigurado()
          },
          input: [
            {
              role: "system",
              content: construirSystemPrompt()
            },
            {
              role: "user",
              content:
                "CONTEXTO_GRUK\n" +
                JSON.stringify(contexto)
            }
          ],
          text: {
            format: {
              type: "json_schema",
              name: "gruk_junta_experta",
              strict: true,
              schema: RESPUESTA_EXPERTA_SCHEMA
            }
          },
          max_output_tokens: 9000
        })
      }
    );
  } catch (error) {
    console.error(
      "[JUNTA] Error de transporte con proveedor IA:",
      error?.message || error
    );

    throw errorProveedor(
      "JUNTA_IA_PROVIDER_ERROR_TRANSPORTE"
    );
  }

  if (!response.ok) {
    console.error(
      "[JUNTA] Proveedor IA respondió con estado:",
      response.status
    );

    throw errorProveedor(
      `JUNTA_IA_PROVIDER_ERROR_${response.status}`
    );
  }

  const payload = await response.json();
  const texto = extraerTextoRespuesta(payload);

  if (!texto) {
    throw errorProveedor(
      "JUNTA_IA_RESPUESTA_SIN_TEXTO"
    );
  }

  let parsed;

  try {
    parsed = JSON.parse(texto);
  } catch {
    throw errorProveedor(
      "JUNTA_IA_JSON_INVALIDO"
    );
  }

  return {
    model: payload.model || model,
    responseId: payload.id || null,
    parsed
  };
}

function normalizarRespuestaExperta(respuesta) {
  return {
    departamento: limitarTexto(
      respuesta?.departamento,
      40
    ).toUpperCase(),
    respuesta: limitarTexto(
      respuesta?.respuesta,
      1800
    ),
    criterio_profesional: limitarTexto(
      respuesta?.criterio_profesional,
      1200
    ),
    evidencia_usada: limitarLista(
      respuesta?.evidencia_usada,
      { maxItems: 10, maxTexto: 500 }
    ),
    inferencias: limitarLista(
      respuesta?.inferencias,
      { maxItems: 8, maxTexto: 500 }
    ),
    riesgos: limitarLista(
      respuesta?.riesgos,
      { maxItems: 8, maxTexto: 500 }
    ),
    objeciones: limitarLista(
      respuesta?.objeciones,
      { maxItems: 8, maxTexto: 500 }
    ),
    acuerdos: limitarLista(
      respuesta?.acuerdos,
      { maxItems: 8, maxTexto: 500 }
    ),
    datos_faltantes: limitarLista(
      respuesta?.datos_faltantes,
      { maxItems: 10, maxTexto: 350 }
    ),
    confianza:
      Number.isInteger(respuesta?.confianza)
        ? Math.max(
            0,
            Math.min(100, respuesta.confianza)
          )
        : 0
  };
}

function validarRespuestas(respuestas) {
  if (!Array.isArray(respuestas)) {
    throw errorProveedor(
      "JUNTA_IA_RESPUESTAS_INCOMPLETAS"
    );
  }

  const normalizadas = respuestas.map(
    normalizarRespuestaExperta
  );

  const porDepartamento = new Map();

  for (const respuesta of normalizadas) {
    if (
      !DEPARTAMENTOS_EXPERTOS.includes(
        respuesta.departamento
      ) ||
      !respuesta.respuesta ||
      !respuesta.criterio_profesional ||
      porDepartamento.has(respuesta.departamento)
    ) {
      throw errorProveedor(
        "JUNTA_IA_RESPUESTAS_INCOMPLETAS"
      );
    }

    porDepartamento.set(
      respuesta.departamento,
      respuesta
    );
  }

  if (
    porDepartamento.size !==
    DEPARTAMENTOS_EXPERTOS.length
  ) {
    throw errorProveedor(
      "JUNTA_IA_RESPUESTAS_INCOMPLETAS"
    );
  }

  return DEPARTAMENTOS_EXPERTOS.map(
    (departamento) =>
      porDepartamento.get(departamento)
  );
}

async function generarRespuestasExpertas({
  pregunta,
  decision,
  reportes,
  intervenciones,
  proveedor = consultarOpenAI
}) {
  const intencion = clasificarIntencion(pregunta);

  const contexto = construirContexto({
    pregunta,
    intencion,
    decision,
    reportes,
    intervenciones
  });

  const generada = await proveedor({ contexto });

  if (!generada) {
    const fallback = generarFallback({
      intencion,
      reportes,
      intervenciones
    });

    return {
      ...fallback,
      intencion
    };
  }

  const respuestas = validarRespuestas(
    generada.parsed?.respuestas
  );

  return {
    model: generada.model,
    responseId: generada.responseId,
    intencion,
    respuestas
  };
}

function extraerMemoriaHumana(intervenciones) {
  return (intervenciones || [])
    .filter((item) => item.tipo === "HUMANO")
    .slice(-10)
    .map((item) => limitarTexto(item.mensaje, 1200))
    .filter(Boolean);
}

module.exports = {
  DEPARTAMENTOS_EXPERTOS,
  CONOCIMIENTO,
  clasificarIntencion,
  construirContexto,
  consultarOpenAI,
  validarRespuestas,
  generarRespuestasExpertas,
  extraerMemoriaHumana
};
