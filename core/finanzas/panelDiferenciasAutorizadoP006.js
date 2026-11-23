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
  if (typeof authorize !== "function") throw new Error("P006_PANEL_AUTH_INVALIDA");
  // Read scope without invoking accessors; never use client-supplied scope as
  // evidence of authorization. Authorization must be provided by the host.
  const empresaId = own(request, "empresaId");
  const sedeId = own(request, "sedeId");
  if (typeof empresaId !== "string" || !empresaId.trim() ||
      typeof sedeId !== "string" || !sedeId.trim()) throw new Error("P006_PANEL_SCOPE_INVALIDO");
  const allowed = await authorize(Object.freeze({ principal, empresaId, sedeId, action: "gruk.p006.discrepancies.read" }));
  if (allowed !== true) throw new Error("P006_PANEL_FORBIDDEN");
  return readMongoDiscrepancyProjection(request);
}

module.exports = { readAuthorizedDiscrepancyPanel };
