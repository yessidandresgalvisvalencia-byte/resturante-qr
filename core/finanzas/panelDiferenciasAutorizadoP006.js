"use strict";

// P0-06 application boundary for an authorized read-only discrepancy panel.
// The caller supplies the authenticated principal, a trusted authorization
// function, and explicitly scoped collections. No HTTP route or write access.
const { readMongoDiscrepancyProjection } = require("./lecturaDiferenciasMongoP006");

function own(obj, key) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new Error("P006_PANEL_REQUEST_INVALIDO");
  const d = Object.getOwnPropertyDescriptor(obj, key);
  if (!d || !Object.prototype.hasOwnProperty.call(d, "value")) throw new Error("P006_PANEL_REQUEST_CAMPO_" + key);
  return d.value;
}

async function readAuthorizedDiscrepancyPanel(input) {
  const principal = own(input, "principal");
  const authorize = own(input, "authorize");
  const request = own(input, "request");
  // A missing or malformed identity is never an authenticated principal.
  const actorId = own(principal, "id");
  if (typeof actorId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/.test(actorId)) {
    throw new Error("P006_PANEL_PRINCIPAL_INVALIDO");
  }
  if (typeof authorize !== "function") throw new Error("P006_PANEL_AUTH_INVALIDA");
  // Read scope without invoking accessors; never use client-supplied scope as
  // evidence of authorization. Authorization must be provided by the host.
  const empresaId = own(request, "empresaId");
  const sedeId = own(request, "sedeId");
  const scopePattern = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/;
  if (typeof empresaId !== "string" || !scopePattern.test(empresaId) ||
      typeof sedeId !== "string" || !scopePattern.test(sedeId)) throw new Error("P006_PANEL_SCOPE_INVALIDO");
  // Snapshot the entire request before calling untrusted asynchronous authorization.
  // Otherwise an authorizer (or another task while it awaits) could change the
  // tenant scope after permission was granted, causing a cross-tenant read.
  // Reject accessor properties rather than invoking them while copying.
  const descriptors = Object.getOwnPropertyDescriptors(request);
  const safeRequest = Object.create(null);
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!Object.prototype.hasOwnProperty.call(descriptor, "value")) {
      throw new Error("P006_PANEL_REQUEST_ACCESSOR_INVALIDO");
    }
    Object.defineProperty(safeRequest, key, {
      value: descriptor.value, enumerable: true, writable: false, configurable: false
    });
  }
  Object.freeze(safeRequest);
  // Pass a minimal immutable identity snapshot: authorization must not observe\n  // mutable principal fields or a principal object changed during an await.\n  const allowed = await authorize(Object.freeze({ principal: Object.freeze({ id: actorId }), empresaId, sedeId, action: "gruk.p006.discrepancies.read" }));
  if (allowed !== true) throw new Error("P006_PANEL_FORBIDDEN");
  return readMongoDiscrepancyProjection(safeRequest);
}

module.exports = { readAuthorizedDiscrepancyPanel };
