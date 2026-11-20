'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ProductoServicio = require('../../models/ProductoServicio');
const Cliente = require('../../models/Cliente');
const Venta = require('../../models/Venta');
const { registrarVentaDesdePedido } = require('../../services/ventas.service');

test('P0-04: explicit cross-tenant or cross-branch order is rejected before database access', async () => {
  const originals = [ProductoServicio.findOne, Cliente.findOne, Venta.findOne, Venta.create];
  const calls = [];
  ProductoServicio.findOne = () => { calls.push('product'); throw Error('unexpected lookup'); };
  Cliente.findOne = () => { calls.push('customer'); throw Error('unexpected lookup'); };
  Venta.findOne = () => { calls.push('existing sale'); throw Error('unexpected lookup'); };
  Venta.create = () => { calls.push('sale'); throw Error('unexpected write'); };
  try {
    const empresaId = new mongoose.Types.ObjectId();
    const sedeId = new mongoose.Types.ObjectId();
    const pedidoBase = {
      _id: new mongoose.Types.ObjectId(),
      productoServicioId: new mongoose.Types.ObjectId(),
      cantidad: 1,
      precioUnitario: 100,
      precio: 100
    };
    await assert.rejects(
      registrarVentaDesdePedido({
        pedido: { ...pedidoBase, empresaId: new mongoose.Types.ObjectId(), sedeId },
        empresaId, sedeId, emitirEvento: false
      }),
      /pedido de otra empresa/
    );
    await assert.rejects(
      registrarVentaDesdePedido({
        pedido: { ...pedidoBase, empresaId, sedeId: new mongoose.Types.ObjectId() },
        empresaId, sedeId, emitirEvento: false
      }),
      /pedido de otra sede/
    );
    await assert.rejects(
      registrarVentaDesdePedido({
        pedido: { ...pedidoBase, empresaId, sedeId },
        empresaId, sedeId: null, emitirEvento: false
      }),
      /pedido de otra sede/
    );
    assert.deepEqual(calls, []);
  } finally {
    ProductoServicio.findOne = originals[0];
    Cliente.findOne = originals[1];
    Venta.findOne = originals[2];
    Venta.create = originals[3];
  }
});
