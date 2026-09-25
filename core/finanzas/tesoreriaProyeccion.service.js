"use strict";

const mongoose = require("mongoose");

const Venta = require("../../models/Venta");
const {
  obtenerResumenCaja
} = require("./caja.service");
const {
  obtenerResumenTesoreria
} = require("./tesoreria.service");
const {
  obtenerObligacionesRegistradas
} = require("./obligaciones.service");
const {
  obtenerPoliticaPriorizacionPagos,
  normalizarCategoriaObligacion,
  indiceCategoria
} = require("./politicaFinanciera.service");

function objectId(valor, nombre) {
  if (!mongoose.Types.ObjectId.isValid(valor)) {
    const error = new Error(
      `${nombre} invalido`
    );
    error.statusCode = 400;
    throw error;
  }

  return new mongoose.Types.ObjectId(
    String(valor)
  );
}

function filtroScope({
  empresaId,
  sedeId
}) {
  const filtro = {
    empresaId:
      objectId(
        empresaId,
        "empresaId"
      )
  };

  if (sedeId) {
    filtro.sedeId =
      objectId(
        sedeId,
        "sedeId"
      );
  }

  return filtro;
}

function fechaValida(valor) {
  const fecha =
    valor instanceof Date
      ? valor
      : new Date(valor);

  return Number.isNaN(
    fecha.getTime()
  )
    ? null
    : fecha;
}

function clasificarFecha(
  fecha,
  ahora,
  hasta7,
  hasta30
) {
  if (fecha < ahora) {
    return "VENCIDA";
  }

  if (fecha <= hasta7) {
    return "PROXIMOS_7_DIAS";
  }

  if (fecha <= hasta30) {
    return "PROXIMOS_30_DIAS";
  }

  return "POSTERIOR";
}

function resumir(items) {
  return {
    cantidad:
      items.length,
    monto:
      items.reduce(
        (total, item) =>
          total +
          (
            Number.isFinite(
              Number(item.monto)
            )
              ? Number(item.monto)
              : 0
          ),
        0
      )
  };
}

function itemsObligaciones(
  obligacionesRegistradas
) {
  const grupos =
    obligacionesRegistradas
      ?.grupos || {};

  return [
    ...(grupos.vencidas
      ?.items || []),
    ...(grupos.proximos7Dias
      ?.items || []),
    ...(grupos.dias8a30
      ?.items || []),
    ...(grupos.sinFecha
      ?.items || []),
    ...(grupos.posterior30Dias
      ?.items || [])
  ];
}

function normalizarDetalleObligacion(
  item
) {
  return {
    tipo:
      item.origenTipo,
    id:
      item.origenId,
    descripcion:
      item.concepto ||
      item.tercero ||
      "Obligacion registrada",
    categoria:
      item.categoria || null,
    categoriaPolitica:
      normalizarCategoriaObligacion(
        item
      ),
    tercero:
      item.tercero || "",
    fuenteMonto:
      item.fuenteMonto || null,
    monto:
      item.cuantificable
        ? Number(
            item.montoPendiente || 0
          )
        : null,
    cuantificable:
      Boolean(
        item.cuantificable
      ),
    estadoPago:
      item.estadoPago,
    fechaVencimiento:
      item.fechaVencimiento ||
      null
  };
}

