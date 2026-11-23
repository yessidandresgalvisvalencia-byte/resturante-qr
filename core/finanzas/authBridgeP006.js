"use strict";

// Production auth bridge for P0-06. Must be placed AFTER authMiddleware.
// No client-provided principal, role or tenant is trusted.
const { registerDiscrepancyRoute } = require("./rutaDiferenciasP006");

function own(obj, key) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(obj, key);
  return descriptor && Object.prototype.hasOwnProperty.call(descriptor, "value")
    ? descriptor.value : undefined;
}

function createAuthenticatedP006Dependencies({ getCollections, authorizeRole }) {
  if (typeof getCollections !== "function" || typeof authorizeRole !== "function") {
    throw new TypeError("P006_AUTH_BRIDGE_DEPENDENCIES_INVALID");
  }
  // Principal is exclusively issued by the existing verified JWT middleware.
  const getPrincipal = req => {
    const auth = own(req, "auth");
    const id = own(auth, "usuarioId");
    return typeof id === "string" ? { id } : null;
  };
  const authorize = async context => {
    const principal = own(context, "principal");
    const actorId = own(principal, "id");
    const empresaId = own(context, "empresaId");
    const sedeId = own(context, "sedeId");
    // A request-local auth context is required. Never infer tenant from body.
    // The handler's authorization API does not carry req; binding must occur per request.
    return false;
  };
  return { getPrincipal, authorize, getCollections };
}

// Per-request factory prevents sharing an authenticated tenant across requests.
// Requires an explicitly supplied role/permission evaluator; never grants by role name alone.
function createP006RequestHandler({ getCollections, authorizeRole }) {
  if (typeof getCollections !== "function" || typeof authorizeRole !== "function") {
    throw new TypeError("P006_AUTH_BRIDGE_DEPENDENCIES_INVALID");
  }
  const { createDiscrepancyHttpHandler } = require("./httpDiferenciasP006");
  return async (req, res) => {
    const auth = own(req, "auth");
    const id = own(auth, "usuarioId");
    const tenant = own(auth, "empresaId");
    const site = own(auth, "sedeId");
    const role = own(auth, "rol");
    const params = own(req, "params");
    const requestedTenant = own(params, "empresaId");
    const requestedSite = own(params, "sedeId");
    if (typeof id !== "string") return res.status(401).json({ error: "UNAUTHENTICATED" });
    if (tenant !== requestedTenant || site !== requestedSite) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }
    const handler = createDiscrepancyHttpHandler({
      getPrincipal: () => ({ id }),
      authorize: async context => {
        if (context.principal.id !== id || context.empresaId !== tenant ||
            context.sedeId !== site) return false;
        return (await authorizeRole(Object.freeze({
          actorId: id, empresaId: tenant, sedeId: site,
          role, action: context.action
        }))) === true;
      },
      getCollections
    });
    return handler(req, res);
  };
}

module.exports = { createP006RequestHandler };
