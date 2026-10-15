"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Venta = require("../../models/Venta");

test("Venta explicitly persists financial control fields without strict:false", () => {
  const venta = new Venta({
    empresaId: new mongoose.Types.ObjectId(),
    sedeId: new mongoose.Types.ObjectId(),
    concepto: "Prueba de esquema",
    precioUnitario: 1000,
    total: 1000,
    grukControlFinanciero: {
      token: "orden:control:123456789",
      estado: "RECLAMADA",
      operacionId: "operacion:123456789"
    }
  });
  assert.equal(venta.validateSync(), undefined);
  const persisted = venta.toObject();
  assert.deepEqual(persisted.grukControlFinanciero, {
    token: "orden:control:123456789",
    estado: "RECLAMADA",
    operacionId: "operacion:123456789"
  });
});

test("Venta rejects unknown financial control state", () => {
  const venta = new Venta({
    empresaId: new mongoose.Types.ObjectId(),
    concepto: "Prueba estado invalido",
    precioUnitario: 1000,
    total: 1000,
    grukControlFinanciero: { estado: "APROBADA_SIN_CONTROL" }
  });
  const error = venta.validateSync();
  assert.ok(error);
  assert.ok(error.errors["grukControlFinanciero.estado"]);
});
