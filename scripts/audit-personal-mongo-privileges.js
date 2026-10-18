"use strict";

/**
 * Auditoría de solo lectura. Uso:
 * PERSONAL_MONGO_URI='mongodb+srv://...' PERSONAL_MONGO_DB='...' \
 *   node scripts/audit-personal-mongo-privileges.js
 *
 * No imprime URI, usuarios ni secretos. Código 1 = no seguro/no verificable.
 */
const mongoose = require("mongoose");
const { auditarPrivilegiosHistorial } = require("../modules/finanzas-personales/security/decisionProofDbPrivileges.service");

async function main() {
 if (!process.env.PERSONAL_MONGO_URI) {
  throw new Error("PERSONAL_MONGO_URI no está configurada");
 }
 // Auditoría estrictamente de solo lectura: no generar índices ni colecciones
 // automáticamente al inicializar modelos Mongoose.
 const opciones = {
  autoIndex: false,
  autoCreate: false,
  serverSelectionTimeoutMS: 10000,
  ...(process.env.PERSONAL_MONGO_DB ? {dbName:process.env.PERSONAL_MONGO_DB} : {})
 };
 await mongoose.connect(process.env.PERSONAL_MONGO_URI, opciones);
 try {
  const auditoria = await auditarPrivilegiosHistorial(mongoose.connection.db);
  console.log(JSON.stringify(auditoria));
  if (!auditoria.seguro) process.exitCode=1;
 } finally {
  await mongoose.disconnect();
 }
}
main().catch(error=>{
 console.error("Auditoría MongoDB no completada:",error.code || "ERROR");
 process.exitCode=1;
});
