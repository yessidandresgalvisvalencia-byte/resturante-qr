#!/usr/bin/env node
"use strict";
// P0-02: filesystem inventory only; never infer functional correctness from filenames.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const categories = Object.freeze({
  pedidos: ["routes/restaurants.js", "test/gruk/capa1-offline-order-authority.test.js"],
  caja: ["test/gruk/caja.test.js"],
  inventario: ["test/gruk/capa1-offline-inventory-atomic-mongo.test.js"],
  cocina: ["routes/restaurants.js"],
  facturacion: ["routes/facturacion.js"],
  empleados: ["routes/laboral.js"],
  clientes: ["routes/restaurants.js"],
  finanzas: ["services/ventas.service.js", "test/gruk/capa1-venta-ledger-adapter.test.js"]
});
function inventory(exists = p => fs.existsSync(path.join(root, p))) {
  return Object.entries(categories).map(([capability, paths]) => ({
    capability,
    evidence: paths.map(p => ({ path: p, present: Boolean(exists(p)) })),
    status: "SIN_VERIFICAR",
    note: "Presencia de archivos, no prueba de flujo funcional ni aislamiento multiempresa"
  }));
}
function main() {
  const rows = inventory();
  process.stdout.write(JSON.stringify({ requirement: "P0-02", rows, certified: false }, null, 2) + "\n");
  if (rows.some(row => row.evidence.some(item => !item.present))) process.exitCode = 1;
}
if (require.main === module) main();
module.exports = { inventory, categories };
