'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ProductoServicio = require('../../models/ProductoServicio');
const Cliente = require('../../models/Cliente');
const Venta = require('../../models/Venta');
const { registrarVentaDesdePedido } = require('../../services/ventas.service');

test('P0-04: malformed customer ID is rejected before any tenant lookup or write', async () => {
  const originalProduct = ProductoServicio.findOne;
  const originalClient = Cliente.findOne;
  const originalCreate = Venta.create;
  const calls = [];
  ProductoServicio.findOne = () => { calls.push('product'); throw new Error('unexpected product query'); };
  Cliente.findOne = () => { calls.push('customer'); throw new Error('unexpected customer query'); };
  Venta.create = () => { calls.push('sale'); throw new Error('unexpected sale write'); };
  try {
    const pedido = {
      _id: new mongoose.Types.ObjectId(),
      productoServicioId: new mongoose.Types.ObjectId(),
      clienteId: 'not-an-object-id'
    };
    await assert.rejects(
      registrarVentaDesdePedido({
        pedido,
        empresaId: new mongoose.Types.ObjectId(),
        sedeId: new mongoose.Types.ObjectId(),
        emitirEvento: false
      }),
      /clienteId invalido/
    );
    assert.deepEqual(calls, []);
  } finally {
    ProductoServicio.findOne = originalProduct;
    Cliente.findOne = originalClient;
    Venta.create = originalCreate;
  }
});
