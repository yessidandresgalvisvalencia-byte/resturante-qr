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

function convertirMontoHumano(valor, unidad) {
  const base = Number(
    String(valor || "")
      .replace(/\./g, "")
      .replace(",", ".")
  );

  if (!Number.isFinite(base)) return null;

  const u = normalizar(unidad);

  if (u === "mil" || u === "k") {
    return base * 1000;
  }

  if (
    u === "millon" ||
    u === "millones" ||
    u === "m"
  ) {
    return base * 1000000;
  }

  return base;
}

function extraerHechosHumanos(pregunta) {
  const original = String(pregunta || "").trim();
  const texto = normalizar(original);
  const hechos = [];

  const hablaDeVenta =
    /\b(venta|vendi|vendimos|facture|facturamos)\b/.test(texto);

  if (hablaDeVenta) {
    const montoMatch = texto.match(
      /(?:mas\s+de|más\s+de|aprox(?:imadamente)?|cerca\s+de|por|de)?\s*\$?\s*(\d+(?:[.,]\d+)?)\s*(mil|k|millones?|m)?\s*(?:pesos|cop)?/i
    );

    if (montoMatch) {
      const monto = convertirMontoHumano(
        montoMatch[1],
        montoMatch[2]
      );

      if (
        monto !== null &&
        monto >= 1000
      ) {
        const comparador =
          /mas\s+de|más\s+de/.test(texto)
            ? "MAYOR_QUE"
            : "APROXIMADO";

        const momento =
          /\bhoy\b/.test(texto)
            ? "HOY"
            : /\bayer\b/.test(texto)
              ? "AYER"
              : "NO_ESPECIFICADO";

        hechos.push({
          tipo: "VENTA_REPORTADA",
          fuente: "USUARIO",
          monto_cop: monto,
          comparador,
          momento,
          texto: limitarTexto(original, 500)
        });
      }
    }
  }

  return hechos;
}

function formatearCOP(valor) {
  const n = numero(valor);

  if (n === null) {
    return "sin monto verificable";
  }

  return "$" + new Intl.NumberFormat(
    "es-CO",
    { maximumFractionDigits: 0 }
  ).format(n);
}

function eventoVentaReportada(hechosHumanos) {
  return (hechosHumanos || []).find(
    (hecho) =>
      hecho.tipo === "VENTA_REPORTADA"
  ) || null;
}

function contextoVentaReportada({
  evento,
  reportes
}) {
  if (!evento) return null;

  const ventas =
    reportePorDepartamento(
      reportes,
      "VENTAS"
    );

  const ticket =
    numero(
      ventas?.kpi_principal?.nombre === "ticket_promedio"
        ? ventas.kpi_principal.valor_actual
        : null
    );

  const relacionMinima =
    ticket && ticket > 0
      ? evento.monto_cop / ticket
      : null;

  return {
    evento,
    ticket_promedio: ticket,
    relacion_minima_ticket:
      relacionMinima
  };
}

