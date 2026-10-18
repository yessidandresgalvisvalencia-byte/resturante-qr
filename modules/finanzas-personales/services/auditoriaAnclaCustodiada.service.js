"use strict";

const mongoose = require("mongoose");
const {verificarAnclaDecisionMongo} = require("./anclaDecisionMongo.service");

/**
 * Requiere un custodio externo independiente. No utiliza MongoDB para
 * buscar la referencia ni recibe una ancla arbitraria desde el navegador.
 * El custodio debe implementar obtenerUltimaAncla(usuarioId) y garantizar
 * autenticidad, autorización, retención y ausencia de retrocesos.
 */
async function auditarAnclaCustodiada(usuarioId, clave, custodio) {
 if (!mongoose.isObjectIdOrHexString(usuarioId)) throw new TypeError("usuarioId inválido");
 if (!Buffer.isBuffer(clave) || clave.length < 32) throw new TypeError("Clave HMAC inválida");
 const usuarioCanonico = new mongoose.Types.ObjectId(String(usuarioId)).toHexString();
 if (!custodio || typeof custodio.obtenerUltimaAncla !== "function") {
  return {valida:false,codigo:"CUSTODIO_EXTERNO_NO_CONFIGURADO"};
 }
 let ancla;
 try {
  ancla = await custodio.obtenerUltimaAncla(usuarioCanonico);
 } catch {
  return {valida:false,codigo:"CUSTODIO_EXTERNO_NO_DISPONIBLE"};
 }
 if (!ancla || typeof ancla !== "object" || Array.isArray(ancla)) {
  return {valida:false,codigo:"ANCLA_EXTERNA_NO_DISPONIBLE"};
 }
 return verificarAnclaDecisionMongo(usuarioCanonico, clave, ancla);
}

module.exports = {auditarAnclaCustodiada};
