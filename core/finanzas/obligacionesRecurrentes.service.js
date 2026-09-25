"use strict";

const mongoose = require("mongoose");

const ObligacionRecurrente = require("./models/ObligacionRecurrente");
const eventBus = require("../eventos/eventBus");

function serviceError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function objectId(valor, nombre) {
  if (!mongoose.Types.ObjectId.isValid(valor)) {
    throw serviceError(
      400,
      `${nombre} invalido`
    );
  }

  return new mongoose.Types.ObjectId(
    String(valor)
  );
}

function fechaSegura(valor, nombre) {
  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    throw serviceError(
      400,
      `${nombre} invalida`
    );
  }

  return fecha;
}

function sumarFrecuencia(fecha, frecuencia) {
  const siguiente = new Date(fecha);

  if (frecuencia === "SEMANAL") {
    siguiente.setUTCDate(
      siguiente.getUTCDate() + 7
    );
    return siguiente;
  }

  if (frecuencia === "QUINCENAL") {
    siguiente.setUTCDate(
      siguiente.getUTCDate() + 15
    );
    return siguiente;
  }

  const meses = {
    MENSUAL: 1,
    BIMESTRAL: 2,
    TRIMESTRAL: 3,
    SEMESTRAL: 6,
    ANUAL: 12
  }[frecuencia];

  if (!meses) {
    throw serviceError(
      400,
      "Frecuencia invalida"
    );
  }

  siguiente.setUTCMonth(
    siguiente.getUTCMonth() + meses
  );

  return siguiente;
}

function generarVencimientos({
  obligacion,
  desde,
  hasta,
  maximo = 100
}) {
  const resultados = [];

  let cursor =
    new Date(
      obligacion.proximoVencimiento
    );

  const fechaFin =
    obligacion.fechaFin
      ? new Date(
          obligacion.fechaFin
        )
      : null;

  let guard = 0;

  while (
    cursor < hasta &&
    guard < maximo
  ) {
    if (
      cursor >= desde &&
      (
        !fechaFin ||
        cursor <= fechaFin
      )
    ) {
      resultados.push({
        obligacionRecurrenteId:
          obligacion._id,
        origenTipo:
          "RECURRENTE",
        sedeId:
          obligacion.sedeId || null,
        categoria:
          obligacion.categoria,
        tercero:
          obligacion.tercero || "",
        concepto:
          obligacion.nombre,
        fuenteMonto:
          obligacion.fuenteMonto,
        montoPendiente:
          Number(
            obligacion.monto
          ),
        cuantificable: true,
        estadoPago:
          "PROYECTADO",
        fechaVencimiento:
          new Date(cursor)
      });
    }

    if (
      fechaFin &&
      cursor > fechaFin
    ) {
      break;
    }

    cursor =
      sumarFrecuencia(
        cursor,
        obligacion.frecuencia
      );

    guard += 1;
  }

  return resultados;
}

async function crearObligacionRecurrente({
  empresaId,
  sedeId = null,
  nombre,
  categoria,
  monto,
  frecuencia,
  proximoVencimiento,
  fechaFin = null,
  tercero = "",
  notas = "",
  fuenteMonto,
  createdBy
}) {
  const montoNumero =
    Number(monto);

  if (
    !Number.isFinite(montoNumero) ||
    montoNumero <= 0
  ) {
    throw serviceError(
      400,
      "Monto invalido"
    );
  }

  const vencimiento =
    fechaSegura(
      proximoVencimiento,
      "proximoVencimiento"
    );

  const fin =
    fechaFin
      ? fechaSegura(
          fechaFin,
          "fechaFin"
        )
      : null;

  if (
    fin &&
    fin < vencimiento
  ) {
    throw serviceError(
      400,
      "fechaFin no puede ser anterior al proximo vencimiento"
    );
  }

  const documento =
    await ObligacionRecurrente.create({
      empresaId:
        objectId(
          empresaId,
          "empresaId"
        ),
      sedeId:
        sedeId
          ? objectId(
              sedeId,
              "sedeId"
            )
          : null,
      nombre:
        String(nombre || "")
          .trim(),
      categoria,
      monto:
        montoNumero,
      frecuencia,
      proximoVencimiento:
        vencimiento,
      fechaFin:
        fin,
      tercero:
        String(tercero || "")
          .trim(),
      notas:
        String(notas || "")
          .trim(),
      fuenteMonto,
      estado:
        "activa",
      createdBy:
        objectId(
          createdBy,
          "createdBy"
        ),
      deletedAt: null
    });

  eventBus.emit(
    "OBLIGACION_RECURRENTE_CREADA",
    {
      empresaId:
        documento.empresaId,
      sedeId:
        documento.sedeId,
      obligacionRecurrenteId:
        documento._id,
      categoria:
        documento.categoria,
      monto:
        documento.monto,
      proximoVencimiento:
        documento.proximoVencimiento
    }
  );

  return documento.toObject();
}

async function listarObligacionesRecurrentes({
  empresaId,
  sedeId = null
}) {
  const filtro = {
    empresaId:
      objectId(
        empresaId,
        "empresaId"
      ),
    estado: "activa",
    deletedAt: null
  };

  if (sedeId) {
    filtro.sedeId =
      objectId(
        sedeId,
        "sedeId"
      );
  }

  return ObligacionRecurrente.find(
    filtro
  )
    .sort({
      proximoVencimiento: 1,
      nombre: 1
    })
    .lean();
}

async function obtenerVencimientosRecurrentes({
  empresaId,
  sedeId = null,
  desde,
  hasta
}) {
  const obligaciones =
    await listarObligacionesRecurrentes({
      empresaId,
      sedeId
    });

  const inicio =
    fechaSegura(
      desde,
      "desde"
    );

  const fin =
    fechaSegura(
      hasta,
      "hasta"
    );

  if (inicio >= fin) {
    throw serviceError(
      400,
      "Periodo recurrente invalido"
    );
  }

  return obligaciones
    .flatMap(
      (obligacion) =>
        generarVencimientos({
          obligacion,
          desde: inicio,
          hasta: fin
        })
    )
    .sort(
      (a, b) =>
        a.fechaVencimiento -
        b.fechaVencimiento
    );
}

async function desactivarObligacionRecurrente({
  empresaId,
  sedeId = null,
  obligacionId
}) {
  const filtro = {
    _id:
      objectId(
        obligacionId,
        "obligacionId"
      ),
    empresaId:
      objectId(
        empresaId,
        "empresaId"
      ),
    estado: "activa",
    deletedAt: null
  };

  if (sedeId) {
    filtro.sedeId =
      objectId(
        sedeId,
        "sedeId"
      );
  }

  const documento =
    await ObligacionRecurrente.findOneAndUpdate(
      filtro,
      {
        $set: {
          estado: "inactiva"
        }
      },
      {
        new: true
      }
    ).lean();

  if (!documento) {
    throw serviceError(
      404,
      "Obligacion recurrente no encontrada"
    );
  }

  eventBus.emit(
    "OBLIGACION_RECURRENTE_DESACTIVADA",
    {
      empresaId:
        documento.empresaId,
      sedeId:
        documento.sedeId,
      obligacionRecurrenteId:
        documento._id
    }
  );

  return documento;
}

module.exports = {
  sumarFrecuencia,
  generarVencimientos,
  crearObligacionRecurrente,
  listarObligacionesRecurrentes,
  obtenerVencimientosRecurrentes,
  desactivarObligacionRecurrente
};
