"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../../services/ventas.service.js"), "utf8");

test("idempotency recovery requires empresa and sede", () => {
 const section = source.slice(source.indexOf("if (error && error.code === 11000)"));
 assert.match(section, /empresaId,/);
 assert.match(section, /sedeId,/);
 assert.match(section, /origenId: pedido\._id/);
 assert.match(section, /if \(!ventaExistente\) throw error/);
});
test("transactional event emission is deferred", () => {
 assert.match(source, /if \(emitirEvento && !session\)/);
});
