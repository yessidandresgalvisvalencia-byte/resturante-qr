"use strict";

const {
  PERFILES_EXPERTOS,
  TEMAS
} = require("./expertos.config");

const DEPARTAMENTOS_EXPERTOS = Object.freeze([
  "FINANZAS",
  "VENTAS",
  "MARKETING",
  "OPERACIONES",
  "GENTE",
  "DIRECCION"
]);

const CONOCIMIENTO = Object.freeze(
  Object.fromEntries(
    Object.entries(PERFILES_EXPERTOS).map(
      ([departamento, perfil]) => [
        departamento,
        {
          foco: perfil.foco,
          principios: perfil.principios
        }
      ]
    )
  )
);

const PLAYBOOKS = Object.freeze({
  FINANZAS: {
    ARRANQUE:
      "Empezaría por caja, no por utilidad. Necesitamos saldo inicial, calendario de cobros, calendario de obligaciones, costos variables por venta y caja final por semana. Después medimos cuántas semanas de supervivencia tenemos y qué gasto puede comprometerse sin poner en riesgo nómina, proveedores e impuestos.",
    FLUJO_CAJA:
      "El flujo de caja debe separar con precisión cuándo se vende, cuándo se cobra y cuándo sale el dinero. Mi primera lectura es liquidez de corto plazo: saldo inicial + cobros reales - pagos reales = caja final. Después incorporamos escenarios y colchón de seguridad.",
    MARGEN_PRECIO:
      "Antes de tocar precio necesito costo confiable y margen de contribución. Una subida de precio puede mejorar margen unitario pero reducir conversión; un descuento puede elevar volumen y destruir caja. La decisión debe modelar ambas cosas.",
    PUNTO_EQUILIBRIO:
      "El punto de equilibrio se construye con costos fijos y contribución por unidad o por peso vendido. Si no conocemos contribución real, cualquier punto de equilibrio es decorativo.",
    CRECIMIENTO:
      "El crecimiento debe financiar capital de trabajo. Antes de expandir preguntaría cuánto efectivo consume cada peso adicional de venta y cuánto tarda en regresar a caja.",
    DEUDA:
      "La deuda solo tiene sentido si el flujo que financia puede pagar capital e intereses con margen de seguridad. No usaría deuda de largo plazo para tapar pérdidas operativas recurrentes sin corregir la causa.",
    DEFAULT:
      "Voy a proteger caja, margen y capacidad de pago. No aceptaré una recomendación que aumente ventas o gasto sin explicar cuándo entra el efectivo, cuánto margen deja y qué riesgo financiero crea."
  },

  VENTAS: {
    ARRANQUE:
      "Definiría primero cliente, problema, oferta, ticket, proceso comercial y forma de cobro. El objetivo no es registrar ventas prometidas sino construir ingresos que puedan repetirse y cobrarse.",
    FLUJO_CAJA:
      "Para que Finanzas proyecte caja, Ventas debe entregar supuestos operables: número de oportunidades, conversión, ticket, frecuencia y plazo real de cobro. Una venta a crédito no puede tratarse como efectivo disponible.",
    MARGEN_PRECIO:
      "Precio y margen deben evaluarse junto con conversión, ticket y mezcla de productos. Defender margen no significa subir precios indiscriminadamente; significa vender valor sin comprar volumen no rentable.",
    VENTAS:
      "Separaría tráfico, oportunidad, conversión, ticket, recurrencia y cobranza. Si solo miramos ventas totales no sabremos dónde se rompe el motor comercial.",
    CRECIMIENTO:
      "Antes de exigir más volumen validaría que existe un proceso comercial repetible y que Operaciones puede cumplir lo vendido sin deteriorar experiencia ni margen.",
    DEFAULT:
      "Mi responsabilidad es convertir demanda en ingresos rentables y cobrables. Necesito saber quién compra, por qué compra, cuánto deja y cuándo paga."
  },

  MARKETING: {
    ARRANQUE:
      "No empezaría comprando publicidad. Primero definiría cliente ideal, propuesta de valor, mensaje, canal de prueba y mecanismo de atribución. Solo después asignaría presupuesto con un CAC máximo compatible con margen y caja.",
    FLUJO_CAJA:
      "Marketing debe tratar el presupuesto como inversión condicionada. Si no conocemos CAC máximo, tiempo de recuperación y margen por cliente, no tenemos autorización económica para escalar adquisición.",
    MARGEN_PRECIO:
      "Si Finanzas necesita proteger margen, Marketing debe fortalecer percepción de valor antes de depender de descuentos. El precio se defiende mejor con segmentación, oferta y posicionamiento que con promociones permanentes.",
    MARKETING_CAC:
      "Mediría costo por cliente adquirido, conversión por canal, recuperación del CAC y recurrencia. Alcance, clics o seguidores no bastan para gobernar presupuesto.",
    CRECIMIENTO:
      "Escalaría únicamente canales con atribución y economía unitaria demostradas. Crecer adquisición sin saber qué canal produce clientes rentables multiplica el desperdicio.",
    DEFAULT:
      "Mi responsabilidad es crear demanda rentable y medible. Toda recomendación debe conectar canal, cliente, conversión, CAC, margen y recurrencia."
  },

  OPERACIONES: {
    ARRANQUE:
      "Diseñaría el flujo completo desde compra hasta entrega: capacidad, inventario mínimo, proveedores, tiempos, control de calidad, merma y responsable de cada punto crítico. La operación debe poder medir costo y cumplimiento desde el primer día.",
    FLUJO_CAJA:
      "Cada venta prevista debe convertirse en necesidades de compra, inventario, horas y capacidad. Finanzas necesita saber cuándo Operaciones consume caja antes de que la venta se cobre.",
    MARGEN_PRECIO:
      "Si el margen está bajo, no asumiría que el problema es precio. Revisaría costo real, merma, porciones, reproceso, compras y mezcla antes de trasladar todo al cliente.",
    OPERACION_INVENTARIO:
      "Separaría rotación, quiebres de stock, merma, inventario inmovilizado y tiempo de reposición. Inventario no es solo disponibilidad: también es caja detenida y riesgo de pérdida.",
    CRECIMIENTO:
      "No aceptaría una meta de crecimiento sin capacidad disponible, proveedor confiable y estándar de calidad. Vender por encima de capacidad convierte crecimiento en retrasos, devoluciones y pérdida de margen.",
    DEFAULT:
      "Mi responsabilidad es que lo vendido pueda entregarse con calidad, costo y tiempo controlados. Buscaré primero desperdicio, cuellos de botella y capital inmovilizado."
  },

  GENTE: {
    ARRANQUE:
      "Primero asignaría un responsable y un KPI a Dirección, Operaciones, Ventas, Finanzas y Marketing. No crearía departamentos por estética. Con poca gente, una persona puede cubrir varias funciones, pero ninguna función crítica puede quedar sin dueño.",
    GENTE_CAPACIDAD:
      "Antes de contratar necesito demostrar falta de capacidad: carga, horas, productividad, cuello de botella, costo total de la persona y KPI que debe mover. Si el problema es proceso, contratar solo encarece el desorden.",
    CRECIMIENTO:
      "El crecimiento exige capacidad humana, pero la contratación debe seguir a la evidencia. Separaría necesidad permanente, pico temporal y mala distribución de responsabilidades.",
    DEFAULT:
      "Mi pregunta es simple: ¿qué función crítica no tiene hoy responsable con KPI? Esa brecha se corrige antes de aumentar estructura."
  },

  DIRECCION: {
    ARRANQUE:
      "Empezando desde cero, no construiría primero un organigrama. Definiría cliente y oferta, economía unitaria y caja, operación mínima viable, responsable y KPI para las cinco funciones críticas, y una cadencia semanal de revisión. Solo después añadimos estructura.",
    FLUJO_CAJA:
      "Si la caja nos mantiene vivos, la Junta debe gobernarla como restricción principal. Dirección necesita una vista semanal que conecte ventas cobradas, obligaciones, compras, nómina, inversión y caja final; luego decide qué se puede financiar.",
    MARGEN_PRECIO:
      "No convertiría un problema de margen automáticamente en una orden de subir precios. Primero separaría precio, costo, mezcla, merma, productividad y percepción de valor; después el Cerebro podrá priorizar la intervención con mejor evidencia.",
    CRECIMIENTO:
      "No aprobaría crecimiento por entusiasmo. Exigiría evidencia de demanda, economía unitaria, caja para capital de trabajo, capacidad operativa y responsables antes de escalar.",
    DEFAULT:
      "Voy a ordenar la discusión por supervivencia, impacto financiero, dependencia y reversibilidad. La Junta debe dejar claro qué sabemos, qué suponemos y qué dato falta antes de que el Cerebro decida."
  }
});

