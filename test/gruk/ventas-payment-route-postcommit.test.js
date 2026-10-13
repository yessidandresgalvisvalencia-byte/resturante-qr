"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Regression contract for the legacy payment route. This guards the existing
// explicit transaction boundary until its migration to durable Outbox.
const api = fs.readFileSync(path.join(__dirname, "../../routes/API.js"), "utf8");
const start = api.indexOf("const resultadoVenta = await registrarVentaDesdePedido({");
const end = api.indexOf("/* =========================", start);

test("legacy payment route keeps session writes non-emitting", () => {
  assert.ok(start > -1, "payment route must invoke sales service");
  const transactionScope = api.slice(start, end);
  assert.match(transactionScope, /session,\s*emitirEvento:\s*false/);
});

test("legacy payment route publishes only after withTransaction completes", () => {
  const region = api.slice(start, end);
  assert.ok(region.includes("if (ventaPostCommit) emitirVentaCompletada(ventaPostCommit)"));
  const endTransaction = region.indexOf("});");
  const emission = region.indexOf("if (ventaPostCommit) emitirVentaCompletada(ventaPostCommit)");
  assert.ok(endTransaction >= 0 && emission > endTransaction);
});

// The static contract does not establish durable delivery, and deliberately
// makes no claim about Socket.IO delivery, payment confirmation or deployment.