function respuestaEventoVenta({
  departamento,
  eventoContexto,
  reportes
}) {
  if (!eventoContexto) return null;

  const {
    evento,
    ticket_promedio,
    relacion_minima_ticket
  } = eventoContexto;

  const montoTexto =
    evento.comparador === "MAYOR_QUE"
      ? "más de " + formatearCOP(evento.monto_cop)
      : "aproximadamente " + formatearCOP(evento.monto_cop);

  const comparacion =
    relacion_minima_ticket
      ? ` Eso equivale a por lo menos ${relacion_minima_ticket.toFixed(1)} veces el ticket promedio que GRUK tiene hoy (${formatearCOP(ticket_promedio)}).`
      : "";

  const evidenciaBase = [
    `DATO_USUARIO: reportaste una venta de ${montoTexto}${evento.momento === "HOY" ? " hoy" : ""}.`
  ];

  if (ticket_promedio) {
    evidenciaBase.push(
      `DATO_GRUK: ticket promedio actual ${formatearCOP(ticket_promedio)}.`
    );
  }

  const finanzas =
    reportePorDepartamento(
      reportes,
      "FINANZAS"
    );

  if (departamento === "FINANZAS") {
    return {
      respuesta:
        `Eso sí es un dato útil. Si fue una sola venta de ${montoTexto}, primero separaría tres cosas: venta, cobro y margen.${comparacion} Que sea un ticket grande es positivo comercialmente, pero todavía no puedo llamarlo buen negocio hasta saber cuánto quedó realmente en caja y cuánto costó producir o entregar esa venta.`,
      criterio_profesional:
        "Una transacción grande merece análisis de contribución, no celebración automática. Quiero saber si se cobró, qué costo directo tuvo y cuánto margen dejó.",
      evidencia_usada: [
        ...evidenciaBase,
        ...hechosReporte(finanzas).filter(
          (item) =>
            /margen|costo|confiable/i.test(item)
        )
      ].slice(0, 6),
      inferencias: [
        relacion_minima_ticket
          ? `Si el dato humano corresponde a una sola transacción comparable, su valor es al menos ${relacion_minima_ticket.toFixed(1)} veces el ticket promedio actual.`
          : "La venta reportada parece material, pero falta compararla con ticket y margen confiables."
      ],
      riesgos: [
        "Confundir una venta grande con caja disponible si todavía no fue cobrada.",
        "Repetir una venta aparentemente atractiva sin conocer su costo y margen real."
      ],
      objeciones: [
        "VENTAS: no llamaría esto un patrón todavía; primero necesitamos comprobar margen y cobro."
      ],
      acuerdos: [
        "Con VENTAS: vale la pena reconstruir esta transacción porque se aparta del comportamiento promedio."
      ],
      datos_faltantes: [
        "¿La venta ya fue cobrada y por qué medio?",
        "¿Qué productos o servicios incluyó?",
        "¿Cuál fue el costo directo confiable de esa venta?"
      ],
      confianza: ticket_promedio ? 82 : 72
    };
  }

  if (departamento === "VENTAS") {
    return {
      respuesta:
        `Esta venta sí merece que la estudiemos.${comparacion} No me interesa solo que haya sido grande: quiero saber por qué ese cliente compró tanto. Si entendemos qué compró, quién era, qué necesidad tenía y cómo llegó, podemos descubrir un paquete, segmento o comportamiento que aumente ticket de forma repetible.`,
      criterio_profesional:
        "Una venta excepcional es una pista comercial. El trabajo del área es desmontarla y encontrar qué parte fue reproducible y qué parte fue casualidad.",
      evidencia_usada: evidenciaBase,
      inferencias: [
        relacion_minima_ticket
          ? `La transacción reportada está al menos ${relacion_minima_ticket.toFixed(1)} veces por encima del ticket promedio actual.`
          : "La transacción reportada puede ser un caso de ticket alto que conviene reconstruir."
      ],
      riesgos: [
        "Asumir que una sola venta excepcional representa demanda repetible.",
        "Intentar copiar el valor del ticket sin entender qué motivó la compra."
      ],
      objeciones: [
        "FINANZAS: estoy de acuerdo en validar margen, pero no esperaría para investigar qué hizo distinta esta venta."
      ],
      acuerdos: [
        "Con MARKETING: necesitamos saber de dónde llegó este cliente.",
        "Con OPERACIONES: necesitamos identificar exactamente qué combinación se vendió."
      ],
      datos_faltantes: [
        "¿Era cliente nuevo o recurrente?",
        "¿Qué compró exactamente?",
        "¿Por qué canal llegó?",
        "¿Hubo descuento o venta sugerida?"
      ],
      confianza: ticket_promedio ? 88 : 76
    };
  }

  if (departamento === "MARKETING") {
    return {
      respuesta:
        `Yo no pediría presupuesto todavía; pediría trazabilidad. Una venta de ${montoTexto} puede enseñarnos mucho si sabemos de dónde salió el cliente. Si vino por recomendación, Instagram, ubicación, búsqueda, campaña o cliente recurrente, eso cambia por completo lo que deberíamos intentar repetir.`,
      criterio_profesional:
        "El valor de esta venta para Marketing no es el monto aislado sino descubrir el origen de una demanda de alto valor y si puede adquirirse de forma rentable.",
      evidencia_usada: evidenciaBase,
      inferencias: [
        "La venta reportada es un caso candidato para atribución de canal; todavía no prueba que ningún canal sea rentable."
      ],
      riesgos: [
        "Asignar el éxito a un canal sin evidencia de atribución.",
        "Escalar publicidad a partir de una sola transacción."
      ],
      objeciones: [
        "VENTAS: antes de llamar esto un segmento repetible necesitamos conocer el origen del cliente."
      ],
      acuerdos: [
        "Con VENTAS: reconstruir el recorrido del cliente antes de intentar replicar la venta."
      ],
      datos_faltantes: [
        "¿Cómo conoció el cliente el negocio?",
        "¿Era nuevo o recurrente?",
        "¿Hubo campaña, recomendación o acción comercial asociada?"
      ],
      confianza: 76
    };
  }

  if (departamento === "OPERACIONES") {
    return {
      respuesta:
        `A mí me interesa qué tuvo que hacer la operación para entregar esa venta de ${montoTexto}. Si fue un pedido grande pero salió rápido, sin quiebres, sin merma extra y con buena calidad, tenemos una señal de capacidad. Si obligó a improvisar compras, retrasó otros pedidos o consumió inventario crítico, el ticket alto puede esconder costo operativo.`,
      criterio_profesional:
        "Una venta grande debe analizarse también como consumo de capacidad. El tamaño del ticket no basta para saber si la operación la soportó bien.",
      evidencia_usada: evidenciaBase,
      inferencias: [
        "La transacción puede revelar una combinación de productos de alto valor o un cuello de botella operativo; todavía no sabemos cuál."
      ],
      riesgos: [
        "Intentar repetir tickets grandes sin conocer capacidad, inventario y tiempo de servicio.",
        "Ocultar merma o sobrecosto dentro de una venta de alto valor."
      ],
      objeciones: [
        "VENTAS: antes de promover ese mismo paquete, confirmemos que podemos entregarlo de manera repetible."
      ],
      acuerdos: [
        "Con FINANZAS: necesitamos costo directo confiable de la transacción."
      ],
      datos_faltantes: [
        "¿Qué productos o servicios incluyó?",
        "¿Cuánto tiempo y capacidad consumió?",
        "¿Hubo faltantes, merma o compras extraordinarias?"
      ],
      confianza: 74
    };
  }

  if (departamento === "GENTE") {
    return {
      respuesta:
        "Esta venta, por sí sola, no me da evidencia para contratar ni cambiar estructura. Sería un error convertir una buena transacción en una conclusión sobre personal. Si este tipo de venta empieza a repetirse y crea sobrecarga medible, entonces sí revisamos capacidad, responsabilidades y productividad.",
      criterio_profesional:
        "Una señal comercial aislada no justifica una decisión de plantilla. Gente entra cuando existe evidencia de carga recurrente o una función crítica sin responsable.",
      evidencia_usada: evidenciaBase,
      inferencias: [
        "No hay evidencia suficiente para concluir que esta venta cambie la necesidad de personal."
      ],
      riesgos: [
        "Aumentar nómina fija por una señal comercial todavía no repetida."
      ],
      objeciones: [],
      acuerdos: [
        "Con OPERACIONES: primero medir si ventas de este tamaño generan carga recurrente."
      ],
      datos_faltantes: [],
      confianza: 90
    };
  }

  if (departamento === "DIRECCION") {
    return {
      respuesta:
        `Este es el tipo de dato que sí debe cambiar la conversación.${comparacion} No lo convertiría todavía en estrategia, pero sí en un caso que vale la pena desmontar. La pregunta de Dirección ya no es “¿vendimos bien hoy?”, sino “¿qué hizo posible esta venta y podemos repetirlo manteniendo margen, caja y capacidad?”.`,
      criterio_profesional:
        "Una transacción muy superior al comportamiento habitual puede ser una señal estratégica, pero solo después de separar casualidad, margen, origen del cliente y capacidad de repetición.",
      evidencia_usada: evidenciaBase,
      inferencias: [
        relacion_minima_ticket
          ? `La venta reportada es material frente al ticket promedio: al menos ${relacion_minima_ticket.toFixed(1)} veces su valor actual.`
          : "La venta reportada merece análisis como caso de alto valor."
      ],
      riesgos: [
        "Construir una estrategia alrededor de una sola transacción.",
        "Celebrar facturación sin comprobar margen, cobro y repetibilidad."
      ],
      objeciones: [
        "Ningún departamento debe usar esta venta como prueba de una causa que todavía no está demostrada."
      ],
      acuerdos: [
        "La Junta debe reconstruir esta venta desde cliente, canal, mezcla, costo y operación antes de proponer cómo repetirla."
      ],
      datos_faltantes: [
        "Qué compró exactamente.",
        "Si ya fue cobrada.",
        "Qué margen dejó.",
        "Cómo llegó el cliente.",
        "Si era cliente nuevo o recurrente."
      ],
      confianza: ticket_promedio ? 86 : 78
    };
  }

  return null;
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
    hechos_humanos:
      extraerHechosHumanos(pregunta),
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
  intervenciones,
  hechosHumanos
}) {
  const perfil =
    PERFILES_EXPERTOS[departamento];

  const ventaReportada =
    eventoVentaReportada(hechosHumanos);

  if (ventaReportada) {
    const contextual =
      respuestaEventoVenta({
        departamento,
        eventoContexto:
          contextoVentaReportada({
            evento: ventaReportada,
            reportes
          }),
        reportes
      });

    if (contextual) {
      return {
        departamento,
        ...contextual
      };
    }
  }

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
    detectarTemas(pregunta);

  const hechosHumanos =
    extraerHechosHumanos(pregunta);

  const respuestas =
    DEPARTAMENTOS_EXPERTOS.map(
      (departamento) =>
        construirRespuestaExperta({
          departamento,
          pregunta,
          intencion,
          temas,
          reportes,
          intervenciones,
          hechosHumanos
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
    hechosHumanos,
    respuestas:
      validarRespuestas(respuestas)
  };
}

module.exports = {
  DEPARTAMENTOS_EXPERTOS,
  CONOCIMIENTO,
  clasificarIntencion,
  detectarTemas,
  extraerHechosHumanos,
  construirContexto,
  validarRespuestas,
  generarRespuestasExpertas,
  extraerMemoriaHumana
};
