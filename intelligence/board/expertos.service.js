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

function extraerMontoDesdeTexto(texto) {
  const match = String(texto || "").match(
    /(?:mas\s+de|aprox(?:imadamente)?|cerca\s+de|por|de|fueron|fue|son)?\s*\$?\s*(\d+(?:[.,]\d+)?)\s*(mil|k|millones?|m)?\s*(?:pesos|cop)?/i
  );

  if (!match) return null;

  const monto = convertirMontoHumano(
    match[1],
    match[2]
  );

  return monto !== null && monto >= 1000
    ? monto
    : null;
}

function extraerCantidadHumana(texto) {
  const mapa = {
    uno: 1,
    una: 1,
    un: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    seis: 6,
    siete: 7,
    ocho: 8,
    nueve: 9,
    diez: 10
  };

  const match = normalizar(texto).match(
    /\b(\d+|uno|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/
  );

  if (!match) return null;

  if (/^\d+$/.test(match[1])) {
    return Number(match[1]);
  }

  return mapa[match[1]] || null;
}

function momentoHumano(texto) {
  const t = normalizar(texto);

  if (/\bhoy\b/.test(t)) return "HOY";
  if (/\bayer\b/.test(t)) return "AYER";

  return "NO_ESPECIFICADO";
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

  const hablaDeGasto =
    /\b(gaste|gastamos|pague|pagamos|compre|compramos|inverti|invertimos)\b/.test(texto);

  if (hablaDeGasto) {
    const monto = extraerMontoDesdeTexto(texto);

    if (monto !== null) {
      hechos.push({
        tipo: "GASTO_REPORTADO",
        fuente: "USUARIO",
        monto_cop: monto,
        momento: momentoHumano(texto),
        categoria_sugerida:
          /publicidad|instagram|facebook|marketing|campana/.test(texto)
            ? "MARKETING"
            : /nomina|empleado|salario|sueldo/.test(texto)
              ? "GENTE"
              : /proveedor|insumo|inventario|materia prima|pollo|carne|bebida/.test(texto)
                ? "OPERACIONES"
                : "NO_CLASIFICADA",
        texto: limitarTexto(original, 500)
      });
    }
  }

  const salidaPersonal =
    /(?:se me fueron|se fueron|renunciaron|renuncio|despedi|despedimos|salieron)\b/.test(texto) &&
    /\b(emplead|persona|trabajador|mesero|cocinero|vendedor)/.test(texto);

  if (salidaPersonal) {
    hechos.push({
      tipo: "SALIDA_PERSONAL_REPORTADA",
      fuente: "USUARIO",
      cantidad:
        extraerCantidadHumana(texto),
      momento: momentoHumano(texto),
      texto: limitarTexto(original, 500)
    });
  }

  const quejaCliente =
    /\b(cliente|clientes)\b/.test(texto) &&
    /\b(quej|reclam|molest|devolu|inconforme|mal servicio)/.test(texto);

  if (quejaCliente) {
    hechos.push({
      tipo: "QUEJA_CLIENTE_REPORTADA",
      fuente: "USUARIO",
      momento: momentoHumano(texto),
      texto: limitarTexto(original, 500)
    });
  }

  const agotado =
    /\b(sin inventario|sin stock|agotad|se me acabo|se acabo|no tengo existencias)\b/.test(texto);

  if (agotado) {
    hechos.push({
      tipo: "QUIEBRE_INVENTARIO_REPORTADO",
      fuente: "USUARIO",
      momento: momentoHumano(texto),
      texto: limitarTexto(original, 500)
    });
  }

  const cambioPrecio =
    /\b(subi|subimos|aumente|aumentamos|baje|bajamos|reduje|redujimos)\b/.test(texto) &&
    /\b(precio|precios)\b/.test(texto);

  if (cambioPrecio) {
    const porcentajeMatch =
      texto.match(/(\d+(?:[.,]\d+)?)\s*%/);

    hechos.push({
      tipo: "CAMBIO_PRECIO_REPORTADO",
      fuente: "USUARIO",
      direccion:
        /\b(subi|subimos|aumente|aumentamos)\b/.test(texto)
          ? "SUBE"
          : "BAJA",
      porcentaje:
        porcentajeMatch
          ? Number(
              porcentajeMatch[1]
                .replace(",", ".")
            )
          : null,
      momento: momentoHumano(texto),
      texto: limitarTexto(original, 500)
    });
  }

  return hechos;
}

function extraerAtributosSeguimiento(textoEntrada) {
  const texto = normalizar(textoEntrada);
  const atributos = {};

  if (
    /\b(ya me pago|ya pago|ya la cobre|ya cobre|me pagaron|quedo pagad|pago completo)\b/.test(texto)
  ) {
    atributos.estado_cobro = "COBRADA";
  } else if (
    /\b(no me ha pagado|no ha pagado|quedo debiendo|a credito|fiado|pendiente de pago)\b/.test(texto)
  ) {
    atributos.estado_cobro = "PENDIENTE";
  }

  if (/\befectivo\b/.test(texto)) {
    atributos.medio_pago = "EFECTIVO";
  } else if (/\b(tarjeta|dataphone|datafono)\b/.test(texto)) {
    atributos.medio_pago = "TARJETA";
  } else if (/\b(transferencia|transferi)\b/.test(texto)) {
    atributos.medio_pago = "TRANSFERENCIA";
  } else if (/\bnequi\b/.test(texto)) {
    atributos.medio_pago = "NEQUI";
  } else if (/\bdaviplata\b/.test(texto)) {
    atributos.medio_pago = "DAVIPLATA";
  }

  if (
    /\b(cliente nuevo|era nuevo|primera vez|nunca habia venido)\b/.test(texto)
  ) {
    atributos.tipo_cliente = "NUEVO";
  } else if (
    /\b(cliente recurrente|era recurrente|ya habia venido|cliente de siempre|cliente frecuente)\b/.test(texto)
  ) {
    atributos.tipo_cliente = "RECURRENTE";
  }

  if (/\binstagram\b/.test(texto)) {
    atributos.canal_origen = "INSTAGRAM";
  } else if (/\bfacebook\b/.test(texto)) {
    atributos.canal_origen = "FACEBOOK";
  } else if (/\bwhatsapp\b/.test(texto)) {
    atributos.canal_origen = "WHATSAPP";
  } else if (/\bgoogle\b/.test(texto)) {
    atributos.canal_origen = "GOOGLE";
  } else if (/\b(recomendacion|recomendado|referido)\b/.test(texto)) {
    atributos.canal_origen = "RECOMENDACION";
  } else if (/\b(paso por|pasaba por|vio el local)\b/.test(texto)) {
    atributos.canal_origen = "TRAFICO_LOCAL";
  }

  if (/\b(con descuento|le di descuento|descuento)\b/.test(texto)) {
    atributos.hubo_descuento = true;
  }

  return atributos;
}

function enriquecerHecho(hecho, atributos) {
  return {
    ...hecho,
    ...Object.fromEntries(
      Object.entries(atributos || {})
        .filter(([, valor]) =>
          valor !== null &&
          valor !== undefined
        )
    )
  };
}

function extraerHechosConversacion(
  pregunta,
  intervenciones
) {
  const humanos =
    (intervenciones || [])
      .filter((item) =>
        item.tipo === "HUMANO"
      )
      .map((item) =>
        String(item.mensaje || "").trim()
      )
      .filter(Boolean);

  const actual =
    String(pregunta || "").trim();

  if (
    actual &&
    humanos.at(-1) !== actual
  ) {
    humanos.push(actual);
  }

  for (
    let i = humanos.length - 1;
    i >= 0;
    i -= 1
  ) {
    const hechosBase =
      extraerHechosHumanos(
        humanos[i]
      );

    if (!hechosBase.length) {
      continue;
    }

    const atributos = {};

    for (
      let j = i;
      j < humanos.length;
      j += 1
    ) {
      Object.assign(
        atributos,
        extraerAtributosSeguimiento(
          humanos[j]
        )
      );
    }

    return hechosBase.map(
      (hecho) =>
        enriquecerHecho(
          hecho,
          atributos
        )
    );
  }

  return extraerHechosHumanos(actual);
}

function etiquetaDatoHecho(hecho) {
  return hecho?.fuente === "GRUK"
    ? "DATO_GRUK"
    : "DATO_USUARIO";
}

function descripcionSeguimientoVenta(evento) {
  const partes = [];

  const datoGruk =
    evento.fuente === "GRUK";

  if (evento.estado_cobro === "COBRADA") {
    partes.push(
      datoGruk
        ? "GRUK confirma que la venta ya fue cobrada"
        : "confirmaste que la venta ya fue cobrada"
    );
  } else if (evento.estado_cobro === "PENDIENTE") {
    partes.push(
      datoGruk
        ? "GRUK confirma que el cobro sigue pendiente"
        : "confirmaste que el cobro sigue pendiente"
    );
  }

  if (evento.medio_pago) {
    partes.push(
      `medio de pago: ${evento.medio_pago.toLowerCase()}`
    );
  }

  if (evento.tipo_cliente) {
    partes.push(
      `cliente ${evento.tipo_cliente.toLowerCase()}`
    );
  }

  if (evento.canal_origen) {
    partes.push(
      `origen: ${evento.canal_origen.toLowerCase()}`
    );
  }

  if (evento.hubo_descuento) {
    partes.push("hubo descuento");
  }

  return partes;
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

  const etiquetaDato =
    etiquetaDatoHecho(evento);

  const evidenciaBase = [
    evento.fuente === "GRUK"
      ? `${etiquetaDato}: GRUK registro una venta de ${montoTexto}${evento.momento === "HOY" ? " hoy" : ""}.`
      : `${etiquetaDato}: reportaste una venta de ${montoTexto}${evento.momento === "HOY" ? " hoy" : ""}.`
  ];

  for (const detalle of descripcionSeguimientoVenta(evento)) {
    evidenciaBase.push(
      `${etiquetaDato}: ${detalle}.`
    );
  }

  if (ticket_promedio) {
    evidenciaBase.push(
      `DATO_GRUK: ticket promedio actual ${formatearCOP(ticket_promedio)}.`
    );
  }

  const estadoCobro =
    evento.estado_cobro === "COBRADA"
      ? "La primera duda ya quedó resuelta: esa venta sí se convirtió en caja."
      : evento.estado_cobro === "PENDIENTE"
        ? "Todavía no la trataría como caja: confirmaste que el cobro sigue pendiente."
        : "Todavía necesito separar venta de cobro: no sabemos si ese dinero ya entró realmente a caja.";

  const detalleCliente =
    evento.tipo_cliente
      ? ` Ya sabemos además que era un cliente ${evento.tipo_cliente.toLowerCase()}.`
      : "";

  const detalleCanal =
    evento.canal_origen
      ? ` El origen reportado fue ${evento.canal_origen.toLowerCase()}.`
      : "";

  const finanzas =
    reportePorDepartamento(
      reportes,
      "FINANZAS"
    );

  if (departamento === "FINANZAS") {
    return {
      respuesta:
        `Eso sí es un dato útil. Si fue una sola venta de ${montoTexto}, primero separaría tres cosas: venta, cobro y margen.${comparacion} ${estadoCobro} Que sea un ticket grande es positivo comercialmente, pero todavía no puedo llamarlo buen negocio hasta saber cuánto costó producir o entregar esa venta.`,
      criterio_profesional:
        "Una transacción grande merece análisis de contribución, no celebración automática. Quiero saber si se cobró, qué costo directo tuvo y cuánto margen dejó.",
      evidencia_usada: [
        ...evidenciaBase,
        ...hechosReporte(finanzas).filter(
          (item) =>
            /proyeccion|obligacion|cobro|tesoreria|caja|flujo|margen|costo|confiable/i.test(item)
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
        ...(evento.estado_cobro
          ? []
          : ["¿La venta ya fue cobrada?"]),
        ...(evento.medio_pago
          ? []
          : ["¿Por qué medio se pagó o se pagará?"]),
        "¿Qué productos o servicios incluyó?",
        "¿Cuál fue el costo directo confiable de esa venta?"
      ],
      confianza: ticket_promedio ? 82 : 72,
      relevancia: "ALTA"
    };
  }

  if (departamento === "VENTAS") {
    return {
      respuesta:
        `Esta venta sí merece que la estudiemos.${comparacion}${detalleCliente}${detalleCanal} No me interesa solo que haya sido grande: quiero saber por qué ese cliente compró tanto. Si entendemos qué compró, qué necesidad tenía y qué parte del proceso hizo posible ese ticket, podemos descubrir un paquete, segmento o comportamiento repetible.`,
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
        ...(evento.tipo_cliente
          ? []
          : ["¿Era cliente nuevo o recurrente?"]),
        "¿Qué compró exactamente?",
        ...(evento.canal_origen
          ? []
          : ["¿Por qué canal llegó?"]),
        ...(evento.hubo_descuento
          ? []
          : ["¿Hubo descuento o venta sugerida?"])
      ],
      confianza: ticket_promedio ? 88 : 76,
      relevancia: "ALTA"
    };
  }

  if (departamento === "MARKETING") {
    return {
      respuesta:
        evento.canal_origen
          ? `Ya tenemos una pista importante: el origen reportado fue ${evento.canal_origen.toLowerCase()}. No significa todavía que ese canal sea rentable, pero ahora sí podemos buscar si otros clientes de alto valor llegaron por la misma vía y cuánto costó conseguirlos.`
          : `Yo no pediría presupuesto todavía; pediría trazabilidad. Una venta de ${montoTexto} puede enseñarnos mucho si sabemos de dónde salió el cliente. Si vino por recomendación, Instagram, ubicación, búsqueda o campaña, eso cambia por completo lo que deberíamos intentar repetir.`,
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
        ...(evento.canal_origen
          ? []
          : ["¿Cómo conoció el cliente el negocio?"]),
        ...(evento.tipo_cliente
          ? []
          : ["¿Era nuevo o recurrente?"]),
        "¿Hubo campaña, recomendación o acción comercial asociada?"
      ],
      confianza: 76,
      relevancia: "MEDIA"
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
      confianza: 74,
      relevancia: "MEDIA"
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
      confianza: 90,
      relevancia: "BAJA"
    };
  }

  if (departamento === "DIRECCION") {
    return {
      respuesta:
        `Este es el tipo de dato que sí debe cambiar la conversación.${comparacion}${detalleCliente}${detalleCanal} ${estadoCobro} No lo convertiría todavía en estrategia, pero sí en un caso que vale la pena desmontar. La pregunta de Dirección ya no es “¿vendimos bien hoy?”, sino “¿qué hizo posible esta venta y podemos repetirlo manteniendo margen, caja y capacidad?”.`,
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
        ...(evento.estado_cobro
          ? []
          : ["Si ya fue cobrada."]),
        "Qué margen dejó.",
        ...(evento.canal_origen
          ? []
          : ["Cómo llegó el cliente."]),
        ...(evento.tipo_cliente
          ? []
          : ["Si era cliente nuevo o recurrente."])
      ],
      confianza: ticket_promedio ? 86 : 78,
      relevancia: "ALTA"
    };
  }

  return null;
}


