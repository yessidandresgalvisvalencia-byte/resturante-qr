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
 await mongoose.connect(
  process.env.PERSONAL_MONGO_URI,
  process.env.PERSONAL_MONGO_DB ? {dbName:process.env.PERSONAL_MONGO_DB} : {}
 );
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
