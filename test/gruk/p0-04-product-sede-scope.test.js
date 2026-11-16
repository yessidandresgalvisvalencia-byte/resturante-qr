'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ProductoServicio = require('../../models/ProductoServicio');
const Venta = require('../../models/Venta');
const { registrarVentaDesdePedido } = require('../../services/ventas.service');

test('P0-04: product lookup excludes sibling branch while retaining global catalog', async () => {
  const original = ProductoServicio.findOne;
  const originalCreate = Venta.create;
  let attemptedWrites = 0;
  Venta.create = async () => { attemptedWrites += 1; throw new Error('unexpected sale write'); };
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
  const pedido = { _id: new mongoose.Types.ObjectId(), productoServicioId };
  try {
    await assert.rejects(registrarVentaDesdePedido({ pedido, empresaId, sedeId, emitirEvento: false }), /no pertenece/);
    await assert.rejects(registrarVentaDesdePedido({ pedido, empresaId, emitirEvento: false }), /no pertenece/);
    assert.equal(attemptedWrites, 0, 'cross-branch product must not persist a sale');
    assert.equal(captured.length, 2);
    assert.deepEqual(captured[0], {
      _id: productoServicioId, empresaId, sedeId: { $in: [sedeId, null] }
    });
    assert.deepEqual(captured[1], {
      _id: productoServicioId, empresaId, sedeId: null
    });
  } finally {
    ProductoServicio.findOne = original;
    Venta.create = originalCreate;
  }
});

test('P0-04: customer lookup without branch cannot access sibling branch customers', async () => {
  const Cliente = require('../../models/Cliente');
  const originalProduct = ProductoServicio.findOne;
  const originalClient = Cliente.findOne;
  const originalCreate = Venta.create;
  let attemptedWrites = 0;
  Venta.create = async () => { attemptedWrites += 1; throw new Error('unexpected sale write'); };
  const captured = [];
  const empresaId = new mongoose.Types.ObjectId();
  const sedeId = new mongoose.Types.ObjectId();
  const productoServicioId = new mongoose.Types.ObjectId();
  const clienteId = new mongoose.Types.ObjectId();
  ProductoServicio.findOne = () => ({
    select() { return this; },
    session() { return this; },
    async lean() { return { _id: productoServicioId, costoUnitario: 100 }; }
  });
  Cliente.findOne = (filter) => {
    captured.push(filter);
    return {
      select() { return this; },
      session() { return this; },
      async lean() { return null; }
    };
  };
  const pedido = { _id: new mongoose.Types.ObjectId(), productoServicioId, clienteId };
  try {
    await assert.rejects(
      registrarVentaDesdePedido({ pedido, empresaId, emitirEvento: false }),
      /Cliente no pertenece/
    );
    await assert.rejects(
      registrarVentaDesdePedido({ pedido, empresaId, sedeId, emitirEvento: false }),
      /Cliente no pertenece/
    );
    assert.equal(attemptedWrites, 0, 'cross-branch customer must not persist a sale');
    assert.deepEqual(captured, [
      { _id: clienteId, empresaId, deletedAt: null, sedeId: null },
      { _id: clienteId, empresaId, deletedAt: null, sedeId }
    ]);
  } finally {
    ProductoServicio.findOne = originalProduct;
    Cliente.findOne = originalClient;
    Venta.create = originalCreate;
  }
});