const RIESGOS_POR_TEMA = Object.freeze({
  FLUJO_CAJA: {
    FINANZAS: [
      "Confundir utilidad con liquidez disponible.",
      "No calendarizar pagos y descubrir el faltante cuando ya vencen las obligaciones."
    ],
    VENTAS: [
      "Proyectar caja con ventas que todavía no están cobradas.",
      "Aceptar plazos de cobro incompatibles con las obligaciones del negocio."
    ],
    MARKETING: [
      "Consumir caja en adquisición antes de conocer recuperación del CAC."
    ],
    OPERACIONES: [
      "Comprar inventario demasiado pronto y dejar efectivo inmovilizado."
    ],
    GENTE: [
      "Aumentar nómina fija antes de comprobar carga y productividad."
    ],
    DIRECCION: [
      "Tomar compromisos permanentes con una caja proyectada pero no cobrada."
    ]
  },

  MARGEN_PRECIO: {
    FINANZAS: [
      "Subir volumen con margen insuficiente puede acelerar la pérdida de caja."
    ],
    VENTAS: [
      "Usar descuentos para sostener conversión puede deteriorar la economía unitaria."
    ],
    MARKETING: [
      "Posicionar la oferta solo por precio puede volver estructural el descuento."
    ],
    OPERACIONES: [
      "Atribuir todo el deterioro de margen al precio puede esconder merma o sobrecosto."
    ],
    GENTE: [
      "Presionar metas sin revisar capacidad puede trasladar el problema a horas extra y errores."
    ],
    DIRECCION: [
      "Atacar un síntoma de margen sin validar la causa puede empeorar ventas o caja."
    ]
  }
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

  if (
    /(corrige|corregir|equivoc|eso no|no es correcto|error)/
      .test(p)
  ) {
    return "CORRECCION";
  }

  if (/(que significa|por que|explica|entender)/.test(p)) {
    return "EXPLICACION";
  }

  if (
    /(que hacemos|que hago|como mejor|prioridad|primero)/
      .test(p)
  ) {
    return "ACCION";
  }

  return "CONSULTA";
}

function detectarTemas(pregunta) {
  const texto = normalizar(pregunta);
  const detectados = [];

  for (const [tema, config] of Object.entries(TEMAS)) {
    if (
      config.patrones.some((patron) =>
        patron.test(texto)
      )
    ) {
      detectados.push(tema);
    }
  }

  return detectados.length
    ? detectados
    : ["GENERAL"];
}

function numero(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
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
  return String(valor || "")
    .trim()
    .slice(0, maximo);
}

function limitarLista(
  lista,
  {
    maxItems = 10,
    maxTexto = 500
  } = {}
) {
  if (!Array.isArray(lista)) return [];

  return lista
    .map((item) =>
      limitarTexto(item, maxTexto)
    )
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
      .map((hallazgo) =>
        limitarTexto(
          hallazgo?.evidencia,
          500
        )
      )
      .filter(Boolean)
  );
}

