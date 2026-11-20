'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ProductoServicio = require('../../models/ProductoServicio');
const Venta = require('../../models/Venta');
const { registrarVentaDesdePedido } = require('../../services/ventas.service');

// A duplicate key from a lookup or other pre-create operation must not be
// misclassified as an idempotent sale replay.
test('P0-04: duplicate key before Venta.create is propagated without replay lookup', async () => {
  const originalProductFind = ProductoServicio.findOne;
  const originalVentaCreate = Venta.create;
  const originalVentaFind = Venta.findOne;
  const empresaId = new mongoose.Types.ObjectId();
  const sedeId = new mongoose.Types.ObjectId();
  const pedidoId = new mongoose.Types.ObjectId();
  const productoId = new mongoose.Types.ObjectId();
  const duplicate = new Error('duplicate key from product lookup');
  duplicate.code = 11000;
  let createCalls = 0;
  let replayReads = 0;
  ProductoServicio.findOne = () => ({
    select: () => ({
      session: () => ({
        lean: async () => { throw duplicate; }
      })
    })
  });
  Venta.create = async () => { createCalls++; throw new Error('unexpected sale creation'); };
  Venta.findOne = () => { replayReads++; throw new Error('unexpected replay lookup'); };
  try {
    await assert.rejects(
      registrarVentaDesdePedido({
        pedido: {
          _id: pedidoId, empresaId, sedeId, productoServicioId: productoId,
          cantidad: 1, precioUnitario: 100, precio: 100
        },
        empresaId, sedeId, emitirEvento: false
      }),
      (error) => error === duplicate
    );
    assert.equal(createCalls, 0, 'no sale should be written');
    assert.equal(replayReads, 0, 'no idempotent replay should be attempted');
  } finally {
    ProductoServicio.findOne = originalProductFind;
    Venta.create = originalVentaCreate;
    Venta.findOne = originalVentaFind;
  }
});
