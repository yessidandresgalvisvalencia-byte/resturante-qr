"use strict";

const mongoose = require("mongoose");

const Cliente = require("../../models/Cliente");
const ClienteIdentidad = require("../../models/ClienteIdentidad");
const Sede = require("../../models/sede");
const {
  TIPOS_IDENTIDAD,
  generarIdentidadHash
} = require("./identidad.service");

function validarObjectId(nombre, valor) {
  if (!valor || !mongoose.Types.ObjectId.isValid(valor)) {
    throw new Error(`GRUK_CLIENTE: ${nombre} invalido`);
  }
}

function validarActor({ actorType, createdBy }) {
  if (!["USUARIO", "SISTEMA"].includes(actorType)) {
    throw new Error("GRUK_CLIENTE: actorType invalido");
  }

  if (actorType === "USUARIO") {
    validarObjectId("createdBy", createdBy);
  }

  if (actorType === "SISTEMA" && createdBy) {
    throw new Error(
      "GRUK_CLIENTE: un actor SISTEMA no debe tener createdBy"
    );
  }
}

async function buscarClientePorIdentidad({
  empresaId,
  tipo,
  hash,
  session = null
}) {
  let query = ClienteIdentidad.findOne({
    empresaId,
    tipo,
    hash,
    deletedAt: null
  });

  if (session) {
    query = query.session(session);
  }

  const identidad = await query;

  if (!identidad) {
    return null;
  }

  let clienteQuery = Cliente.findOne({
    _id: identidad.clienteId,
    empresaId,
    deletedAt: null
  });

  if (session) {
    clienteQuery = clienteQuery.session(session);
  }

  const cliente = await clienteQuery;

  if (!cliente) {
    throw new Error(
      "GRUK_CLIENTE: identidad activa apunta a cliente inexistente o eliminado"
    );
  }

  return cliente;
}

async function obtenerOCrearClientePorIdentidad({
  empresaId,
  sedeId,
  tipo,
  valor,
  actorType = "SISTEMA",
  createdBy = null
}) {
  validarObjectId("empresaId", empresaId);
  validarObjectId("sedeId", sedeId);

  if (!TIPOS_IDENTIDAD.includes(tipo)) {
    throw new Error("GRUK_CLIENTE: tipo de identidad invalido");
  }

  validarActor({ actorType, createdBy });

  const sedeValida = await Sede.exists({
    _id: sedeId,
    empresaId
  });

  if (!sedeValida) {
    throw new Error(
      "GRUK_CLIENTE: sede no pertenece a la empresa"
    );
  }

  const hash = generarIdentidadHash({
    empresaId,
    tipo,
    valor
  });

  const existente = await buscarClientePorIdentidad({
    empresaId,
    tipo,
    hash
  });

  if (existente) {
    return {
      cliente: existente,
      creado: false
    };
  }

  const session = await mongoose.startSession();

  try {
    let clienteCreado = null;
    let creadoEnEstaTransaccion = false;

    await session.withTransaction(async () => {
      clienteCreado = null;
      creadoEnEstaTransaccion = false;

      const identidadExistente =
        await ClienteIdentidad.findOne({
          empresaId,
          tipo,
          hash,
          deletedAt: null
        }).session(session);

      if (identidadExistente) {
        clienteCreado = await Cliente.findOne({
          _id: identidadExistente.clienteId,
          empresaId,
          deletedAt: null
        }).session(session);

        if (!clienteCreado) {
          throw new Error(
            "GRUK_CLIENTE: identidad activa apunta a cliente inexistente"
          );
        }

        return;
      }

      const clientes = await Cliente.create(
        [
          {
            empresaId,
            sedeId,
            primeraCompraAt: null,
            ultimaCompraAt: null,
            numeroCompras: 0,
            createdBy:
              actorType === "USUARIO"
                ? createdBy
                : null,
            actorType,
            deletedAt: null
          }
        ],
        { session }
      );

      clienteCreado = clientes[0];
      creadoEnEstaTransaccion = true;

      await ClienteIdentidad.create(
        [
          {
            empresaId,
            sedeId,
            clienteId: clienteCreado._id,
            tipo,
            hash,
            createdBy:
              actorType === "USUARIO"
                ? createdBy
                : null,
            actorType,
            deletedAt: null
          }
        ],
        { session }
      );
    });

    if (!clienteCreado) {
      throw new Error(
        "GRUK_CLIENTE: transaccion finalizo sin resolver cliente"
      );
    }

    return {
      cliente: clienteCreado,
      creado: creadoEnEstaTransaccion
    };
  } catch (error) {
    if (error && error.code === 11000) {
      const esperasMs = [0, 25, 75];

      for (const esperaMs of esperasMs) {
        if (esperaMs > 0) {
          await new Promise(resolve =>
            setTimeout(resolve, esperaMs)
          );
        }

        const ganador =
          await buscarClientePorIdentidad({
            empresaId,
            tipo,
            hash
          });

        if (ganador) {
          return {
            cliente: ganador,
            creado: false
          };
        }
      }
    }

    throw error;
  } finally {
    await session.endSession();
  }
}

module.exports = {
  buscarClientePorIdentidad,
  obtenerOCrearClientePorIdentidad
};
