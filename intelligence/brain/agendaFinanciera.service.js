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
      ![
        "VENCIDA",
        "PROXIMOS_7_DIAS"
      ].includes(
        item?.clasificacion
      )
    ) {
      continue;
    }

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

function construirPlanPagos(
  prioridadPago,
  recursosDisponibles
) {
  const recursos =
    Math.max(
      0,
      Number(recursosDisponibles || 0)
    );

  let acumulado = 0;
  let prioridadBloqueada = false;

  return (
    Array.isArray(prioridadPago)
      ? prioridadPago
      : []
  ).map((item) => {
    const monto =
      Number(item?.monto || 0);

    const puedeCubrirCompleto =
      !prioridadBloqueada &&
      monto > 0 &&
      acumulado + monto <= recursos;

    if (puedeCubrirCompleto) {
      acumulado += monto;
    } else {
      prioridadBloqueada = true;
    }

    return {
      id: item.id,
      tipo: item.tipo,
      descripcion:
        item.descripcion,
      categoria:
        item.categoria || null,
      tercero:
        item.tercero || "",
      monto,
      fechaVencimiento:
        item.fechaVencimiento,
      estadoCobertura:
        puedeCubrirCompleto
          ? "CUBIERTA"
          : "NO_CUBIERTA"
    };
  });
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

  const montoCobrosPriorizados =
    cobrosPriorizados.reduce(
      (total, item) =>
        total +
        Number(item.monto || 0),
      0
    );

  const faltanteDespuesCobrosPriorizados =
    Math.max(
      0,
      faltanteConCajaActual -
      montoCobrosPriorizados
    );

  const obligacionesPriorizadas =
    Array.isArray(
      proyeccion
        ?.obligaciones
        ?.prioridadPago
    )
      ? proyeccion
          .obligaciones
          .prioridadPago
      : [];

  const planPagosCajaActual =
    construirPlanPagos(
      obligacionesPriorizadas,
      saldoActual
    );

  const recursosConCobros =
    Math.max(
      0,
      Number(saldoActual || 0) +
      montoCobrosPriorizados
    );

  const planPagosConCobros =
    construirPlanPagos(
      obligacionesPriorizadas,
      recursosConCobros
    );

  const obligacionesNoCubiertasCajaActual =
    planPagosCajaActual.filter(
      (item) =>
        item.estadoCobertura ===
        "NO_CUBIERTA"
    );

  const obligacionesNoCubiertasConCobros =
    planPagosConCobros.filter(
      (item) =>
        item.estadoCobertura ===
        "NO_CUBIERTA"
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
        cobrosPriorizados,
        montoCobrosPriorizados,
        faltanteDespuesCobrosPriorizados
      },
      {
        departamento: "DIRECCION",
        codigo: "PRIORIZAR_OBLIGACIONES_7D",
        prioridad: "CRITICA",
        deadline,
        kpi_a_medir: "obligaciones_7d_cubiertas",
        montoReferencia: obligaciones7d,
        obligacionesPriorizadas,
        planPagosCajaActual,
        planPagosConCobros,
        obligacionesNoCubiertasCajaActual,
        obligacionesNoCubiertasConCobros
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
        cobrosPriorizados,
        montoCobrosPriorizados,
        faltanteDespuesCobrosPriorizados
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
    montoCobrosPriorizados,
    faltanteDespuesCobrosPriorizados,
    politicaPriorizacionPagos:
      proyeccion?.politicaPriorizacionPagos || null,
    excepcionesPrioridadPago:
      Array.isArray(
        proyeccion?.excepcionesPrioridadPago
      )
        ? proyeccion.excepcionesPrioridadPago
        : [],
    obligacionesPriorizadas,
    planPagosCajaActual,
    planPagosConCobros,
    obligacionesNoCubiertasCajaActual,
    obligacionesNoCubiertasConCobros,
    requiereDecision:
      accionesSugeridas.length > 0,
    accionesSugeridas
  };
}

module.exports = {
  construirAgendaFinanciera,
  resolverDeadline,
  seleccionarCobrosParaBrecha,
  construirPlanPagos
};