const RELEVANCIA_EVENTO = Object.freeze({
  VENTA_REPORTADA: {
    FINANZAS: "ALTA",
    VENTAS: "ALTA",
    MARKETING: "MEDIA",
    OPERACIONES: "MEDIA",
    GENTE: "BAJA",
    DIRECCION: "ALTA"
  },
  GASTO_REPORTADO: {
    FINANZAS: "ALTA",
    VENTAS: "BAJA",
    MARKETING: "BAJA",
    OPERACIONES: "MEDIA",
    GENTE: "BAJA",
    DIRECCION: "ALTA"
  },
  SALIDA_PERSONAL_REPORTADA: {
    FINANZAS: "MEDIA",
    VENTAS: "BAJA",
    MARKETING: "NINGUNA",
    OPERACIONES: "ALTA",
    GENTE: "ALTA",
    DIRECCION: "ALTA"
  },
  QUEJA_CLIENTE_REPORTADA: {
    FINANZAS: "MEDIA",
    VENTAS: "MEDIA",
    MARKETING: "MEDIA",
    OPERACIONES: "ALTA",
    GENTE: "MEDIA",
    DIRECCION: "ALTA"
  },
  QUIEBRE_INVENTARIO_REPORTADO: {
    FINANZAS: "ALTA",
    VENTAS: "MEDIA",
    MARKETING: "BAJA",
    OPERACIONES: "ALTA",
    GENTE: "BAJA",
    DIRECCION: "ALTA"
  },
  CAMBIO_PRECIO_REPORTADO: {
    FINANZAS: "ALTA",
    VENTAS: "ALTA",
    MARKETING: "ALTA",
    OPERACIONES: "MEDIA",
    GENTE: "NINGUNA",
    DIRECCION: "ALTA"
  }
});

