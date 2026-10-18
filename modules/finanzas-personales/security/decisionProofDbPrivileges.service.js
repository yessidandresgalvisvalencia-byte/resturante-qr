"use strict";

// Auditoría de privilegios efectivos de la conexión financiera.
// No modifica roles, credenciales, documentos ni índices.
const DecisionProof = require("../models/decisionProofPersonal.model");

const DANGEROUS_ACTIONS = new Set([
  "update", "remove", "dropCollection", "dropDatabase",
  "collMod", "anyAction", "grantRole", "revokeRole",
  "createRole", "updateRole", "dropRole", "createUser",
  "updateUser", "dropUser", "grantPrivilegesToRole",
  "revokePrivilegesFromRole"
]);

function aplicaAlHistorial(resource, dbName, collectionName) {
  if (!resource || typeof resource !== "object") return false;
  if (resource.anyResource === true) return true;
  if (resource.cluster === true) return false;
  const db = resource.db;
  const collection = resource.collection;
  // Un recurso con db "" cubre todas las bases de datos.
  const dbCoincide = db === "" || db === dbName;
  const coleccionCoincide = collection === "" || collection === collectionName;
  return dbCoincide && coleccionCoincide;
}

function detectarPrivilegiosPeligrosos(privilegios, dbName, collectionName) {
  if (!Array.isArray(privilegios)) throw new TypeError("Lista de privilegios inválida");
  if (!dbName || !collectionName) throw new TypeError("Base y colección obligatorias");
  const hallazgos = new Set();
  for (const permiso of privilegios) {
    if (!aplicaAlHistorial(permiso?.resource, dbName, collectionName)) continue;
    for (const accion of permiso.actions || []) {
      if (DANGEROUS_ACTIONS.has(accion)) hallazgos.add(accion);
    }
  }
  return [...hallazgos].sort();
}

async function auditarPrivilegiosHistorial(db) {
  if (!db || typeof db.command !== "function") throw new TypeError("Conexión MongoDB inválida");
  const base = db.databaseName;
  const coleccion = DecisionProof.collection.collectionName;
  // En versiones de MongoDB compatibles, connectionStatus expone
  // authenticatedUserPrivileges y los roles efectivos.
  const estado = await db.command({ connectionStatus: 1, showPrivileges: true });
  const info = estado.authInfo;
  if (!info || !Array.isArray(info.authenticatedUserPrivileges)) {
    return { seguro: false, codigo: "PRIVILEGIOS_NO_VERIFICABLES", base, coleccion, acciones: [] };
  }
  const acciones = detectarPrivilegiosPeligrosos(
    info.authenticatedUserPrivileges, base, coleccion
  );
  return {
    seguro: acciones.length === 0,
    codigo: acciones.length ? "PRIVILEGIOS_PELIGROSOS" : "SOLO_INSERCION_VERIFICADA",
    base, coleccion, acciones
  };
}

module.exports = { aplicaAlHistorial, detectarPrivilegiosPeligrosos, auditarPrivilegiosHistorial };
