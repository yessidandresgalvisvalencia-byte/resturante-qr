"use strict";

const mongoose = require("mongoose");
const ExcepcionPrioridadPago = require(
  "./models/ExcepcionPrioridadPago"
);
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

function fechaFutura(valor) {
  const fecha = new Date(valor);

  if (
    Number.isNaN(fecha.getTime()) ||
    fecha <= new Date()
  ) {
    throw serviceError(
      400,
      "expiresAt debe ser una fecha futura valida"
    );
  }

  return fecha;
}

async function listarExcepcionesActivas({
  empresaId,
  sedeId = null,
  ahora = new Date()
}) {
  const filtro = {
    empresaId:
      objectId(
        empresaId,
        "empresaId"
      ),
    revokedAt: null,
    deletedAt: null,
    expiresAt: {
      $gt: ahora
    }
  };

  if (sedeId) {
    filtro.sedeId =
      objectId(
        sedeId,
        "sedeId"
      );
  }

  return ExcepcionPrioridadPago.find(
    filtro
  )
    .sort({
      createdAt: 1
    })
    .lean();
}

async function crearExcepcionPrioridadPago({
  empresaId,
  sedeId = null,
  origenTipo,
  origenId,
  motivo,
  expiresAt,
  createdBy
}) {
  const empresaObjectId =
    objectId(
      empresaId,
      "empresaId"
    );

  const origenObjectId =
    objectId(
      origenId,
      "origenId"
    );

  const existente =
    await ExcepcionPrioridadPago.findOne({
      empresaId:
        empresaObjectId,
      origenTipo,
      origenId:
        origenObjectId,
      revokedAt: null,
      deletedAt: null,
      expiresAt: {
        $gt: new Date()
      }
    })
      .select("_id")
      .lean();

  if (existente) {
    throw serviceError(
      409,
      "Ya existe una excepcion activa para esta obligacion"
    );
  }

  const documento =
    await ExcepcionPrioridadPago.create({
      empresaId:
        empresaObjectId,
      sedeId:
        sedeId
          ? objectId(
              sedeId,
              "sedeId"
            )
          : null,
      origenTipo,
      origenId:
        origenObjectId,
      motivo:
        String(motivo || "")
          .trim(),
      expiresAt:
        fechaFutura(
          expiresAt
        ),
      createdBy:
        objectId(
          createdBy,
          "createdBy"
        ),
      revokedAt: null,
      revokedBy: null,
      deletedAt: null
    });

  eventBus.emit(
    "EXCEPCION_PRIORIDAD_PAGO_CREADA",
    {
      empresaId:
        documento.empresaId,
      sedeId:
        documento.sedeId,
      excepcionId:
        documento._id,
      origenTipo:
        documento.origenTipo,
      origenId:
        documento.origenId,
      expiresAt:
        documento.expiresAt,
      createdBy:
        documento.createdBy
    }
  );

  return documento.toObject();
}

async function revocarExcepcionPrioridadPago({
  empresaId,
  excepcionId,
  revokedBy
}) {
  const ahora = new Date();

  const documento =
    await ExcepcionPrioridadPago.findOneAndUpdate(
      {
        _id:
          objectId(
            excepcionId,
            "excepcionId"
          ),
        empresaId:
          objectId(
            empresaId,
            "empresaId"
          ),
        revokedAt: null,
        deletedAt: null
      },
      {
        $set: {
          revokedAt:
            ahora,
          revokedBy:
            objectId(
              revokedBy,
              "revokedBy"
            )
        }
      },
      {
        new: true
      }
    ).lean();

  if (!documento) {
    throw serviceError(
      404,
      "Excepcion activa no encontrada"
    );
  }

  eventBus.emit(
    "EXCEPCION_PRIORIDAD_PAGO_REVOCADA",
    {
      empresaId:
        documento.empresaId,
      sedeId:
        documento.sedeId,
      excepcionId:
        documento._id,
      origenTipo:
        documento.origenTipo,
      origenId:
        documento.origenId,
      revokedBy:
        documento.revokedBy
    }
  );

  return documento;
}

function indexarExcepciones(excepciones) {
  const mapa = new Map();

  for (const item of excepciones || []) {
    mapa.set(
      `${item.origenTipo}:${String(item.origenId)}`,
      item
    );
  }

  return mapa;
}

function obtenerExcepcionParaObligacion(
  item,
  mapa
) {
  if (!mapa) return null;

  const tipo =
    item.tipo ||
    item.origenTipo;

  const id =
    item.id ||
    item.origenId;

  if (!tipo || !id) {
    return null;
  }

  return (
    mapa.get(
      `${tipo}:${String(id)}`
    ) || null
  );
}

module.exports = {
  listarExcepcionesActivas,
  crearExcepcionPrioridadPago,
  revocarExcepcionPrioridadPago,
  indexarExcepciones,
  obtenerExcepcionParaObligacion
};
