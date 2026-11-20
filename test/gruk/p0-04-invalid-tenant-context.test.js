'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ProductoServicio = require('../../models/ProductoServicio');
const Cliente = require('../../models/Cliente');
const Venta = require('../../models/Venta');
const { registrarVentaDesdePedido } = require('../../services/ventas.service');

test('P0-04: malformed enterprise or branch context fails closed before database access', async () => {
  const originals = [ProductoServicio.findOne, Cliente.findOne, Venta.create];
  const calls = [];
  ProductoServicio.findOne = () => { calls.push('product'); throw Error('unexpected lookup'); };
  Cliente.findOne = () => { calls.push('customer'); throw Error('unexpected lookup'); };
  Venta.create = () => { calls.push('sale'); throw Error('unexpected write'); };
  const pedido = {
    _id: new mongoose.Types.ObjectId(),
    productoServicioId: new mongoose.Types.ObjectId()
  };
  try {
    for (const context of [
      { empresaId: 'invalid-tenant', sedeId: new mongoose.Types.ObjectId(), expected: /empresaId invalido/ },
      { empresaId: new mongoose.Types.ObjectId(), sedeId: 'invalid-branch', expected: /sedeId invalido/ }
    ]) {
      await assert.rejects(
        registrarVentaDesdePedido({
          pedido,
          empresaId: context.empresaId,
          sedeId: context.sedeId,
          emitirEvento: false
        }),
        context.expected
      );
    }
    assert.deepEqual(calls, []);
  } finally {
    ProductoServicio.findOne = originals[0];
    Cliente.findOne = originals[1];
    Venta.create = originals[2];
  }
});
