"use strict";

const {verificarAnclaDecisionMongo} = require("./anclaDecisionMongo.service");

/**
 * Requiere un custodio externo independiente. No utiliza MongoDB para
 * buscar la referencia ni recibe una ancla arbitraria desde el navegador.
 * El custodio debe implementar obtenerUltimaAncla(usuarioId) y garantizar
 * autenticidad, autorización, retención y ausencia de retrocesos.
 */
async function auditarAnclaCustodiada(usuarioId, clave, custodio) {
 if (!custodio || typeof custodio.obtenerUltimaAncla !== "function") {
  return {valida:false,codigo:"CUSTODIO_EXTERNO_NO_CONFIGURADO"};
 }
 let ancla;
 try {
  ancla = await custodio.obtenerUltimaAncla(usuarioId);
 } catch {
  return {valida:false,codigo:"CUSTODIO_EXTERNO_NO_DISPONIBLE"};
 }
 if (!ancla || typeof ancla !== "object" || Array.isArray(ancla)) {
  return {valida:false,codigo:"ANCLA_EXTERNA_NO_DISPONIBLE"};
 }
 return verificarAnclaDecisionMongo(usuarioId, clave, ancla);
}

module.exports = {auditarAnclaCustodiada};
