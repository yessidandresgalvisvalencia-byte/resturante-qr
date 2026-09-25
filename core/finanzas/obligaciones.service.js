"use strict";

const mongoose = require("mongoose");

const Compra = require("../../models/Compra");
const Gasto = require("../../models/Gasto");
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

function fechaValida(valor) {
  if (!valor) return null;

  const fecha = new Date(valor);

  return Number.isNaN(
    fecha.getTime()
  )
    ? null
    : fecha;
}

function inicioDiaUTC(fecha) {
  return new Date(
    Date.UTC(
      fecha.getUTCFullYear(),
      fecha.getUTCMonth(),
      fecha.getUTCDate(),
      0,
      0,
      0,
      0
    )
  );
}

function sumarDiasUTC(fecha, dias) {
  return new Date(
    fecha.getTime() +
    dias * 24 * 60 * 60 * 1000
  );
}

function clasificarVencimiento(
  fechaVencimiento,
  hoy
) {
  if (!fechaVencimiento) {
    return "SIN_FECHA";
  }

  const vencimiento =
    inicioDiaUTC(
      fechaVencimiento
    );

  const base =
    inicioDiaUTC(hoy);

  if (vencimiento < base) {
    return "VENCIDA";
  }

  if (
    vencimiento <
    sumarDiasUTC(base, 8)
  ) {
    return "PROXIMOS_7_DIAS";
  }

  if (
    vencimiento <
    sumarDiasUTC(base, 31)
  ) {
    return "DIAS_8_A_30";
  }

  return "POSTERIOR_30_DIAS";
}

function pendienteCompra(compra) {
  if (
    compra.estadoPago === "pagado"
  ) {
    return {
      cuantificable: true,
      monto: 0
    };
  }

  if (
    compra.estadoPago === "pendiente"
  ) {
    return {
      cuantificable: true,
      monto:
        Number(compra.total || 0)
    };
  }

  if (
    compra.estadoPago === "parcial"
  ) {
    const saldo =
      Number(
        compra.saldoPendientePago
      );

    if (
      Number.isFinite(saldo) &&
      saldo > 0
    ) {
      return {
        cuantificable: true,
        monto: saldo
      };
    }

    return {
      cuantificable: false,
      monto: null
    };
  }

  return {
    cuantificable: false,
    monto: null
  };
}

function pendienteGasto(gasto) {
  if (
    gasto.estadoPago === "pagado"
  ) {
    return {
      cuantificable: true,
      monto: 0
    };
  }

  if (
    gasto.estadoPago ===
    "pendiente"
  ) {
    return {
      cuantificable: true,
      monto:
        Number(gasto.monto || 0)
    };
  }

  // "desconocido" significa que GRUK no puede
  // afirmar si sigue pendiente o si ya se pagó.
  return {
    cuantificable: false,
    monto: null
  };
}

function crearGrupo() {
  return {
    cantidad: 0,
    montoCuantificado: 0,
    noCuantificadas: 0,
    items: []
  };
}

function agregarAGrupo(
  grupo,
  item
) {
  grupo.cantidad += 1;

  if (item.cuantificable) {
    grupo.montoCuantificado +=
      Number(
        item.montoPendiente || 0
      );
  } else {
    grupo.noCuantificadas += 1;
  }

  grupo.items.push(item);
}