function extraerMemoriaHumana(intervenciones) {
  return (intervenciones || [])
    .filter((item) => item.tipo === "HUMANO")
    .slice(-10)
    .map((item) =>
      limitarTexto(item.mensaje, 1200)
    )
    .filter(Boolean);
}

function construirContexto({
  pregunta,
  intencion,
  decision,
  reportes,
  intervenciones
}) {
  return {
    pregunta_humana:
      limitarTexto(pregunta, 2000),
    intencion_detectada: intencion,
    temas_detectados:
      detectarTemas(pregunta),
    decision_en_discusion: decision
      ? {
          situacion:
            limitarTexto(
              decision?.decision_general?.situacion,
              800
            ),
          causa_raiz:
            limitarTexto(
              decision?.decision_general?.causa_raiz,
              800
            ),
          prediccion:
            limitarTexto(
              decision?.decision_general?.prediccion,
              800
            ),
          confianza_global:
            numero(decision?.confianza_global)
        }
      : null,
    reportes_neuronas:
      (reportes || []).map((reporte) => ({
        neurona: reporte.neurona,
        kpi_principal:
          reporte.kpi_principal || null,
        hallazgos:
          (reporte.hallazgos || [])
            .slice(0, 12)
            .map((hallazgo) => ({
              tipo:
                limitarTexto(
                  hallazgo?.tipo,
                  80
                ),
              evidencia:
                limitarTexto(
                  hallazgo?.evidencia,
                  700
                ),
              impacto_financiero_estimado:
                numero(
                  hallazgo
                    ?.impacto_financiero_estimado
                ),
              confianza:
                numero(hallazgo?.confianza)
            }))
      })),
    historial_humano:
      extraerMemoriaHumana(
        intervenciones
      )
  };
}

