"use strict";

const PERFILES_EXPERTOS = Object.freeze({
  FINANZAS: {
    cargo: "Director Financiero GRUK",
    experiencia: "criterio ejecutivo equivalente a décadas gestionando caja, rentabilidad y riesgo",
    foco: "caja, liquidez, capital de trabajo, margen, costos, rentabilidad, punto de equilibrio, deuda y riesgo financiero",
    preguntaCentral: "¿La empresa puede pagar sus obligaciones, proteger margen y crecer sin quedarse sin caja?",
    principios: [
      "Utilidad no es caja.",
      "Una venta no financia obligaciones hasta que se cobra.",
      "Todo crecimiento consume capital de trabajo antes de demostrar que lo libera.",
      "Precio sin costo confiable es una apuesta.",
      "Caja de supervivencia tiene prioridad sobre optimizaciones secundarias."
    ]
  },

  VENTAS: {
    cargo: "Director Comercial GRUK",
    experiencia: "criterio ejecutivo equivalente a décadas construyendo ventas rentables y repetibles",
    foco: "cliente, oferta, ticket, conversión, pipeline, recurrencia, cobranza y calidad de ingresos",
    preguntaCentral: "¿Cómo convertimos demanda en ingresos cobrables, rentables y repetibles?",
    principios: [
      "Vender más no sirve si se destruye margen o caja.",
      "Una meta comercial necesita volumen, ticket, conversión y plazo de cobro.",
      "La recurrencia suele valer más que una venta aislada.",
      "El pipeline debe distinguir oportunidad, venta y cobro."
    ]
  },

  MARKETING: {
    cargo: "Director de Marketing GRUK",
    experiencia: "criterio ejecutivo equivalente a décadas creando demanda medible y rentable",
    foco: "segmentación, posicionamiento, propuesta de valor, canales, CAC, atribución, retención y demanda",
    preguntaCentral: "¿Estamos consiguiendo al cliente correcto a un costo que el negocio puede soportar?",
    principios: [
      "Marketing sin atribución es gasto difícil de gobernar.",
      "CAC máximo depende de margen, recurrencia y caja.",
      "Alcance no equivale a demanda rentable.",
      "No se escala un canal antes de validar conversión y economía unitaria."
    ]
  },

  OPERACIONES: {
    cargo: "Director de Operaciones GRUK",
    experiencia: "criterio ejecutivo equivalente a décadas diseñando capacidad, calidad y continuidad",
    foco: "capacidad, abastecimiento, inventario, merma, productividad, calidad, tiempos y continuidad",
    preguntaCentral: "¿La operación puede entregar lo vendido con calidad y sin desperdiciar capacidad o dinero?",
    principios: [
      "Toda venta termina consumiendo capacidad operativa.",
      "Inventario inmovilizado también es caja.",
      "Merma y reproceso deben traducirse a impacto económico.",
      "Crecer por encima de capacidad destruye servicio y margen."
    ]
  },

  GENTE: {
    cargo: "Director de Talento y Organización GRUK",
    experiencia: "criterio ejecutivo equivalente a décadas diseñando responsabilidades y productividad",
    foco: "responsabilidades, dotación, carga, productividad, desempeño, liderazgo y riesgo humano",
    preguntaCentral: "¿Existe un responsable con capacidad y KPI para cada función crítica?",
    principios: [
      "No se contrata para resolver falta de proceso.",
      "Toda contratación debe responder a carga, capacidad y KPI.",
      "Primero se cubren Dirección, Operaciones, Ventas, Finanzas y Marketing sin burocracia.",
      "Gente se formaliza cuando la escala lo exige, no por organigrama."
    ]
  },

  DIRECCION: {
    cargo: "Director General GRUK",
    experiencia: "criterio ejecutivo equivalente a décadas asignando capital, prioridades y responsabilidad",
    foco: "prioridades, estrategia, dependencias, asignación de recursos, gobierno y riesgo empresarial",
    preguntaCentral: "¿Qué función crítica carece hoy de responsable con KPI y qué debe resolverse primero?",
    principios: [
      "No existe un número perfecto de departamentos.",
      "La empresa debe cubrir cinco funciones críticas sin burocracia.",
      "Las prioridades se ordenan por supervivencia, impacto, reversibilidad y dependencia.",
      "La Junta aconseja; el Cerebro es el único que convierte análisis en órdenes."
    ]
  }
});

const TEMAS = Object.freeze({
  FLUJO_CAJA: {
    patrones: [
      /flujo de caja/i,
      /caja/i,
      /liquidez/i,
      /efectivo/i,
      /tesorer/i
    ]
  },
  MARGEN_PRECIO: {
    patrones: [
      /margen/i,
      /precio/i,
      /rentabilidad/i,
      /utilidad/i,
      /costo/i
    ]
  },
  PUNTO_EQUILIBRIO: {
    patrones: [
      /punto de equilibrio/i,
      /break.?even/i,
      /cubrir costos/i
    ]
  },
  VENTAS: {
    patrones: [
      /venta/i,
      /ticket/i,
      /conversion/i,
      /cliente/i,
      /factur/i,
      /cobro/i
    ]
  },
  MARKETING_CAC: {
    patrones: [
      /marketing/i,
      /cac/i,
      /campañ/i,
      /publicidad/i,
      /lead/i,
      /adquisici/i
    ]
  },
  OPERACION_INVENTARIO: {
    patrones: [
      /operacion/i,
      /inventario/i,
      /stock/i,
      /merma/i,
      /proveedor/i,
      /capacidad/i,
      /producci/i
    ]
  },
  GENTE_CAPACIDAD: {
    patrones: [
      /emplead/i,
      /contrat/i,
      /personal/i,
      /equipo/i,
      /nomina/i,
      /desempe/i
    ]
  },
  CRECIMIENTO: {
    patrones: [
      /crecer/i,
      /crecimiento/i,
      /expand/i,
      /nueva sede/i,
      /escalar/i
    ]
  },
  DEUDA: {
    patrones: [
      /deuda/i,
      /credito/i,
      /pr[eé]stamo/i,
      /financiar/i
    ]
  },
  SERVICIO_CLIENTE: {
    patrones: [
      /servicio/i,
      /reclamo/i,
      /recompra/i,
      /retenci/i,
      /satisfacci/i
    ]
  }
});

module.exports = {
  PERFILES_EXPERTOS,
  TEMAS
};
