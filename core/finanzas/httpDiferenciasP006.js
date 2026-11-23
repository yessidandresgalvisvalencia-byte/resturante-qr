"use strict";

// P0-06 HTTP integration adapter. Deliberately NOT mounted in production:
// the host must supply trusted identity, authorization and scoped collections.
const { readAuthorizedDiscrepancyPanel } = require("./panelDiferenciasAutorizadoP006");

function createDiscrepancyHttpHandler({ getPrincipal, authorize, getCollections }) {
  if (![getPrincipal, authorize, getCollections].every(fn => typeof fn === "function")) {
    throw new Error("P006_HTTP_DEPENDENCIAS_INVALIDAS");
  }
  return async function discrepancyHttpHandler(req, res) {
    try {
      // Never take principal, authorization or Mongo collections from HTTP input.
      const principal = await getPrincipal(req);
      if (!principal || typeof principal.id !== "string") {
        return res.status(401).json({ error: "UNAUTHENTICATED" });
      }
      const empresaId = req && req.params && req.params.empresaId;
      const sedeId = req && req.params && req.params.sedeId;
      const scopePattern = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/;
      if (typeof empresaId !== "string" || !scopePattern.test(empresaId) ||
          typeof sedeId !== "string" || !scopePattern.test(sedeId)) {
        return res.status(400).json({ error: "INVALID_SCOPE" });
      }
      // Authorize BEFORE acquiring collections or reading any tenant data.
      const granted = await authorize(Object.freeze({
        principal: Object.freeze({ id: principal.id }),
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
        principal: { id: principal.id },
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
