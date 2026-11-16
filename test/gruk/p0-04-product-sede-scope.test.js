'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ProductoServicio = require('../../models/ProductoServicio');
const { registrarVentaDesdePedido } = require('../../services/ventas.service');

test('P0-04: product lookup excludes sibling branch while retaining global catalog', async () => {
  const original = ProductoServicio.findOne;
  const captured = [];
  ProductoServicio.findOne = (filter) => {
    captured.push(filter);
    return {
      select() { return this; },
      session() { return this; },
      async lean() { return null; }
    };
  };
  const empresaId = new mongoose.Types.ObjectId();
  const sedeId = new mongoose.Types.ObjectId();
  const productoServicioId = new mongoose.Types.ObjectId();
  const pedido = { productoServicioId };
  try {
    await assert.rejects(registrarVentaDesdePedido({ pedido, empresaId, sedeId, emitirEvento: false }), /no pertenece/);
    await assert.rejects(registrarVentaDesdePedido({ pedido, empresaId, emitirEvento: false }), /no pertenece/);
    assert.equal(captured.length, 2);
    assert.deepEqual(captured[0], {
      _id: productoServicioId, empresaId, sedeId: { $in: [sedeId, null] }
    });
    assert.deepEqual(captured[1], {
      _id: productoServicioId, empresaId, sedeId: null
    });
  } finally {
    ProductoServicio.findOne = original;
  }
});
