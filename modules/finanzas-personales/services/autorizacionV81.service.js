"use strict";
const mongoose = require("mongoose");

// Esta función se ejecuta solo en el servidor, después de verificar la sesión.
// Nunca se acepta usuarioId desde body, query o headers del cliente.
function resolverUsuarioAutorizadoV81(principal, usuarioSolicitado) {
 if (!principal || typeof principal !== "object" || Array.isArray(principal)) {
  throw Object.assign(new Error("Autenticación obligatoria"),{statusCode:401});
 }
 if (principal.autenticado !== true || typeof principal.usuarioId !== "string" ||
     !mongoose.isValidObjectId(principal.usuarioId)) {
  throw Object.assign(new Error("Identidad autenticada inválida"),{statusCode:401});
 }
 const id=String(new mongoose.Types.ObjectId(principal.usuarioId));
 if (usuarioSolicitado !== undefined && usuarioSolicitado !== null) {
  if (typeof usuarioSolicitado !== "string" || !mongoose.isValidObjectId(usuarioSolicitado) ||
      String(new mongoose.Types.ObjectId(usuarioSolicitado)) !== id) {
   throw Object.assign(new Error("Acceso denegado: usuario ajeno"),{statusCode:403});
  }
 }
 return id;
}
module.exports={resolverUsuarioAutorizadoV81};
