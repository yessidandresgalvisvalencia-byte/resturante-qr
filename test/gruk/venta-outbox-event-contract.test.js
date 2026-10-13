"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { crearEventoVentaCompletada } = require("../../services/gruk/crearEventoVentaCompletada");

const venta = {
  _id: "507f1f77bcf86cd799439011",
  empresaId: "507f191e810c19729de860ea",
  origenId: "507f1f77bcf86cd799439012",
  origen: "restaurante",
  estado: "pagada",
  metodoPago: "tarjeta",
  total: 52000,
  sedeId: null,
  metadata: { restaurantId: "sede-01" }
};

test("GRUK: construye evento VENTA_COMPLETADA compatible con proyector Outbox", () => {
  assert.deepEqual(crearEventoVentaCompletada(venta), {
    eventId: "VENTA_COMPLETADA:507f1f77bcf86cd799439011",
    empresaId: venta.empresaId,
    sedeId: null,
    eventName: "VENTA_COMPLETADA",
    aggregateId: venta._id,
    payload: {
      ventaId: venta._id,
      restaurantId: "sede-01",
      total: 52000
    }
  });
});

test("GRUK: el ID de evento es estable para reintentos de la misma venta", () => {
  const a = crearEventoVentaCompletada(venta);
  const b = crearEventoVentaCompletada({ ...venta });
  assert.equal(a.eventId, b.eventId);
});

test("GRUK: prohíbe construir ingreso automático de una venta no pagada", () => {
  for (const patch of [{ estado: "pendiente" }, { metodoPago: "efectivo" }, { total: 0 }, { total: 100.25 }, { empresaId: "" }, { origenId: "" }]) {
    assert.throws(() => crearEventoVentaCompletada({ ...venta, ...patch }), /VENTA_OUTBOX_INVALIDA/);
  }
});

test("GRUK: valida la sede empresarial si está presente", () => {
  assert.throws(() => crearEventoVentaCompletada({ ...venta, sedeId: "otra-sede" }), /VENTA_OUTBOX_SEDE_INVALIDA/);
});
