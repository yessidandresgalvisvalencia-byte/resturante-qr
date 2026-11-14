"use strict";
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
const AREAS = Object.freeze({
  pedidos: ["routes/API.js"],
  caja: ["services/ventas.service.js"],
  inventario: ["routes/restaurants.js"],
  cocina: ["routes/API.js"],
  facturacion: ["routes/facturacion.js"],
  empleados: ["routes/laboral.js"],
  clientes: ["routes/restaurants.js"],
  finanzas: ["services/ventas.service.js"]
});
function inventory(root = ROOT) {
  return Object.entries(AREAS).map(([area, candidates]) => {
    const files = candidates.filter(file => fs.existsSync(path.join(root, file)));
    return { area, files, status: files.length ? "sin_verificar" : "sin_evidencia",
      evidence: files.length ? "archivo_presente_no_prueba_funcionamiento" : "ninguna" };
  });
}
if (require.main === module) process.stdout.write(JSON.stringify(inventory(), null, 2) + "\n");
module.exports = { inventory, AREAS };
