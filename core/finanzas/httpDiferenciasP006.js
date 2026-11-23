"use strict";

// P0-06 HTTP integration adapter. Deliberately NOT mounted in production:
// the host must supply trusted identity, authorization and scoped collections.
const { readAuthorizedDiscrepancyPanel } = require("./panelDiferenciasAutorizadoP006");

function ownValue(obj, key) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(obj, key);
  return descriptor && Object.prototype.hasOwnProperty.call(descriptor, "value")
    ? descriptor.value : undefined;
}

function createDiscrepancyHttpHandler({ getPrincipal, authorize, getCollections }) {
  if (![getPrincipal, authorize, getCollections].every(fn => typeof fn === "function")) {
    throw new Error("P006_HTTP_DEPENDENCIAS_INVALIDAS");
  }
  return async function discrepancyHttpHandler(req, res) {
    try {
      // Never take principal, authorization or Mongo collections from HTTP input.
      const principal = await getPrincipal(req);
      const actorId = ownValue(principal, "id");
      if (typeof actorId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/.test(actorId)) {
        return res.status(401).json({ error: "UNAUTHENTICATED" });
      }
      const params = ownValue(req, "params");
      const empresaId = ownValue(params, "empresaId");
      const sedeId = ownValue(params, "sedeId");
      const scopePattern = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/;
      if (typeof empresaId !== "string" || !scopePattern.test(empresaId) ||
          typeof sedeId !== "string" || !scopePattern.test(sedeId)) {
        return res.status(400).json({ error: "INVALID_SCOPE" });
      }
      // Authorize BEFORE acquiring collections or reading any tenant data.
      const granted = await authorize(Object.freeze({
        principal: Object.freeze({ id: actorId }),
        empresaId, sedeId, action: "gruk.p006.discrepancies.read"
      }));
      if (granted !== true) return res.status(403).json({ error: "FORBIDDEN" });
      const collections = await getCollections({ empresaId, sedeId });
      if (!collections || typeof collections !== "object") {
        throw new Error("P006_HTTP_COLLECTIONS_UNAVAILABLE");
      }
      const request = {
        empresaId, sedeId,
        expectedCentavos: collections.expectedCentavos,
        movementsCollection: collections.movementsCollection,
        stockCollection: collections.stockCollection
      };
      // The inner boundary independently verifies authorization, fail-closed.
      const projection = await readAuthorizedDiscrepancyPanel({
        principal: { id: actorId },
        authorize: context => authorize(context),
        request
      });
      return res.status(200).json(projection);
    } catch (error) {
      // No database, authentication, or internal error details to clients.
      return res.status(503).json({ error: "DISCREPANCY_UNAVAILABLE" });
    }
  };
}

module.exports = { createDiscrepancyHttpHandler };
