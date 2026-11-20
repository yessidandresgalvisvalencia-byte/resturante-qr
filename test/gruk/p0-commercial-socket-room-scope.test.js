"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("P0 commercial: paid and status order updates never broadcast to every Socket.IO tenant", () => {
  const app = fs.readFileSync(path.join(__dirname, "../../app.js"), "utf8");
  const api = fs.readFileSync(path.join(__dirname, "../../routes/API.js"), "utf8");

  assert.match(app, /socket\.join\(`empresa-\$\{socket\.auth\.empresaId\}\`\)/);
  const restricted = api.match(/io\.to\(`empresa-\$\{req\.auth\.empresaId\}\`\)\.emit\("pedido:actualizado", pedido(?:Final)?\)/g) || [];
  assert.equal(restricted.length, 2, "status and payment routes must use authenticated company room");
  assert.doesNotMatch(api, /\bio\.emit\("pedido:actualizado"/, "global broadcast leaks orders between companies");
});

test("P0 commercial: order update endpoints require authenticated role-check before emitting", () => {
  const api = fs.readFileSync(path.join(__dirname, "../../routes/API.js"), "utf8");
  assert.match(api, /router\.put\("\/pedido\/:id\/estado", authMiddleware, roleCheck\(/);
  assert.match(api, /router\.put\("\/pedido\/:id\/pago", authMiddleware, roleCheck\(/);
});
