"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("only approved production services import the delivery obligation model", () => {
  const root = path.resolve(__dirname, "../..");
  const allowed = new Set([
    "core/eventos/ventaOutbox.service.js",
    "core/eventos/entregaConsumidor.service.js",
    "core/eventos/registrarConsumidorAdicional.service.js",
    "core/eventos/cerrarVentaEntregada.service.js",
    "core/eventos/listarEntregasRecuperables.service.js", "core/eventos/obtenerSaludEntregas.service.js", "core/eventos/diagnosticarReintentosEntrega.service.js"
  ]);
  const dirs = ["core", "services", "routes", "jobs", "intelligence", "modules"];
  const violations = [];
  function inspect(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { inspect(full); continue; }
      if (!entry.isFile() || !entry.name.endsWith(".js")) continue;
      const relative = path.relative(root, full).split(path.sep).join("/");
      if (allowed.has(relative)) continue;
      if (fs.readFileSync(full, "utf8").includes("GrukEntregaConsumidor")) {
        violations.push(relative);
      }
    }
  }
  dirs.forEach(dir => inspect(path.join(root, dir)));
  assert.deepEqual(violations, []);
  const recovery = fs.readFileSync(path.join(root,
    "core/eventos/listarEntregasRecuperables.service.js"), "utf8");
  assert.match(recovery, /Entrega\.find\(/);
  assert.doesNotMatch(recovery, /Entrega\.(?:create|updateOne|updateMany|deleteOne|deleteMany|findOneAndUpdate|findOneAndDelete|bulkWrite|insertMany|replaceOne)\s*\(/);
  assert.doesNotMatch(recovery, /\.save\s*\(/);
});
