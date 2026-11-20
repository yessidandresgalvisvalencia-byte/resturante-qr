'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ProductoServicio = require('../../models/ProductoServicio');
const Cliente = require('../../models/Cliente');
const Venta = require('../../models/Venta');
const { registrarVentaDesdePedido } = require('../../services/ventas.service');

test('P0-04: invalid product identity fails before any tenant lookup or write', async () => {
  const originals = [ProductoServicio.findOne, Cliente.findOne, Venta.create];
  const calls = [];
  ProductoServicio.findOne = () => { calls.push('product'); throw Error('unexpected product lookup'); };
  Cliente.findOne = () => { calls.push('customer'); throw Error('unexpected customer lookup'); };
  Venta.create = () => { calls.push('sale'); throw Error('unexpected write'); };
  try {
    for (const productoServicioId of ['invalid-product-id', '', null]) {
      await assert.rejects(
        registrarVentaDesdePedido({
          pedido: { _id: new mongoose.Types.ObjectId(), productoServicioId },
          empresaId: new mongoose.Types.ObjectId(),
          sedeId: new mongoose.Types.ObjectId(),
          emitirEvento: false
        }),
        /productoServicioId/
      );
    }
    assert.deepEqual(calls, []);
  } finally {
    ProductoServicio.findOne = originals[0];
    Cliente.findOne = originals[1];
    Venta.create = originals[2];
  }
});