function relevanciaEvento(tipo, departamento) {
  return RELEVANCIA_EVENTO[tipo]?.[departamento] || "BAJA";
}

function hechoConversacionalPrincipal(hechosHumanos) {
  const prioridad = [
    "VENTA_REPORTADA",
    "GASTO_REPORTADO",
    "SALIDA_PERSONAL_REPORTADA",
    "QUEJA_CLIENTE_REPORTADA",
    "QUIEBRE_INVENTARIO_REPORTADO",
    "CAMBIO_PRECIO_REPORTADO"
  ];

  for (const tipo of prioridad) {
    const encontrado = (hechosHumanos || []).find(
      (hecho) => hecho.tipo === tipo
    );

    if (encontrado) return encontrado;
  }

  return null;
}

function respuestaSinAporteMaterial({
  departamento,
  hecho
}) {
  const etiqueta = {
    GASTO_REPORTADO: "este gasto",
    SALIDA_PERSONAL_REPORTADA: "esta salida de personal",
    QUEJA_CLIENTE_REPORTADA: "esta queja",
    QUIEBRE_INVENTARIO_REPORTADO: "este quiebre de inventario",
    CAMBIO_PRECIO_REPORTADO: "este cambio de precio"
  }[hecho.tipo] || "este hecho";

  return {
    respuesta:
      `No veo una conclusión material desde ${departamento} solo con ${etiqueta}. Prefiero no rellenar la Junta con una opinión que no cambia la decisión.`,
    criterio_profesional:
      "Cuando una función no tiene evidencia suficiente o impacto directo, su mejor aporte es declarar el límite y no fabricar relevancia.",
    evidencia_usada: [
      `${etiquetaDatoHecho(hecho)}: ${limitarTexto(hecho.texto, 400)}`
    ],
    inferencias: [],
    riesgos: [],
    objeciones: [],
    acuerdos: [],
    datos_faltantes: [],
    confianza: 95,
    relevancia: "NINGUNA"
  };
}

