"use strict";

// Explicit integration point. Never mount automatically: the host must wire
// its authenticated principal, tenant authorization and Mongo collections.
const { createDiscrepancyHttpHandler } = require("./httpDiferenciasP006");

const ROUTE = "/api/gruk/empresas/:empresaId/sedes/:sedeId/conciliacion/diferencias";

function registerDiscrepancyRoute(router, dependencies) {
  if (!router || typeof router.get !== "function") {
    throw new TypeError("P006_ROUTER_INVALID");
  }
  if (!dependencies || typeof dependencies !== "object" ||
      !["getPrincipal", "authorize", "getCollections"].every(
        name => Object.getOwnPropertyDescriptor(dependencies, name)?.value instanceof Function
      )) {
    throw new TypeError("P006_ROUTE_DEPENDENCIES_INVALID");
  }
  const handler = createDiscrepancyHttpHandler(dependencies);
  router.get(ROUTE, handler);
  return router;
}

module.exports = { ROUTE, registerDiscrepancyRoute };
