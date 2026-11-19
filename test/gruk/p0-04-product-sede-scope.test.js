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


test('P0-04: oversized untrusted economic strings fail before persistence', async () => {
  const originalProduct = ProductoServicio.findOne;
  const originalCreate = Venta.create;
  const empresaId = new mongoose.Types.ObjectId();
  const productoServicioId = new mongoose.Types.ObjectId();
  let writes = 0;
  let productCost = 100;
  ProductoServicio.findOne = () => ({
    select() { return this; },
    session() { return this; },
    async lean() { return { _id: productoServicioId, costoUnitario: productCost }; }
  });
  Venta.create = async () => { writes += 1; throw new Error('unexpected write'); };
  const base = {
    _id: new mongoose.Types.ObjectId(),
    productoServicioId,
    cantidad: 1,
    precioUnitario: 100,
    precio: 100
  };
  try {
    for (const field of ['cantidad', 'precioUnitario', 'precio']) {
      const pedido = { ...base, [field]: '9'.repeat(100000) };
      await assert.rejects(
        registrarVentaDesdePedido({ pedido, empresaId, emitirEvento: false }),
        /fuera de rango seguro/
      );
    }
    productCost = '9'.repeat(100000);
    await assert.rejects(
      registrarVentaDesdePedido({ pedido: base, empresaId, emitirEvento: false }),
      /fuera de rango seguro/
    );
    assert.equal(writes, 0, 'invalid economic input must not create a sale');
  } finally {
    ProductoServicio.findOne = originalProduct;
    Venta.create = originalCreate;
  }
});

test('P0-04: invalid tenant and order identities fail before database access', async () => {
  const originalProduct = ProductoServicio.findOne;
  const originalCreate = Venta.create;
  let reads = 0;
  let writes = 0;
  ProductoServicio.findOne = () => { reads++; throw new Error('unexpected product lookup'); };
  Venta.create = async () => { writes++; throw new Error('unexpected sale write'); };
  const validId = new mongoose.Types.ObjectId();
  const validOrder = { _id: new mongoose.Types.ObjectId(), productoServicioId: validId };
  try {
    for (const args of [
      { pedido: validOrder, empresaId: 'invalid-tenant' },
      { pedido: validOrder, empresaId: validId, sedeId: 'invalid-site' },
      { pedido: { ...validOrder, _id: 'invalid-order' }, empresaId: validId },
      { pedido: { ...validOrder, productoServicioId: 'invalid-product' }, empresaId: validId },
      { pedido: { ...validOrder, clienteId: 'invalid-customer' }, empresaId: validId }
    ]) {
      await assert.rejects(registrarVentaDesdePedido({ ...args, emitirEvento: false }), /invalido/);
    }
    assert.equal(reads, 0, 'invalid identity must not query product records');
    assert.equal(writes, 0, 'invalid identity must not persist sales');
  } finally {
    ProductoServicio.findOne = originalProduct;
    Venta.create = originalCreate;
  }
});
