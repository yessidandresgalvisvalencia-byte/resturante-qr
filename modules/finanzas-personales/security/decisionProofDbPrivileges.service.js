"use strict";

// Auditoría de privilegios efectivos de la conexión financiera.
// No modifica roles, credenciales, documentos ni índices.
const DecisionProof = require("../models/decisionProofPersonal.model");

const DANGEROUS_ACTIONS = new Set([
  "update", "remove", "dropCollection", "dropDatabase",
  "collMod", "anyAction", "grantRole", "revokeRole",
  "createRole", "updateRole", "dropRole", "createUser",
  "dropIndex", "renameCollectionSameDB", "renameCollection",
  "updateUser", "dropUser", "grantPrivilegesToRole",
  "revokePrivilegesFromRole", "bypassDocumentValidation"
]);

function aplicaAlHistorial(resource, dbName, collectionName) {
  if (!resource || typeof resource !== "object") return false;
  if (resource.anyResource === true) return true;
  // Privilegios administrativos de ámbito clúster también requieren revisión.
  // Las acciones inocuas continúan filtrándose mediante DANGEROUS_ACTIONS.
  if (resource.cluster === true) return true;
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
  // Sin usuarios autenticados, MongoDB puede estar funcionando sin control de acceso.
  // Una lista vacía de permisos NO demuestra aislamiento en ese escenario.
  if (!Array.isArray(info.authenticatedUsers) || info.authenticatedUsers.length === 0) {
    return { seguro: false, codigo: "SIN_AUTENTICACION_VERIFICABLE", base, coleccion, acciones: [] };
  }
  if (!Array.isArray(info.authenticatedUserRoles) || info.authenticatedUserRoles.length === 0) {
    return { seguro: false, codigo: "ROLES_NO_VERIFICABLES", base, coleccion, acciones: [] };
  }
  // Una respuesta parcial o mal formada no puede interpretarse como
  // ausencia de permisos peligrosos (fail closed).
  const datosValidos = info.authenticatedUserPrivileges.every(permiso =>
    permiso && typeof permiso === "object" &&
    permiso.resource && typeof permiso.resource === "object" &&
    Array.isArray(permiso.actions) &&
    permiso.actions.every(accion => typeof accion === "string") &&
    (
      permiso.resource.anyResource === true ||
      permiso.resource.cluster === true ||
      (typeof permiso.resource.db === "string" && typeof permiso.resource.collection === "string")
    )
  );
  if (!datosValidos) {
    return { seguro: false, codigo: "PRIVILEGIOS_MALFORMADOS", base, coleccion, acciones: [] };
  }
  const acciones = detectarPrivilegiosPeligrosos(
    info.authenticatedUserPrivileges, base, coleccion
  );
  return {
    seguro: acciones.length === 0,
    codigo: acciones.length ? "PRIVILEGIOS_PELIGROSOS" : "SIN_PRIVILEGIOS_PELIGROSOS_DETECTADOS",
    base, coleccion, acciones
  };
}

module.exports = { aplicaAlHistorial, detectarPrivilegiosPeligrosos, auditarPrivilegiosHistorial };
