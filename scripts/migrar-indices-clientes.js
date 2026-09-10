"use strict";

require("dotenv").config();

const mongoose = require("mongoose");

const Cliente = require("../models/Cliente");
const ClienteIdentidad = require("../models/ClienteIdentidad");

const APPLY = process.argv.includes("--apply");

const INDEX_NAME = "uq_cliente_identidad_activa";

const EXPECTED_KEY = {
  empresaId: 1,
  tipo: 1,
  hashVersion: 1,
  hash: 1
};

async function coleccionExiste(nombre) {
  const resultado = await mongoose.connection.db
    .listCollections(
      { name: nombre },
      { nameOnly: true }
    )
    .toArray();

  return resultado.length === 1;
}

async function obtenerIndices(nombre, existe) {
  if (!existe) {
    return [];
  }

  return mongoose.connection.db
    .collection(nombre)
    .indexes();
}

function validarIndice(indices) {
  const porNombre = indices.find(
    index => index.name === INDEX_NAME
  );

  if (porNombre) {
    const mismaClave =
      JSON.stringify(porNombre.key) ===
      JSON.stringify(EXPECTED_KEY);

    const esUnico = porNombre.unique === true;

    const partial =
      porNombre.partialFilterExpression;

    const mismoPartial =
      partial &&
      partial.deletedAt === null &&
      Object.keys(partial).length === 1;

    if (!mismaClave || !esUnico || !mismoPartial) {
      throw new Error(
        "ABORTADO: " +
          INDEX_NAME +
          " existe con definicion incompatible"
      );
    }

    return "COMPATIBLE";
  }

  const equivalente = indices.find(
    index =>
      JSON.stringify(index.key) ===
      JSON.stringify(EXPECTED_KEY)
  );

  if (equivalente) {
    throw new Error(
      "ABORTADO: existe indice equivalente no controlado: " +
        equivalente.name
    );
  }

  return "AUSENTE";
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI no configurado");
  }

  const mongoOptions = {
    autoIndex: false,
    autoCreate: false
  };

  if (process.env.MONGO_DB) {
    mongoOptions.dbName = process.env.MONGO_DB;
  }

  await mongoose.connect(
    process.env.MONGO_URI,
    mongoOptions
  );

  const clienteCollection =
    Cliente.collection.collectionName;

  const identidadCollection =
    ClienteIdentidad.collection.collectionName;

  console.log("GRUK indices clientes");
  console.log("DB:", mongoose.connection.name);
  console.log("Modo:", APPLY ? "APPLY" : "INSPECCION");

  const existeCliente =
    await coleccionExiste(clienteCollection);

  const existeIdentidad =
    await coleccionExiste(identidadCollection);

  const indicesIdentidad =
    await obtenerIndices(
      identidadCollection,
      existeIdentidad
    );

  const estadoIndice =
    validarIndice(indicesIdentidad);

  console.log(
    "Coleccion clientes existe:",
    existeCliente
  );

  console.log(
    "Coleccion clienteidentidads existe:",
    existeIdentidad
  );

  console.log(
    "Indice identidad:",
    estadoIndice
  );

  if (!APPLY) {
    console.log(
      "INSPECCION terminada. No se realizaron escrituras."
    );
    return;
  }

  /*
   * PRECONDITION:
   * Toda incompatibilidad de indices fue validada
   * antes de iniciar DDL.
   */

  if (!existeCliente) {
    await mongoose.connection.db.createCollection(
      clienteCollection
    );

    console.log(
      "OK: coleccion clientes creada"
    );
  }

  if (!existeIdentidad) {
    await mongoose.connection.db.createCollection(
      identidadCollection
    );

    console.log(
      "OK: coleccion clienteidentidads creada"
    );
  }

  if (estadoIndice === "AUSENTE") {
    await mongoose.connection.db
      .collection(identidadCollection)
      .createIndex(
        EXPECTED_KEY,
        {
          name: INDEX_NAME,
          unique: true,
          partialFilterExpression: {
            deletedAt: null
          }
        }
      );

    console.log(
      "OK: indice unico de identidad creado"
    );
  } else {
    console.log(
      "OK: indice unico ya existe y es compatible"
    );
  }

  console.log(
    "APPLY terminado correctamente."
  );
}

main()
  .catch(error => {
    console.error(
      "ERROR migrando indices de clientes:",
      error.message
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
