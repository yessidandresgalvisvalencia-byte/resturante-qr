"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { registrarVentaEnOutbox } = require("../../services/gruk/registrarVentaEnOutbox");

const venta = {
  _id: "507f1f77bcf86cd799439011",
  empresaId: "507f191e810c19729de860ea",
  origenId: "507f1f77bcf86cd799439012",
  origen: "restaurante",
  estado: "pagada",
  metodoPago: "tarjeta",
  total: 52000,
  sedeId: null,
  metadata: { restaurantId: "restaurante-01" }
};

test("Outbox: escritura durable utiliza la sesión transaccional recibida", async () => {
  const session = { inTransaction: () => true };
  let called = 0;
  const eventId = await registrarVentaEnOutbox({
    venta, session,
    async registrarEventoEnTransaccion(event, actualSession) {
      called++;
      assert.equal(actualSession, session);
      assert.equal(event.eventName, "VENTA_COMPLETADA");
      assert.equal(event.eventId, "VENTA_COMPLETADA:" + venta._id);
    }
  });
  assert.equal(called, 1);
  assert.equal(eventId, "VENTA_COMPLETADA:" + venta._id);
});

test("Outbox: no permite evento financiero fuera de transacción", async () => {
  let called = 0;
  await assert.rejects(registrarVentaEnOutbox({
    venta, session: { inTransaction: () => false },
    async registrarEventoEnTransaccion() { called++; }
  }), /VENTA_OUTBOX_TRANSACCION_OBLIGATORIA/);
  assert.equal(called, 0);
});

test("Outbox: no silencia fallos del writer; permite rollback por el llamador", async () => {
  const session = { inTransaction: () => true };
  await assert.rejects(registrarVentaEnOutbox({
    venta, session,
    async registrarEventoEnTransaccion() { throw new Error("OUTBOX_WRITE_FAILURE"); }
  }), /OUTBOX_WRITE_FAILURE/);
});

test("Outbox: no admite ventas económicas inválidas ni writer ausente", async () => {
  const session = { inTransaction: () => true };
  await assert.rejects(registrarVentaEnOutbox({ venta, session }), /VENTA_OUTBOX_WRITER_OBLIGATORIO/);
  await assert.rejects(registrarVentaEnOutbox({
    venta: { ...venta, total: -1 }, session,
    async registrarEventoEnTransaccion() { throw new Error("MUST_NOT_WRITE"); }
  }), /VENTA_OUTBOX_INVALIDA/);
});
