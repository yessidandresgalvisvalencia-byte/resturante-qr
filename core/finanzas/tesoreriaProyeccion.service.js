"use strict";

const mongoose = require("mongoose");

const Compra = require("../../models/Compra");
const Gasto = require("../../models/Gasto");
const Venta = require("../../models/Venta");
const {
  obtenerResumenCaja
} = require("./caja.service");
const {
  obtenerResumenTesoreria
} = require("./tesoreria.service");

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
          Number(
            item.monto || 0
          ),
        0
      )
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

  const [
    comprasPendientes,
    comprasParciales,
    gastosPendientes,
    ventasPendientes,
    resumenCaja30
  ] = await Promise.all([
    Compra.find({
      ...scope,
      estado:
        "registrada",
      estadoPago:
        "pendiente",
      fechaVencimientoPago: {
        $ne: null,
        $lte: hasta30
      }
    })
      .select(
        "_id proveedor total fechaVencimientoPago"
      )
      .sort({
        fechaVencimientoPago: 1
      })
      .lean(),

    Compra.find({
      ...scope,
      estado:
        "registrada",
      estadoPago:
        "parcial",
      fechaVencimientoPago: {
        $ne: null,
        $lte: hasta30
      }
    })
      .select(
        "_id proveedor total fechaVencimientoPago"
      )
      .sort({
        fechaVencimientoPago: 1
      })
      .lean(),

    Gasto.find({
      ...scope,
      estado:
        "registrado",
      estadoPago: {
        $ne: "pagado"
      },
      fechaVencimientoPago: {
        $ne: null,
        $lte: hasta30
      }
    })
      .select(
        "_id concepto proveedor monto estadoPago fechaVencimientoPago"
      )
      .sort({
        fechaVencimientoPago: 1
      })
      .lean(),

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
    })
  ]);

  const obligaciones = [
    ...comprasPendientes.map(
      (item) => ({
        tipo:
          "COMPRA",
        id:
          item._id,
        descripcion:
          item.proveedor ||
          "Compra pendiente",
        monto:
          Number(
            item.total || 0
          ),
        fechaVencimiento:
          item.fechaVencimientoPago
      })
    ),
    ...gastosPendientes.map(
      (item) => ({
        tipo:
          "GASTO",
        id:
          item._id,
        descripcion:
          item.concepto ||
          item.proveedor ||
          "Gasto pendiente",
        monto:
          Number(
            item.monto || 0
          ),
        fechaVencimiento:
          item.fechaVencimientoPago
      })
    )
  ]
    .map((item) => ({
      ...item,
      clasificacion:
        clasificarFecha(
          new Date(
            item.fechaVencimiento
          ),
          fechaAhora,
          hasta7,
          hasta30
        )
    }))
    .sort(
      (a, b) =>
        new Date(
          a.fechaVencimiento
        ) -
        new Date(
          b.fechaVencimiento
        )
    );

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

  const obligacionesVencidas =
    obligaciones.filter(
      (item) =>
        item.clasificacion ===
        "VENCIDA"
    );

  const obligaciones7 =
    obligaciones.filter(
      (item) =>
        item.clasificacion ===
        "VENCIDA" ||
        item.clasificacion ===
          "PROXIMOS_7_DIAS"
    );

  const obligaciones30 =
    obligaciones.filter(
      (item) =>
        item.clasificacion !==
        "POSTERIOR"
    );

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

  const resumenTesoreria =
    tesoreria ||
    await obtenerResumenTesoreria({
      empresaId,
      sedeId
    });

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

  const obligaciones7Resumen =
    resumir(
      obligaciones7
    );

  const cobros7Resumen =
    resumir(
      cobros7
    );

  const obligaciones30Resumen =
    resumir(
      obligaciones30
    );

  const cobros30Resumen =
    resumir(
      cobros30
    );

  const brechaCajaActual7d =
    saldoActual === null
      ? null
      : saldoActual -
        obligaciones7Resumen.monto;

  const escenarioCobroTotal7d =
    saldoActual === null
      ? null
      : saldoActual +
        cobros7Resumen.monto -
        obligaciones7Resumen.monto;

  let estado7d =
    "SIN_SALDO_VERIFICABLE";

  if (
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

  const parcialesSinSaldoExacto =
    comprasParciales.map(
      (item) => ({
        tipo:
          "COMPRA_PARCIAL",
        id:
          item._id,
        descripcion:
          item.proveedor ||
          "Compra parcialmente pagada",
        totalDocumento:
          Number(
            item.total || 0
          ),
        fechaVencimiento:
          item.fechaVencimientoPago
      })
    );

  const confiabilidad =
    resumenTesoreria
      .estadoConfiabilidad !==
      "COMPLETO"
      ? resumenTesoreria
          .estadoConfiabilidad
      : parcialesSinSaldoExacto
          .length
        ? "PARCIAL"
        : "COMPLETO";

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
    obligaciones: {
      vencidas:
        resumir(
          obligacionesVencidas
        ),
      proximos7d:
        obligaciones7Resumen,
      proximos30d:
        obligaciones30Resumen,
      detalle:
        obligaciones.slice(
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
      detalle:
        cobrosEsperados.slice(
          0,
          30
        )
    },
    comprasParcialesSinSaldoExacto:
      parcialesSinSaldoExacto,
    proximoVencimiento:
      obligaciones[0] || null,
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
      ...(resumenTesoreria
          .estadoConfiabilidad !==
          "COMPLETO"
        ? [
            "El saldo actual no es completamente verificable porque Tesoreria no esta COMPLETA."
          ]
        : []),
      ...(parcialesSinSaldoExacto
          .length
        ? [
            "Existen compras parcialmente pagadas sin monto pagado acumulado; su saldo pendiente exacto no puede proyectarse sin inventar datos."
          ]
        : []),
      "Los cobros esperados son proyeccion, no caja disponible hasta que se confirmen."
    ]
  };
}

module.exports = {
  construirProyeccionTesoreria
};