function reportePorDepartamento(
  reportes,
  departamento
) {
  return (reportes || []).find(
    (reporte) =>
      reporte.neurona === departamento
  ) || null;
}

function temaPrincipal(temas) {
  const prioridad = [
    "FLUJO_CAJA",
    "MARGEN_PRECIO",
    "PUNTO_EQUILIBRIO",
    "DEUDA",
    "CRECIMIENTO",
    "VENTAS",
    "MARKETING_CAC",
    "OPERACION_INVENTARIO",
    "GENTE_CAPACIDAD",
    "SERVICIO_CLIENTE"
  ];

  return prioridad.find((tema) =>
    temas.includes(tema)
  ) || "GENERAL";
}

function playbookPara({
  departamento,
  intencion,
  temas
}) {
  const playbook =
    PLAYBOOKS[departamento];

  if (intencion === "ARRANQUE") {
    return playbook.ARRANQUE;
  }

  for (const tema of temas) {
    if (playbook[tema]) {
      return playbook[tema];
    }
  }

  return playbook.DEFAULT;
}

function riesgosPara({
  departamento,
  temas,
  reporte
}) {
  const riesgos = [];

  for (const tema of temas) {
    const definidos =
      RIESGOS_POR_TEMA[tema]
        ?.[departamento];

    if (Array.isArray(definidos)) {
      riesgos.push(...definidos);
    }
  }

  if (
    reporte?.kpi_principal?.estado ===
    "CRITICO"
  ) {
    riesgos.push(
      "El KPI de esta función está en CRITICO; debe tratarse como señal prioritaria sin inventar una causa que los datos todavía no demuestran."
    );
  }

  return [...new Set(riesgos)]
    .slice(0, 8);
}