async function obtenerObligacionesRegistradas({
  empresaId,
  sedeId = null,
  ahora = new Date()
}) {
  const empresaObjectId =
    objectId(
      empresaId,
      "empresaId"
    );

  const filtroSede =
    sedeId
      ? {
          sedeId:
            objectId(
              sedeId,
              "sedeId"
            )
        }
      : {};

  const [
    compras,
    gastos,
    tesoreria
  ] = await Promise.all([
    Compra.find({
      empresaId:
        empresaObjectId,
      ...filtroSede,
      estado: "registrada",
      estadoPago: {
        $in: [
          "pendiente",
          "parcial"
        ]
      }
    })
      .select(
        "_id sedeId proveedor numeroDocumento total estadoPago saldoPendientePago fechaVencimientoPago fecha"
      )
      .lean(),

    Gasto.find({
      empresaId:
        empresaObjectId,
      ...filtroSede,
      estado: "registrado",
      estadoPago: {
        $in: [
          "pendiente",
          "desconocido"
        ]
      }
    })
      .select(
        "_id sedeId concepto proveedor monto estadoPago fechaVencimientoPago fecha"
      )
      .lean(),

    obtenerResumenTesoreria({
      empresaId:
        empresaObjectId,
      sedeId:
        sedeId || null
    })
  ]);

  const grupos = {
    vencidas:
      crearGrupo(),
    proximos7Dias:
      crearGrupo(),
    dias8a30:
      crearGrupo(),
    sinFecha:
      crearGrupo(),
    posterior30Dias:
      crearGrupo()
  };

  const todos = [];

  for (const compra of compras) {
    const pendiente =
      pendienteCompra(compra);

    todos.push({
      origenTipo: "COMPRA",
      origenId:
        compra._id,
      sedeId:
        compra.sedeId || null,
      tercero:
        compra.proveedor || "",
      concepto:
        compra.numeroDocumento
          ? `Compra ${compra.numeroDocumento}`
          : "Compra a proveedor",
      estadoPago:
        compra.estadoPago,
      fechaVencimiento:
        fechaValida(
          compra.fechaVencimientoPago
        ),
      cuantificable:
        pendiente.cuantificable,
      montoPendiente:
        pendiente.monto
    });
  }

  for (const gasto of gastos) {
    const pendiente =
      pendienteGasto(gasto);

    todos.push({
      origenTipo: "GASTO",
      origenId:
        gasto._id,
      sedeId:
        gasto.sedeId || null,
      tercero:
        gasto.proveedor || "",
      concepto:
        gasto.concepto || "Gasto",
      estadoPago:
        gasto.estadoPago,
      fechaVencimiento:
        fechaValida(
          gasto.fechaVencimientoPago
        ),
      cuantificable:
        pendiente.cuantificable,
      montoPendiente:
        pendiente.monto
    });
  }

  for (const item of todos) {
    const clasificacion =
      clasificarVencimiento(
        item.fechaVencimiento,
        ahora
      );

    if (
      clasificacion === "VENCIDA"
    ) {
      agregarAGrupo(
        grupos.vencidas,
        item
      );
    } else if (
      clasificacion ===
      "PROXIMOS_7_DIAS"
    ) {
      agregarAGrupo(
        grupos.proximos7Dias,
        item
      );
    } else if (
      clasificacion ===
      "DIAS_8_A_30"
    ) {
      agregarAGrupo(
        grupos.dias8a30,
        item
      );
    } else if (
      clasificacion ===
      "POSTERIOR_30_DIAS"
    ) {
      agregarAGrupo(
        grupos.posterior30Dias,
        item
      );
    } else {
      agregarAGrupo(
        grupos.sinFecha,
        item
      );
    }
  }

  const montoExigible7Dias =
    grupos.vencidas
      .montoCuantificado +
    grupos.proximos7Dias
      .montoCuantificado;

  const noCuantificadasExigibles =
    grupos.vencidas
      .noCuantificadas +
    grupos.proximos7Dias
      .noCuantificadas;

  const faltantesCriticos =
    grupos.sinFecha.cantidad +
    noCuantificadasExigibles;

  const tesoreriaCompleta =
    tesoreria
      .estadoConfiabilidad ===
    "COMPLETO";

  const coberturaConfiable =
    tesoreriaCompleta &&
    faltantesCriticos === 0;

  const saldoDisponible =
    tesoreriaCompleta
      ? Number(
          tesoreria
            .saldoDisponible || 0
        )
      : null;

  const saldoDespues7Dias =
    coberturaConfiable
      ? saldoDisponible -
        montoExigible7Dias
      : null;

  const cobertura7Dias =
    !tesoreriaCompleta
      ? "NO_CALCULABLE_TESORERIA"
      : faltantesCriticos > 0
        ? "NO_CONFIABLE_DATOS_FALTANTES"
        : saldoDespues7Dias < 0
          ? "INSUFICIENTE"
          : "SUFICIENTE";

  return {
    generadoAt: ahora,
    alcance:
      "OBLIGACIONES_REGISTRADAS_GRUK",
    advertencia:
      "Esta cobertura solo incluye compras y gastos registrados en GRUK. No incluye nomina, impuestos, deuda u otras obligaciones que no esten registradas.",
    tesoreria: {
      estadoConfiabilidad:
        tesoreria
          .estadoConfiabilidad,
      saldoDisponible:
        tesoreria
          .saldoDisponible
    },
    grupos,
    montoExigible7Dias,
    noCuantificadasExigibles,
    obligacionesSinFecha:
      grupos.sinFecha.cantidad,
    cobertura7Dias,
    saldoDespues7Dias
  };
}

module.exports = {
  clasificarVencimiento,
  pendienteCompra,
  pendienteGasto,
  obtenerObligacionesRegistradas
};