async function construirProyeccionTesoreria({
  empresaId,
  sedeId = null,
  ahora = new Date(),
  tesoreria = null
}) {
  const fechaAhora =
    fechaValida(ahora);

  if (!fechaAhora) {
    const error =
      new Error(
        "Fecha de proyeccion invalida"
      );
    error.statusCode = 400;
    throw error;
  }

  const hasta7 =
    new Date(
      fechaAhora.getTime() +
      7 * 24 * 60 * 60 * 1000
    );

  const hasta30 =
    new Date(
      fechaAhora.getTime() +
      30 * 24 * 60 * 60 * 1000
    );

  const scope =
    filtroScope({
      empresaId,
      sedeId
    });

  const resumenTesoreria =
    tesoreria ||
    await obtenerResumenTesoreria({
      empresaId,
      sedeId
    });

  const [
    ventasPendientes,
    ventasSinFecha,
    resumenCaja30,
    obligacionesRegistradas,
    politicaPriorizacionPagos
  ] = await Promise.all([
    Venta.find({
      ...scope,
      estado:
        "pendiente",
      fechaVencimientoCobro: {
        $ne: null,
        $lte: hasta30
      }
    })
      .select(
        "_id concepto total fechaVencimientoCobro"
      )
      .sort({
        fechaVencimientoCobro: 1
      })
      .lean(),

    Venta.find({
      ...scope,
      estado:
        "pendiente",
      fechaVencimientoCobro:
        null
    })
      .select(
        "_id total"
      )
      .lean(),

    obtenerResumenCaja({
      empresaId,
      sedeId,
      desde:
        new Date(
          fechaAhora.getTime() -
          30 * 24 * 60 * 60 * 1000
        ),
      hasta:
        fechaAhora
    }),

    obtenerObligacionesRegistradas({
      empresaId,
      sedeId,
      ahora:
        fechaAhora,
      tesoreria:
        resumenTesoreria
    }),

    obtenerPoliticaPriorizacionPagos(
      empresaId
    )
  ]);

  const detalleObligaciones =
    itemsObligaciones(
      obligacionesRegistradas
    )
      .map(
        normalizarDetalleObligacion
      );

  const detalle30 =
    detalleObligaciones
      .filter(
        (item) =>
          item.fechaVencimiento &&
          new Date(
            item.fechaVencimiento
          ) <= hasta30
      )
      .sort(
        (a, b) =>
          new Date(
            a.fechaVencimiento
          ) -
          new Date(
            b.fechaVencimiento
          )
      );

  const obligacionesPriorizadas7d =
    detalleObligaciones
      .filter((item) => {
        if (
          !item.cuantificable ||
          item.monto === null ||
          !item.fechaVencimiento
        ) {
          return false;
        }

        const fecha =
          new Date(
            item.fechaVencimiento
          );

        return (
          !Number.isNaN(
            fecha.getTime()
          ) &&
          fecha <= hasta7
        );
      })
      .sort((a, b) => {
        const fechaA =
          new Date(
            a.fechaVencimiento
          ).getTime();
        const fechaB =
          new Date(
            b.fechaVencimiento
          ).getTime();

        const vencidaA =
          fechaA < fechaAhora.getTime();
        const vencidaB =
          fechaB < fechaAhora.getTime();

        if (vencidaA !== vencidaB) {
          return vencidaA ? -1 : 1;
        }

        if (
          politicaPriorizacionPagos
            ?.usar_precedencia_categoria
        ) {
          const categoriaA =
            indiceCategoria(
              a,
              politicaPriorizacionPagos
            );

          const categoriaB =
            indiceCategoria(
              b,
              politicaPriorizacionPagos
            );

          if (categoriaA !== categoriaB) {
            return categoriaA - categoriaB;
          }
        }

        if (fechaA !== fechaB) {
          return fechaA - fechaB;
        }

        return Number(b.monto || 0) -
          Number(a.monto || 0);
      });

  const cobrosEsperados =
    ventasPendientes
      .map((item) => ({
        tipo: "VENTA",
        id:
          item._id,
        descripcion:
          item.concepto ||
          "Venta pendiente",
        monto:
          Number(
            item.total || 0
          ),
        fechaVencimiento:
          item.fechaVencimientoCobro,
        clasificacion:
          clasificarFecha(
            new Date(
              item.fechaVencimientoCobro
            ),
            fechaAhora,
            hasta7,
            hasta30
          )
      }));

  const carteraPriorizada =
    [...cobrosEsperados]
      .sort((a, b) => {
        const ordenClasificacion = {
          VENCIDA: 0,
          PROXIMOS_7_DIAS: 1,
          PROXIMOS_30_DIAS: 2,
          POSTERIOR: 3
        };

        const claseA =
          ordenClasificacion[a.clasificacion] ?? 99;
        const claseB =
          ordenClasificacion[b.clasificacion] ?? 99;

        if (claseA !== claseB) {
          return claseA - claseB;
        }

        const fechaA =
          new Date(a.fechaVencimiento).getTime();
        const fechaB =
          new Date(b.fechaVencimiento).getTime();

        if (fechaA !== fechaB) {
          return fechaA - fechaB;
        }

        return Number(b.monto || 0) -
          Number(a.monto || 0);
      });

  const cobrosVencidos =
    cobrosEsperados.filter(
      (item) =>
        item.clasificacion ===
        "VENCIDA"
    );

  const cobros7 =
    cobrosEsperados.filter(
      (item) =>
        item.clasificacion ===
          "VENCIDA" ||
        item.clasificacion ===
          "PROXIMOS_7_DIAS"
    );

  const cobros30 =
    cobrosEsperados.filter(
      (item) =>
        item.clasificacion !==
        "POSTERIOR"
    );

  const grupos =
    obligacionesRegistradas
      .grupos;

  const obligacionesVencidas = {
    cantidad:
      grupos.vencidas.cantidad,
    monto:
      grupos.vencidas
        .montoCuantificado
  };

  const obligaciones7Resumen = {
    cantidad:
      grupos.vencidas.cantidad +
      grupos.proximos7Dias
        .cantidad,
    monto:
      obligacionesRegistradas
        .montoExigible7Dias
  };

  const obligaciones30Resumen = {
    cantidad:
      grupos.vencidas.cantidad +
      grupos.proximos7Dias
        .cantidad +
      grupos.dias8a30.cantidad,
    monto:
      grupos.vencidas
        .montoCuantificado +
      grupos.proximos7Dias
        .montoCuantificado +
      grupos.dias8a30
        .montoCuantificado
  };

  const cobros7Resumen =
    resumir(
      cobros7
    );

  const cobros30Resumen =
    resumir(
      cobros30
    );

  const saldoVerificable =
    resumenTesoreria
      .estadoConfiabilidad ===
      "COMPLETO";

  const saldoActual =
    saldoVerificable
      ? Number(
          resumenTesoreria
            .saldoDisponible || 0
        )
      : null;

  const datos7dCompletos =
    obligacionesRegistradas
      .cobertura7Dias !==
    "NO_CONFIABLE_DATOS_FALTANTES";

  const faltantes30d =
    grupos.sinFecha.cantidad +
    grupos.vencidas.noCuantificadas +
    grupos.proximos7Dias.noCuantificadas +
    grupos.dias8a30.noCuantificadas;

  const datos30dCompletos =
    faltantes30d === 0;

  const brechaCajaActual7d =
    saldoActual === null ||
    !datos7dCompletos
      ? null
      : saldoActual -
        obligaciones7Resumen.monto;

  const escenarioCobroTotal7d =
    saldoActual === null ||
    !datos7dCompletos
      ? null
      : saldoActual +
        cobros7Resumen.monto -
        obligaciones7Resumen.monto;

  let estado7d =
    "SIN_SALDO_VERIFICABLE";

  if (
    saldoActual !== null &&
    !datos7dCompletos
  ) {
    estado7d =
      "DATOS_INSUFICIENTES";
  } else if (
    saldoActual !== null
  ) {
    if (
      brechaCajaActual7d >= 0
    ) {
      estado7d =
        "CUBIERTO_CON_CAJA_ACTUAL";
    } else if (
      escenarioCobroTotal7d >= 0
    ) {
      estado7d =
        "DEPENDE_DE_COBROS";
    } else {
      estado7d =
        "DEFICIT_AUN_COBRANDO_TODO";
    }
  }

  const salidas30 =
    Number(
      resumenCaja30
        .salidasConfirmadas || 0
    );

  const promedioSalidaDiaria30 =
    salidas30 / 30;

  const diasCoberturaSalidasHistoricas =
    saldoActual !== null &&
    promedioSalidaDiaria30 > 0
      ? Number(
          (
            saldoActual /
            promedioSalidaDiaria30
          ).toFixed(1)
        )
      : null;

  const comprasParcialesSinSaldoExacto =
    detalleObligaciones
      .filter(
        (item) =>
          item.tipo === "COMPRA" &&
          item.estadoPago ===
            "parcial" &&
          !item.cuantificable
      )
      .map(
        (item) => ({
          tipo:
            "COMPRA_PARCIAL",
          id:
            item.id,
          descripcion:
            item.descripcion,
          fechaVencimiento:
            item.fechaVencimiento
        })
      );

  const confiabilidad =
    resumenTesoreria
      .estadoConfiabilidad !==
      "COMPLETO"
      ? resumenTesoreria
          .estadoConfiabilidad
      : datos30dCompletos
        ? "COMPLETO"
        : "PARCIAL";

  const proximoVencimiento =
    detalle30.length
      ? detalle30[0]
      : null;

  return {
    generadoAt:
      fechaAhora,
    horizonte7d:
      hasta7,
    horizonte30d:
      hasta30,
    confiabilidad,
    estadoTesoreria:
      resumenTesoreria
        .estadoConfiabilidad,
    saldoActual,
    obligacionesRegistradas,
    politicaPriorizacionPagos,
    obligaciones: {
      vencidas:
        obligacionesVencidas,
      proximos7d:
        obligaciones7Resumen,
      proximos30d:
        obligaciones30Resumen,
      sinFecha: {
        cantidad:
          grupos.sinFecha
            .cantidad,
        montoCuantificado:
          grupos.sinFecha
            .montoCuantificado,
        noCuantificadas:
          grupos.sinFecha
            .noCuantificadas
      },
      detalle:
        detalle30.slice(
          0,
          30
        ),
      prioridadPago:
        obligacionesPriorizadas7d.slice(
          0,
          30
        )
    },
    cobrosEsperados: {
      vencidos:
        resumir(
          cobrosVencidos
        ),
      proximos7d:
        cobros7Resumen,
      proximos30d:
        cobros30Resumen,
      sinFecha: {
        cantidad:
          ventasSinFecha.length,
        monto:
          ventasSinFecha.reduce(
            (total, item) =>
              total +
              Number(
                item.total || 0
              ),
            0
          )
      },
      detalle:
        cobrosEsperados.slice(
          0,
          30
        ),
      prioridadCobro:
        carteraPriorizada.slice(
          0,
          30
        )
    },
    comprasParcialesSinSaldoExacto,
    proximoVencimiento,
    escenario7d: {
      estado:
        estado7d,
      saldoDespuesDeObligacionesConCajaActual:
        brechaCajaActual7d,
      saldoSiSeCobraTodoLoEsperado:
        escenarioCobroTotal7d,
      faltanteConCajaActual:
        brechaCajaActual7d !== null &&
        brechaCajaActual7d < 0
          ? Math.abs(
              brechaCajaActual7d
            )
          : 0,
      faltanteAunCobrandoTodo:
        escenarioCobroTotal7d !== null &&
        escenarioCobroTotal7d < 0
          ? Math.abs(
              escenarioCobroTotal7d
            )
          : 0
    },
    historico30d: {
      salidasConfirmadas:
        salidas30,
      promedioSalidaDiaria:
        Number(
          promedioSalidaDiaria30
            .toFixed(2)
        ),
      diasCoberturaSalidasHistoricas
    },
    advertencias: [
      ...(!datos30dCompletos
        ? [
            "La proyeccion de 30 dias es PARCIAL porque existen obligaciones sin fecha o montos pendientes no cuantificados."
          ]
        : []),
      ...(resumenTesoreria
          .estadoConfiabilidad !==
          "COMPLETO"
        ? [
            "El saldo actual no es completamente verificable porque Tesoreria no esta COMPLETA."
          ]
        : []),
      ...(grupos.sinFecha
          .cantidad
        ? [
            `Existen ${grupos.sinFecha.cantidad} obligacion(es) registrada(s) sin fecha de vencimiento; la cobertura de 7 dias no puede declararse completa.`
          ]
        : []),
      ...(obligacionesRegistradas
          .noCuantificadasExigibles
        ? [
            `Existen ${obligacionesRegistradas.noCuantificadasExigibles} obligacion(es) exigible(s) cuyo saldo pendiente no esta cuantificado.`
          ]
        : []),
      ...(comprasParcialesSinSaldoExacto
          .length
        ? [
            "Existen compras parcialmente pagadas sin saldo pendiente exacto; GRUK no usa el total del documento como deuda restante."
          ]
        : []),
      ...(ventasSinFecha.length
        ? [
            `Existen ${ventasSinFecha.length} venta(s) pendientes sin fecha de cobro; no se usan para cubrir obligaciones proyectadas.`
          ]
        : []),
      obligacionesRegistradas
        .advertencia,
      "Los cobros esperados son proyeccion, no caja disponible hasta que se confirmen."
    ]
  };
}

module.exports = {
  construirProyeccionTesoreria
};