function datosFaltantesPara({
  departamento,
  intencion,
  temas,
  reporte
}) {
  if (intencion === "ARRANQUE") {
    const porDepartamento = {
      FINANZAS: [
        "Capital inicial disponible.",
        "Costos fijos previstos.",
        "Costos variables por venta.",
        "Plazos de cobro y pago."
      ],
      VENTAS: [
        "Cliente objetivo.",
        "Oferta concreta.",
        "Ticket objetivo.",
        "Forma y plazo de cobro."
      ],
      MARKETING: [
        "Cliente ideal.",
        "Propuesta de valor.",
        "Presupuesto inicial.",
        "CAC máximo tolerable."
      ],
      OPERACIONES: [
        "Capacidad inicial.",
        "Proveedores.",
        "Inventario mínimo.",
        "Tiempo de entrega objetivo."
      ],
      GENTE: [
        "Número inicial de personas.",
        "Responsable de cada función crítica.",
        "Carga de trabajo prevista."
      ],
      DIRECCION: [
        "Qué negocio se va a crear.",
        "Qué se venderá y a qué cliente.",
        "Capital disponible.",
        "Canal o ubicación de operación.",
        "Número inicial de personas."
      ]
    };

    return porDepartamento[
      departamento
    ] || [];
  }

  const faltantes = [];

  if (
    departamento !== "DIRECCION" &&
    !reporte
  ) {
    faltantes.push(
      `No hay reporte vigente de ${departamento}.`
    );
  }

  const principal = temaPrincipal(temas);

  const porTema = {
    FLUJO_CAJA: {
      FINANZAS: [
        "Saldo de caja disponible.",
        "Calendario de cobros.",
        "Calendario de obligaciones."
      ],
      VENTAS: [
        "Ventas esperadas por fecha de cobro.",
        "Plazo medio real de cobro."
      ],
      MARKETING: [
        "Presupuesto comprometido.",
        "Tiempo de recuperación del CAC."
      ],
      OPERACIONES: [
        "Calendario de compras y pagos a proveedores."
      ],
      GENTE: [
        "Nómina total y fechas de pago."
      ],
      DIRECCION: [
        "Semanas de caja de supervivencia."
      ]
    },

    MARGEN_PRECIO: {
      FINANZAS: [
        "Costo unitario confiable.",
        "Margen de contribución por producto o servicio."
      ],
      VENTAS: [
        "Conversión y ticket por nivel de precio."
      ],
      MARKETING: [
        "Percepción de valor y CAC por segmento."
      ],
      OPERACIONES: [
        "Merma, reproceso y costo operativo real."
      ],
      GENTE: [
        "Costo laboral asociado a la entrega."
      ],
      DIRECCION: [
        "Causa cuantificada de la pérdida de margen."
      ]
    }
  };

  faltantes.push(
    ...(
      porTema[principal]
        ?.[departamento] || []
    )
  );

  return [...new Set(faltantes)]
    .slice(0, 10);
}

function objecionesPara({
  departamento,
  temas
}) {
  const principal =
    temaPrincipal(temas);

  const matriz = {
    FLUJO_CAJA: {
      FINANZAS: [
        "VENTAS: no tratar venta como caja hasta definir cuándo se cobra.",
        "MARKETING: no escalar presupuesto sin conocer recuperación del CAC."
      ],
      VENTAS: [
        "FINANZAS: una proyección sin supuestos comerciales de volumen, ticket y cobranza queda incompleta."
      ],
      MARKETING: [
        "VENTAS: más demanda no resuelve caja si la conversión o la cobranza son débiles."
      ],
      OPERACIONES: [
        "FINANZAS: la proyección debe incluir cuándo inventario y compras consumen efectivo."
      ],
      GENTE: [
        "DIRECCION: nómina fija nueva exige justificar capacidad y caja."
      ],
      DIRECCION: [
        "Toda función debe expresar su recomendación en impacto de caja y KPI antes de pasarla al Cerebro."
      ]
    },

    MARGEN_PRECIO: {
      FINANZAS: [
        "VENTAS: no aceptar descuentos que no conserven margen de contribución.",
        "OPERACIONES: validar merma y costos antes de atribuir todo el problema al precio."
      ],
      VENTAS: [
        "FINANZAS: subir precio sin observar conversión puede deteriorar ingresos totales."
      ],
      MARKETING: [
        "VENTAS: evitar competir únicamente por descuento cuando puede defenderse valor."
      ],
      OPERACIONES: [
        "FINANZAS: revisar costo operativo y merma antes de trasladar ineficiencia al cliente."
      ],
      GENTE: [
        "OPERACIONES: no convertir ineficiencia de proceso en sobrecarga permanente de personal."
      ],
      DIRECCION: [
        "No declarar causa raíz hasta separar precio, costo, mezcla, merma, productividad y valor percibido."
      ]
    }
  };

  return (
    matriz[principal]
      ?.[departamento] || []
  ).slice(0, 8);
}