function respuestaEventoGeneral({
  departamento,
  hecho,
  reportes = []
}) {
  if (!hecho) return null;

  const relevancia =
    relevanciaEvento(
      hecho.tipo,
      departamento
    );

  if (relevancia === "NINGUNA") {
    return respuestaSinAporteMaterial({
      departamento,
      hecho
    });
  }

  const dato = [
    `${etiquetaDatoHecho(hecho)}: ${limitarTexto(hecho.texto, 450)}`
  ];

  const reporte =
    reportePorDepartamento(
      reportes,
      departamento
    );

  const evidenciasReporte =
    hechosReporte(reporte);

  if (hecho.tipo === "GASTO_REPORTADO") {
    const monto = formatearCOP(hecho.monto_cop);
    const categoria = hecho.categoria_sugerida;

    const porDepartamento = {
      FINANZAS: {
        respuesta:
          `Ese gasto de ${monto} no lo juzgaría solo por el monto. Quiero saber qué compró, si era inevitable, si estaba previsto y cuánta caja quedó después. Un gasto puede ser correcto y aun así llegar en el peor momento de liquidez.`,
        criterio:
          "Todo desembolso debe justificarse por necesidad, retorno o continuidad operativa y medirse contra caja disponible.",
        faltantes: [
          "¿Qué se pagó exactamente?",
          "¿Ya salió el dinero de caja?",
          "¿Era un gasto previsto o extraordinario?",
          "¿Qué caja quedó disponible después?"
        ]
      },
      VENTAS: {
        respuesta:
          "Desde Ventas no puedo concluir mucho solo por el gasto. Me importa únicamente si ese desembolso habilita ingresos, mejora conversión o sostiene una venta que de otro modo se perdería.",
        criterio:
          "El área comercial no debe apropiarse de un gasto si no existe vínculo demostrable con ingresos.",
        faltantes: [
          "¿Este gasto está asociado a una venta, cliente o canal concreto?"
        ]
      },
      MARKETING: {
        respuesta:
          categoria === "MARKETING"
            ? `Si esos ${monto} fueron publicidad, necesito una condición mínima: poder atribuir clientes o ventas a ese gasto. Sin atribución, no sabremos si fue inversión o consumo de caja.`
            : "No veo todavía evidencia de que este gasto sea de Marketing. Si no está vinculado a adquisición o retención de clientes, no lo convertiría en una conclusión de mi función.",
        criterio:
          "Marketing solo reclama responsabilidad sobre gasto que tenga una hipótesis de demanda, medición y atribución.",
        faltantes:
          categoria === "MARKETING"
            ? [
                "¿Qué canal recibió el dinero?",
                "¿Cuántos clientes o ventas se atribuyen a ese gasto?"
              ]
            : []
      },
      OPERACIONES: {
        respuesta:
          categoria === "OPERACIONES"
            ? `Si los ${monto} fueron para proveedor o insumos, necesito saber qué cobertura compramos: cuántos días de operación, qué rotación y si evitamos un quiebre. Comprar mucho puede proteger servicio o simplemente inmovilizar caja.`
            : "Operaciones solo debería intervenir si el gasto compró capacidad, inventario, mantenimiento o continuidad del servicio.",
        criterio:
          "Un desembolso operativo debe traducirse en capacidad, disponibilidad, calidad o reducción de riesgo medible.",
        faltantes:
          categoria === "OPERACIONES"
            ? [
                "¿Qué insumo o activo se compró?",
                "¿Cuánta cobertura o capacidad agregó?",
                "¿Era reposición normal o compra extraordinaria?"
              ]
            : []
      },
      GENTE: {
        respuesta:
          categoria === "GENTE"
            ? `Si ese gasto de ${monto} fue de nómina o personal, necesito separar obligación recurrente de gasto extraordinario. El impacto importante no es un pago aislado, sino cuánto compromiso fijo mensual representa.`
            : "No veo una conclusión de Gente a partir de este gasto si no está relacionado con nómina, contratación, formación o capacidad humana.",
        criterio:
          "Gente analiza compromisos laborales y capacidad, no cualquier salida de caja.",
        faltantes:
          categoria === "GENTE"
            ? [
                "¿Es un costo recurrente o extraordinario?",
                "¿A qué capacidad o responsabilidad corresponde?"
              ]
            : []
      },
      DIRECCION: {
        respuesta:
          `No preguntaría primero si gastar ${monto} fue “mucho” o “poco”. Preguntaría qué problema resolvió, qué alternativa existía y qué cambió después del desembolso. Dirección debe conectar ese gasto con caja, continuidad y resultado.`,
        criterio:
          "Un gasto se evalúa por necesidad, impacto, reversibilidad y efecto sobre caja, no por intuición.",
        faltantes: [
          "Qué problema resolvió.",
          "Qué resultado se esperaba.",
          "Qué caja quedó después."
        ]
      }
    };

    const item = porDepartamento[departamento];

    return {
      respuesta: item.respuesta,
      criterio_profesional: item.criterio,
      evidencia_usada: [
        ...dato,
        ...evidenciasReporte
      ].slice(0, 8),
      inferencias: [],
      riesgos: [
        departamento === "FINANZAS"
          ? "Normalizar gastos aislados sin controlar su efecto acumulado sobre caja."
          : "Sacar conclusiones funcionales sin conocer para qué se usó el dinero."
      ],
      objeciones: [],
      acuerdos: [],
      datos_faltantes: item.faltantes,
      confianza: 78,
      relevancia
    };
  }

  if (hecho.tipo === "SALIDA_PERSONAL_REPORTADA") {
    const cantidad =
      hecho.cantidad
        ? `${hecho.cantidad} persona(s)`
        : "personal";

    const porDepartamento = {
      FINANZAS: {
        respuesta:
          `La salida de ${cantidad} puede aliviar nómina o crear un costo mayor si obliga a pagar horas extra, liquidaciones o reemplazos urgentes. No asumiría ahorro hasta calcular el costo completo de la transición.`,
        criterio:
          "La salida de personal se evalúa por costo total, no únicamente por salario que deja de pagarse.",
        faltantes: [
          "Costo de liquidación.",
          "Costo temporal de cobertura.",
          "Costo estimado de reemplazo."
        ]
      },
      VENTAS: {
        respuesta:
          "Solo me preocupa directamente si la persona saliente atendía clientes, sostenía cartera o generaba ventas. Si no, no forzaría una conclusión comercial.",
        criterio:
          "Ventas debe medir continuidad de relaciones e ingresos cuando la salida afecta roles comerciales.",
        faltantes: [
          "¿La persona gestionaba clientes o ventas activas?"
        ]
      },
      OPERACIONES: {
        respuesta:
          `Necesito saber qué turno, proceso o capacidad quedó descubierta con la salida de ${cantidad}. El riesgo inmediato no es el organigrama: es que el trabajo siga existiendo y ahora nadie tenga capacidad para hacerlo.`,
        criterio:
          "Toda salida debe traducirse a capacidad perdida, cobertura temporal y riesgo de continuidad.",
        faltantes: [
          "Qué funciones quedaron sin cobertura.",
          "Horas o turnos que deben redistribuirse.",
          "Impacto esperado en tiempo y calidad."
        ]
      },
      GENTE: {
        respuesta:
          `Aquí sí entro de lleno. Antes de correr a reemplazar a ${cantidad}, quiero saber por qué se fueron, qué función cubrían y si el problema es realmente falta de personas o diseño deficiente del trabajo. Reemplazar sin entender la causa puede repetir la salida.`,
        criterio:
          "Una baja de personal exige separar causa de salida, necesidad real del puesto y riesgo de recurrencia.",
        faltantes: [
          "Motivo de salida.",
          "Función y KPI de cada persona.",
          "Carga que queda pendiente.",
          "Si existe reemplazo interno viable."
        ]
      },
      DIRECCION: {
        respuesta:
          `La pregunta no es simplemente “¿a quién contratamos para reemplazar a ${cantidad}?”. Primero debemos saber qué función crítica quedó sin responsable y cuánto tiempo puede operar así la empresa sin deteriorar ventas, servicio o control.`,
        criterio:
          "Dirección protege continuidad de funciones críticas antes que puestos específicos.",
        faltantes: [
          "Qué función crítica quedó descubierta.",
          "Cuánto tiempo puede sostenerse la cobertura temporal."
        ]
      }
    };

    const item = porDepartamento[departamento];

    if (!item) {
      return respuestaSinAporteMaterial({
        departamento,
        hecho
      });
    }

    return {
      respuesta: item.respuesta,
      criterio_profesional: item.criterio,
      evidencia_usada: [
        ...dato,
        ...evidenciasReporte
      ].slice(0, 8),
      inferencias: [],
      riesgos: [
        "Reemplazar personas sin diagnosticar la causa o la necesidad real de capacidad."
      ],
      objeciones: [],
      acuerdos: [],
      datos_faltantes: item.faltantes,
      confianza: 82,
      relevancia
    };
  }

  if (hecho.tipo === "QUEJA_CLIENTE_REPORTADA") {
    const porDepartamento = {
      FINANZAS: {
        respuesta:
          "Una queja puede tener costo directo —devolución, descuento, reposición— y costo futuro por pérdida de recurrencia. Necesito cuantificar ambos antes de llamarla un incidente menor.",
        criterio:
          "El costo de una falla de servicio incluye compensación inmediata y posible valor futuro perdido.",
        faltantes: [
          "¿Hubo devolución, descuento o reposición?",
          "¿El cliente era recurrente?"
        ]
      },
      VENTAS: {
        respuesta:
          "Quiero saber si esta queja pone en riesgo una relación comercial. Si el cliente compra con frecuencia, la prioridad es recuperar confianza y entender qué promesa comercial no se cumplió.",
        criterio:
          "La recuperación de servicio es también protección de ingresos futuros.",
        faltantes: [
          "Historial de compra del cliente.",
          "Promesa comercial realizada."
        ]
      },
      MARKETING: {
        respuesta:
          "Una queja aislada no define reputación, pero sí puede revelar una brecha entre lo que prometemos y lo que entregamos. Me interesa si la expectativa vino de nuestro mensaje o canal.",
        criterio:
          "Marketing debe corregir promesas que atraen clientes con expectativas que Operaciones no puede cumplir.",
        faltantes: [
          "Qué expectativa tenía el cliente.",
          "Qué mensaje, campaña o canal influyó."
        ]
      },
      OPERACIONES: {
        respuesta:
          "Aquí necesito reconstruir el servicio de punta a punta: qué pidió, qué recibió, cuánto tardó, quién intervino y dónde ocurrió la desviación. Una queja sirve si la convertimos en causa operativa verificable.",
        criterio:
          "Las quejas deben transformarse en fallas de proceso observables, no en opiniones sobre personas.",
        faltantes: [
          "Qué ocurrió exactamente.",
          "Hora y pedido involucrado.",
          "Punto del proceso donde apareció la falla."
        ]
      },
      GENTE: {
        respuesta:
          "No asumiría que la queja es culpa de un empleado. Primero separaría proceso, carga, formación y conducta. Si el problema es sistémico, castigar a una persona no lo corrige.",
        criterio:
          "El desempeño humano se evalúa después de distinguir falla individual de falla de proceso.",
        faltantes: [
          "Si hubo incumplimiento de procedimiento.",
          "Carga de trabajo y formación de quien atendió."
        ]
      },
      DIRECCION: {
        respuesta:
          "No quiero cerrar una queja solo con una compensación. Quiero saber si revela un fallo repetible que puede costarnos más clientes. Si es aislada, se resuelve; si es patrón, cambia prioridad operativa.",
        criterio:
          "Dirección diferencia incidente de patrón y protege recurrencia y reputación.",
        faltantes: [
          "Si existen quejas similares recientes.",
          "Costo de resolverla y riesgo de repetición."
        ]
      }
    };

    const item = porDepartamento[departamento];

    return {
      respuesta: item.respuesta,
      criterio_profesional: item.criterio,
      evidencia_usada: [
        ...dato,
        ...evidenciasReporte
      ].slice(0, 8),
      inferencias: [],
      riesgos: [
        "Tratar el síntoma sin encontrar si existe una causa repetible."
      ],
      objeciones: [],
      acuerdos: [],
      datos_faltantes: item.faltantes,
      confianza: 80,
      relevancia
    };
  }

  if (hecho.tipo === "QUIEBRE_INVENTARIO_REPORTADO") {
    const porDepartamento = {
      FINANZAS: {
        respuesta:
          "Quedarse sin inventario puede significar caja protegida por comprar poco o ventas perdidas por comprar tarde. Necesito medir qué ingreso se dejó de capturar y qué capital habría requerido evitar el quiebre.",
        criterio:
          "El inventario óptimo equilibra caja inmovilizada contra costo de quiebre.",
        faltantes: [
          "Ventas perdidas estimadas.",
          "Costo y plazo de reposición."
        ]
      },
      VENTAS: {
        respuesta:
          "Si el producto agotado tiene demanda real, quiero saber cuántas ventas no pudimos cerrar y si el cliente aceptó sustituto. Eso convierte el quiebre en impacto comercial.",
        criterio:
          "Un agotado se mide también por conversión perdida y sustitución.",
        faltantes: [
          "Clientes afectados.",
          "Ventas perdidas o sustituidas."
        ]
      },
      OPERACIONES: {
        respuesta:
          "Aquí la primera pregunta es por qué se agotó: demanda superior, compra tardía, proveedor incumplido, dato de inventario incorrecto o política de reposición inexistente. Cada causa exige una corrección distinta.",
        criterio:
          "Un quiebre debe rastrearse hasta reposición, proveedor, pronóstico o exactitud de inventario.",
        faltantes: [
          "Producto agotado.",
          "Fecha del último pedido.",
          "Tiempo de reposición.",
          "Stock teórico versus stock real."
        ]
      },
      DIRECCION: {
        respuesta:
          "No ordenaría simplemente comprar más. Primero debemos saber si el quiebre fue excepcional o si nuestra política de inventario está mal diseñada. Comprar de más también destruye caja.",
        criterio:
          "Dirección equilibra disponibilidad con capital de trabajo.",
        faltantes: [
          "Frecuencia de quiebres.",
          "Valor de ventas perdidas.",
          "Capital necesario para aumentar stock."
        ]
      }
    };

    const item = porDepartamento[departamento];

    if (!item) {
      return respuestaSinAporteMaterial({
        departamento,
        hecho
      });
    }

    return {
      respuesta: item.respuesta,
      criterio_profesional: item.criterio,
      evidencia_usada: [
        ...dato,
        ...evidenciasReporte
      ].slice(0, 8),
      inferencias: [],
      riesgos: [
        "Corregir un quiebre comprando exceso de inventario sin calcular rotación."
      ],
      objeciones: [],
      acuerdos: [],
      datos_faltantes: item.faltantes,
      confianza: 84,
      relevancia
    };
  }

  if (hecho.tipo === "CAMBIO_PRECIO_REPORTADO") {
    const cambio =
      hecho.porcentaje !== null
        ? `${hecho.porcentaje}%`
        : "un valor no cuantificado";

    const verbo =
      hecho.direccion === "SUBE"
        ? "subiste"
        : "bajaste";

    const porDepartamento = {
      FINANZAS: {
        respuesta:
          `Si ${verbo} precios ${cambio}, quiero medir margen de contribución antes y después, no solo facturación. El cambio sirve si mejora economía unitaria sin destruir volumen de forma desproporcionada.`,
        criterio:
          "Precio debe evaluarse por contribución total y caja, no solo margen porcentual.",
        faltantes: [
          "Margen antes y después.",
          "Volumen vendido antes y después."
        ]
      },
      VENTAS: {
        respuesta:
          `El cambio de precio de ${cambio} debe observarse en conversión, ticket y objeciones del cliente. Si la conversión cae, necesito saber si perdimos clientes sensibles al precio o si la oferta dejó de justificar el valor.`,
        criterio:
          "Ventas valida elasticidad real en comportamiento de compra.",
        faltantes: [
          "Conversión antes y después.",
          "Objeciones recibidas.",
          "Ticket promedio posterior al cambio."
        ]
      },
      MARKETING: {
        respuesta:
          `Un cambio de precio de ${cambio} también cambia el posicionamiento. Debemos revisar si el mensaje y la propuesta de valor justifican el nuevo nivel de precio y a qué segmento seguimos siendo atractivos.`,
        criterio:
          "Precio y posicionamiento deben ser coherentes para no comprar demanda equivocada.",
        faltantes: [
          "Segmento afectado.",
          "Cambios en respuesta por canal."
        ]
      },
      OPERACIONES: {
        respuesta:
          "Desde Operaciones me importa si el cambio de precio responde a mayor costo real o si pretende compensar ineficiencias. Si es lo segundo, subir precio puede esconder un problema que seguirá creciendo.",
        criterio:
          "El precio no debe utilizarse como sustituto permanente de control de costo y merma.",
        faltantes: [
          "Cambio reciente en costos, merma o productividad."
        ]
      },
      DIRECCION: {
        respuesta:
          `No declararía éxito o fracaso por haber cambiado precios ${cambio}. Necesitamos un antes/después de margen, volumen, conversión y caja durante un periodo comparable.`,
        criterio:
          "Dirección evalúa cambios de precio como experimentos económicos medibles.",
        faltantes: [
          "Fecha exacta del cambio.",
          "Métricas comparables antes y después."
        ]
      }
    };

    const item = porDepartamento[departamento];

    if (!item) {
      return respuestaSinAporteMaterial({
        departamento,
        hecho
      });
    }

    return {
      respuesta: item.respuesta,
      criterio_profesional: item.criterio,
      evidencia_usada: [
        ...dato,
        ...evidenciasReporte
      ].slice(0, 8),
      inferencias: [],
      riesgos: [
        "Atribuir cambios de resultado al precio sin controlar otras variables."
      ],
      objeciones: [],
      acuerdos: [],
      datos_faltantes: item.faltantes,
      confianza: 81,
      relevancia
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

function evaluabilidadReporte(reporte) {
  if (!reporte) {
    return {
      evaluable: false,
      motivo: "No existe reporte vigente."
    };
  }

  const kpi =
    reporte.kpi_principal || {};

  const requiereObjetivo = [
    "margen_bruto_confiable",
    "ticket_promedio",
    "cac"
  ].includes(
    kpi.nombre
  );

  const medicionDisponible =
    kpi.medicion_disponible !== false;

  const objetivoDisponible =
    requiereObjetivo
      ? kpi.objetivo_disponible !== false &&
        kpi.valor_objetivo !== null &&
        kpi.valor_objetivo !== undefined
      : true;

  return {
    evaluable:
      medicionDisponible &&
      objetivoDisponible,
    motivo:
      limitarTexto(
        kpi.motivo_no_evaluable,
        400
      ) ||
      (
        !medicionDisponible
          ? "No existe medición suficiente todavía."
          : !objetivoDisponible
            ? "Falta el objetivo empresarial necesario para evaluar."
            : ""
      )
  };
}

function hechosReporte(reporte) {
  if (!reporte) return [];

  const kpi =
    reporte.kpi_principal || {};

  const evaluabilidad =
    evaluabilidadReporte(
      reporte
    );

  const hechos = [
    evaluabilidad.evaluable
      ? `${reporte.neurona}: ${kpi.nombre || "KPI"} — estado ${kpi.estado || "SIN_ESTADO"}.`
      : `${reporte.neurona}: ${kpi.nombre || "KPI"} — todavía no evaluable como señal operativa.`
  ];

  const actual =
    formato(
      kpi.valor_actual
    );

  const objetivo =
    formato(
      kpi.valor_objetivo
    );

  if (actual !== null) {
    hechos.push(
      `Valor actual: ${actual}.`
    );
  }

  if (
    evaluabilidad.evaluable &&
    objetivo !== null
  ) {
    hechos.push(
      `Objetivo: ${objetivo}.`
    );
  }

  const hallazgos =
    (reporte.hallazgos || [])
      .filter(
        (hallazgo) =>
          ![
            "CONFIGURACION_INCOMPLETA",
            "SIN_INVENTARIO_CONFIGURADO"
          ].includes(
            hallazgo?.tipo
          )
      );

  if (!evaluabilidad.evaluable) {
    return hechos.concat(
      hallazgos
        .filter(
          (hallazgo) =>
            hallazgo?.tipo !==
            "DATOS_INSUFICIENTES"
        )
        .map((hallazgo) =>
          limitarTexto(
            hallazgo?.evidencia,
            500
          )
        )
        .filter(Boolean)
    );
  }

  return hechos.concat(
    hallazgos
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
      extraerHechosConversacion(
        pregunta,
        intervenciones
      ),
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

  const hechoPrincipal =
    hechoConversacionalPrincipal(
      hechosHumanos
    );

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

  if (
    hechoPrincipal &&
    hechoPrincipal.tipo !== "VENTA_REPORTADA"
  ) {
    const contextual =
      respuestaEventoGeneral({
        departamento,
        hecho: hechoPrincipal,
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
    const evaluabilidad =
      evaluabilidadReporte(
        reporte
      );

    respuesta +=
      evaluabilidad.evaluable
        ? ` El reporte vigente de ${departamento} marca ${reporte.kpi_principal?.estado || "SIN_ESTADO"} en ${reporte.kpi_principal?.nombre || "su KPI principal"}.`
        : ` El KPI ${reporte.kpi_principal?.nombre || "principal"} todavía no es evaluable como alerta operativa; lo trato como preparación pendiente, no como deterioro del negocio.`;
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
      }),
    relevancia:
      (() => {
        const principal = temaPrincipal(temas);
        const mapa = {
          FLUJO_CAJA: {
            FINANZAS: "ALTA",
            VENTAS: "MEDIA",
            MARKETING: "BAJA",
            OPERACIONES: "MEDIA",
            GENTE: "BAJA",
            DIRECCION: "ALTA"
          },
          MARGEN_PRECIO: {
            FINANZAS: "ALTA",
            VENTAS: "ALTA",
            MARKETING: "MEDIA",
            OPERACIONES: "MEDIA",
            GENTE: "BAJA",
            DIRECCION: "ALTA"
          },
          MARKETING_CAC: {
            FINANZAS: "MEDIA",
            VENTAS: "MEDIA",
            MARKETING: "ALTA",
            OPERACIONES: "BAJA",
            GENTE: "NINGUNA",
            DIRECCION: "ALTA"
          },
          OPERACION_INVENTARIO: {
            FINANZAS: "MEDIA",
            VENTAS: "MEDIA",
            MARKETING: "BAJA",
            OPERACIONES: "ALTA",
            GENTE: "BAJA",
            DIRECCION: "ALTA"
          },
          GENTE_CAPACIDAD: {
            FINANZAS: "MEDIA",
            VENTAS: "BAJA",
            MARKETING: "NINGUNA",
            OPERACIONES: "ALTA",
            GENTE: "ALTA",
            DIRECCION: "ALTA"
          }
        };

        const base =
          mapa[principal]?.[departamento] ||
          (departamento === "DIRECCION"
            ? "ALTA"
            : "MEDIA");

        if (
          departamento !== "DIRECCION" &&
          reporte &&
          reporte.kpi_principal
            ?.medicion_disponible === false
        ) {
          const temaExplicito = {
            MARKETING:
              principal === "MARKETING_CAC",
            OPERACIONES:
              principal === "OPERACION_INVENTARIO",
            GENTE:
              principal === "GENTE_CAPACIDAD"
          }[departamento];

          if (!temaExplicito) {
            return "NINGUNA";
          }
        }

        return base;
      })()
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

    const setupPendiente =
      respuestas
        .filter(
          (item) =>
            item.departamento !==
            "DIRECCION"
        )
        .filter(
          (item) =>
            /todavía no es evaluable como alerta operativa/i
              .test(
                item.respuesta || ""
              )
        )
        .map(
          (item) =>
            item.departamento
        );

    direccion.respuesta +=
      ` Como síntesis de Junta, el tema dominante es ${principal}.`;

    if (setupPendiente.length) {
      direccion.respuesta +=
        ` Hay una sola brecha de preparación de GRUK que afecta ${setupPendiente.join(", ")}; no la interpreto como ${setupPendiente.length} fallas distintas del negocio. Completa la configuración base una vez y GRUK recalculará los KPI.`;
    } else {
      direccion.respuesta +=
        " Los datos actuales sí permiten separar señales operativas de simples faltantes de información.";
    }
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
  intervenciones,
  fuente = "USUARIO"
}) {
  const intencion =
    clasificarIntencion(pregunta);

  const temas =
    detectarTemas(pregunta);

  const hechosExtraidos =
    extraerHechosConversacion(
      pregunta,
      intervenciones
    );

  const hechosHumanos =
    fuente === "GRUK"
      ? hechosExtraidos.map(
          (hecho) => ({
            ...hecho,
            fuente: "GRUK"
          })
        )
      : hechosExtraidos;

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
  extraerHechosConversacion,
  construirContexto,
  validarRespuestas,
  generarRespuestasExpertas,
  extraerMemoriaHumana,
  evaluabilidadReporte,
  hechosReporte
};
