"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const source = (file) => fs.readFileSync(path.join(__dirname, "../..", file), "utf8");

test("P0 commercial: tenant owners and branch staff use separate Socket.IO rooms", () => {
  const app = source("app.js");
  assert.match(app, /socket\.auth\.rol === "DUEÑO"/);
  assert.match(app, /socket\.join\(`empresa-\$\{socket\.auth\.empresaId\}\`\)/);
  assert.match(app, /socket\.join\(`empresa-\$\{socket\.auth\.empresaId\}-sede-\$\{socket\.auth\.sedeId\}\`\)/);
  assert.doesNotMatch(app, /io\.on\("connection", \(socket\) => \{\s*socket\.join\(`empresa-/, "not every connected branch may join tenant-wide room");
});

test("P0 commercial: payment and status updates reach only company owner and matching branch", () => {
  const api = source("routes/API.js");
  const deliveries = api.match(/io\.to\(`empresa-\$\{req\.auth\.empresaId\}\`\)\s*\.to\(`empresa-\$\{req\.auth\.empresaId\}-sede-\$\{req\.auth\.sedeId \|\| (?:estadoSedeId|pedidoSedeObjectId)\}\`\)\s*\.emit\("pedido:actualizado", pedido(?:Final)?\)/g) || [];
  assert.equal(deliveries.length, 2, "status and payment must target the authorized company/site rooms");
  assert.doesNotMatch(api, /\bio\.emit\("pedido:actualizado"/, "global broadcasts leak orders across companies");
  assert.doesNotMatch(api, /io\.to\(`empresa-\$\{req\.auth\.empresaId\}\`\)\.emit\("pedido:actualizado"/, "company-only broadcast leaks to sibling branches");
});

test("P0 commercial: order mutations are guarded by role and authorized branch", () => {
  const api = source("routes/API.js");
  assert.match(api, /router\.put\("\/pedido\/:id\/estado", authMiddleware, roleCheck\(/);
  assert.match(api, /router\.put\("\/pedido\/:id\/pago", authMiddleware, roleCheck\(/);
  assert.match(api, /await authorizeOrderBranch\(\{ pedido: actual, restaurante: tenant, auth: req\.auth \}\)/);
  assert.match(api, /const \{ sedeObjectId, pedidoParaVenta \} = await authorizeOrderBranch\(/);
});