function acuerdosPara({
  departamento,
  temas
}) {
  const principal =
    temaPrincipal(temas);

  if (principal === "FLUJO_CAJA") {
    const comunes = {
      FINANZAS: [
        "Con VENTAS: separar venta de cobro.",
        "Con OPERACIONES: calendarizar compras y pagos."
      ],
      VENTAS: [
        "Con FINANZAS: proyectar por fecha real de cobro."
      ],
      MARKETING: [
        "Con FINANZAS: condicionar presupuesto a recuperación económica."
      ],
      OPERACIONES: [
        "Con FINANZAS: tratar inventario como uso de caja."
      ],
      GENTE: [
        "Con FINANZAS: tratar nuevas contrataciones como compromisos recurrentes."
      ],
      DIRECCION: [
        "Con toda la Junta: la caja es una restricción compartida, no exclusiva de Finanzas."
      ]
    };

    return comunes[
      departamento
    ] || [];
  }

  return [];
}

function confianzaPara({
  intencion,
  reporte,
  temas
}) {
  if (intencion === "ARRANQUE") {
    return 85;
  }

  let confianza = reporte ? 70 : 40;

  if (
    temas.length > 0 &&
    !temas.includes("GENERAL")
  ) {
    confianza += 5;
  }

  const confianzas =
    (reporte?.hallazgos || [])
      .map((hallazgo) =>
        numero(hallazgo?.confianza)
      )
      .filter(Number.isFinite);

  if (confianzas.length) {
    const promedio =
      confianzas.reduce(
        (suma, valor) =>
          suma + valor,
        0
      ) / confianzas.length;

    confianza =
      Math.round(
        (confianza + promedio) / 2
      );
  }

  return Math.max(
    0,
    Math.min(100, confianza)
  );
}

function construirRespuestaExperta({
  departamento,
  pregunta,
  intencion,
  temas,
  reportes,
  intervenciones
}) {
  const perfil =
    PERFILES_EXPERTOS[departamento];

  const reporte =
    reportePorDepartamento(
      reportes,
      departamento
    );

  const memoria =
    extraerMemoriaHumana(
      intervenciones
    );

  const evidencias =
    intencion === "ARRANQUE"
      ? []
      : hechosReporte(reporte);

  let respuesta =
    playbookPara({
      departamento,
      intencion,
      temas
    });

  if (
    intencion !== "ARRANQUE" &&
    reporte
  ) {
    respuesta +=
      ` El reporte vigente de ${departamento} marca ${reporte.kpi_principal?.estado || "SIN_ESTADO"} en ${reporte.kpi_principal?.nombre || "su KPI principal"}.`;
  }

  if (
    intencion !== "ARRANQUE" &&
    memoria.length
  ) {
    respuesta +=
      " Hay intervenciones humanas previas, pero se mantienen como contexto y no se convierten automáticamente en hechos calculados por GRUK.";
  }

  const criterios =
    perfil.principios.slice(0, 3);

  return {
    departamento,
    respuesta:
      `${departamento}: ${respuesta}`,
    criterio_profesional:
      `${perfil.cargo}. ${perfil.preguntaCentral} Principios aplicados: ${criterios.join(" ")}`,
    evidencia_usada: evidencias,
    inferencias:
      intencion === "ARRANQUE"
        ? [
            "La pregunta plantea un escenario desde cero; estas conclusiones son criterios de diseño empresarial y no describen resultados históricos."
          ]
        : [
            "Los datos disponibles orientan el diagnóstico, pero no prueban por sí solos una causa raíz."
          ],
    riesgos:
      riesgosPara({
        departamento,
        temas,
        reporte
      }),
    objeciones:
      objecionesPara({
        departamento,
        temas
      }),
    acuerdos:
      acuerdosPara({
        departamento,
        temas
      }),
    datos_faltantes:
      datosFaltantesPara({
        departamento,
        intencion,
        temas,
        reporte
      }),
    confianza:
      confianzaPara({
        intencion,
        reporte,
        temas
      })
  };
}

