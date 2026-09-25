"use strict";

function num(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function resolverDeadline(proyeccion, ahora = new Date()) {
  const candidata =
    proyeccion?.proximoVencimiento?.fechaVencimiento
      ? new Date(proyeccion.proximoVencimiento.fechaVencimiento)
      : null;

  const limite =
    new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000);

  if (!candidata || Number.isNaN(candidata.getTime())) {
    return limite;
  }

  if (candidata <= ahora) {
    return new Date(ahora.getTime() + 24 * 60 * 60 * 1000);
  }

  return candidata < limite ? candidata : limite;
}

function seleccionarCobrosParaBrecha(
  prioridadCobro,
  objetivo
) {
  const meta =
    Math.max(
      0,
      Number(objetivo || 0)
    );

  if (!meta) return [];

  const seleccion = [];
  let acumulado = 0;

  for (
    const item of
    Array.isArray(prioridadCobro)
      ? prioridadCobro
      : []
  ) {
    if (
      !Number.isFinite(
        Number(item?.monto)
      ) ||
      Number(item.monto) <= 0
    ) {
      continue;
    }

    seleccion.push({
      id:
        item.id,
      descripcion:
        item.descripcion,
      monto:
        Number(item.monto),
      fechaVencimiento:
        item.fechaVencimiento,
      clasificacion:
        item.clasificacion
    });

    acumulado +=
      Number(item.monto);

    if (acumulado >= meta) {
      break;
    }
  }

  return seleccion;
}

function construirAgendaFinanciera(proyeccion, ahora = new Date()) {
  const estado7d =
    proyeccion?.escenario7d?.estado ||
    "SIN_SALDO_VERIFICABLE";

  const saldoActual =
    proyeccion?.saldoActual ?? null;

  const obligaciones7d =
    num(proyeccion?.obligaciones?.proximos7d?.monto);

  const cobros7d =
    num(proyeccion?.cobrosEsperados?.proximos7d?.monto);

  const faltanteConCajaActual =
    num(proyeccion?.escenario7d?.faltanteConCajaActual);

  const faltanteAunCobrandoTodo =
    num(proyeccion?.escenario7d?.faltanteAunCobrandoTodo);

  const deadline =
    resolverDeadline(proyeccion, ahora);

  const cobrosPriorizados =
    seleccionarCobrosParaBrecha(
      proyeccion
        ?.cobrosEsperados
        ?.prioridadCobro || [],
      faltanteConCajaActual
    );

  const accionesSugeridas = [];

  if (estado7d === "DEFICIT_AUN_COBRANDO_TODO") {
    accionesSugeridas.push(
      {
        departamento: "FINANZAS",
        codigo: "REDUCIR_BRECHA_CAJA_7D",
        prioridad: "CRITICA",
        deadline,
        kpi_a_medir: "brecha_caja_7d",
        montoReferencia: faltanteAunCobrandoTodo
      },
      {
        departamento: "VENTAS",
        codigo: "ACELERAR_COBROS_7D",
        prioridad: "CRITICA",
        deadline,
        kpi_a_medir: "cobros_confirmados_7d",
        montoReferencia:
          faltanteConCajaActual,
        cobrosPriorizados
      },
      {
        departamento: "DIRECCION",
        codigo: "PRIORIZAR_OBLIGACIONES_7D",
        prioridad: "CRITICA",
        deadline,
        kpi_a_medir: "obligaciones_7d_cubiertas",
        montoReferencia: obligaciones7d
      }
    );
  } else if (estado7d === "DEPENDE_DE_COBROS") {
    accionesSugeridas.push(
      {
        departamento: "FINANZAS",
        codigo: "CONTROLAR_BRECHA_CAJA_7D",
        prioridad: "ALTA",
        deadline,
        kpi_a_medir: "brecha_caja_7d",
        montoReferencia: faltanteConCajaActual
      },
      {
        departamento: "VENTAS",
        codigo: "ACELERAR_COBROS_7D",
        prioridad: "ALTA",
        deadline,
        kpi_a_medir: "cobros_confirmados_7d",
        montoReferencia:
          faltanteConCajaActual,
        cobrosPriorizados
      }
    );
  } else if (estado7d === "DATOS_INSUFICIENTES") {
    accionesSugeridas.push({
      departamento: "FINANZAS",
      codigo: "COMPLETAR_DATOS_OBLIGACIONES_7D",
      prioridad: "ALTA",
      deadline,
      kpi_a_medir: "cobertura_datos_obligaciones_7d",
      montoReferencia: 0
    });
  } else if (estado7d === "SIN_SALDO_VERIFICABLE") {
    accionesSugeridas.push({
      departamento: "FINANZAS",
      codigo: "COMPLETAR_TESORERIA",
      prioridad: "ALTA",
      deadline,
      kpi_a_medir: "tesoreria_confiable",
      montoReferencia: 0
    });
  }

  return {
    fuente: "TESORERIA_GRUK",
    estado7d,
    confiabilidad:
      proyeccion?.confiabilidad || "SIN_CONFIGURAR",
    saldoActual,
    obligaciones7d,
    cobros7d,
    faltanteConCajaActual,
    faltanteAunCobrandoTodo,
    fechaCritica: deadline,
    cobrosPriorizados,
    requiereDecision:
      accionesSugeridas.length > 0,
    accionesSugeridas
  };
}

module.exports = {
  construirAgendaFinanciera,
  resolverDeadline,
  seleccionarCobrosParaBrecha
};
