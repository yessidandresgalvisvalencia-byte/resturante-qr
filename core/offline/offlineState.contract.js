"use strict";
// Pure transition guard for the offline inbox. No money, sales or inventory are mutated here.
const STATES = Object.freeze({
  PENDIENTE:"PENDIENTE",
  EN_REVISION:"EN_REVISION",
  APLICADO:"APLICADO",
  RECHAZADO:"RECHAZADO"
});
const allowed = Object.freeze({
  PENDIENTE: new Set(["EN_REVISION","RECHAZADO"]),
  EN_REVISION: new Set(["APLICADO","RECHAZADO"]),
  APLICADO: new Set(),
  RECHAZADO: new Set()
});
function assertTransition({from,to,verifiedTenant,recordTenant,authorized,domainCommitted}) {
  if (!verifiedTenant || !recordTenant || !["empresaId","sedeId"].every(k => typeof verifiedTenant[k] === "string" && verifiedTenant[k] && verifiedTenant[k] === recordTenant[k])) throw new Error("OFFLINE_TENANT_MISMATCH");
  if (authorized !== true) throw new Error("OFFLINE_PERMISSION_DENIED");
  if (!allowed[from] || !allowed[from].has(to)) throw new Error("OFFLINE_INVALID_TRANSITION");
  if (to === STATES.APLICADO && domainCommitted !== true) throw new Error("OFFLINE_DOMAIN_NOT_COMMITTED");
  return true;
}
module.exports = { STATES, assertTransition };