function sintetizarDireccion(
  respuestas,
  {
    intencion,
    temas
  }
) {
  const direccion =
    respuestas.find(
      (respuesta) =>
        respuesta.departamento ===
        "DIRECCION"
    );

  if (!direccion) return;

  const faltantes =
    respuestas
      .flatMap(
        (respuesta) =>
          respuesta.datos_faltantes || []
      )
      .filter(Boolean);

  const riesgos =
    respuestas
      .flatMap(
        (respuesta) =>
          respuesta.riesgos || []
      )
      .filter(Boolean);

  if (intencion !== "ARRANQUE") {
    const principal =
      temaPrincipal(temas);

    direccion.respuesta +=
      ` Como síntesis de Junta, el tema dominante es ${principal}. Antes de que el Cerebro convierta esto en órdenes, deben cerrarse los datos que puedan cambiar materialmente la decisión.`;
  }

  direccion.datos_faltantes =
    [...new Set([
      ...direccion.datos_faltantes,
      ...faltantes
    ])].slice(0, 10);

  direccion.riesgos =
    [...new Set([
      ...direccion.riesgos,
      ...riesgos
    ])].slice(0, 8);
}

function validarRespuestas(respuestas) {
  if (!Array.isArray(respuestas)) {
    throw new Error(
      "JUNTA_RESPUESTAS_INCOMPLETAS"
    );
  }

  const porDepartamento =
    new Map();

  for (const respuesta of respuestas) {
    if (
      !DEPARTAMENTOS_EXPERTOS.includes(
        respuesta?.departamento
      ) ||
      !respuesta?.respuesta ||
      !respuesta?.criterio_profesional ||
      porDepartamento.has(
        respuesta.departamento
      )
    ) {
      throw new Error(
        "JUNTA_RESPUESTAS_INCOMPLETAS"
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
    throw new Error(
      "JUNTA_RESPUESTAS_INCOMPLETAS"
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
  intervenciones
}) {
  const intencion =
    clasificarIntencion(pregunta);

  const temas =
    intencion === "ARRANQUE"
      ? detectarTemas(pregunta)
      : detectarTemas(pregunta);

  const respuestas =
    DEPARTAMENTOS_EXPERTOS.map(
      (departamento) =>
        construirRespuestaExperta({
          departamento,
          pregunta,
          intencion,
          temas,
          reportes,
          intervenciones
        })
    );

  sintetizarDireccion(
    respuestas,
    {
      intencion,
      temas
    }
  );

  return {
    model: "GRUK-CONSULTIVO-2",
    responseId: null,
    intencion,
    temas,
    respuestas:
      validarRespuestas(respuestas)
  };
}

module.exports = {
  DEPARTAMENTOS_EXPERTOS,
  CONOCIMIENTO,
  clasificarIntencion,
  detectarTemas,
  construirContexto,
  validarRespuestas,
  generarRespuestasExpertas,
  extraerMemoriaHumana
};
