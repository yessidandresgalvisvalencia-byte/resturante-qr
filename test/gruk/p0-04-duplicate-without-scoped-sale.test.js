'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ProductoServicio = require('../../models/ProductoServicio');
const Venta = require('../../models/Venta');
const { registrarVentaDesdePedido } = require('../../services/ventas.service');

// A duplicate-key error at the sale write is recoverable only if the exact
// scoped source sale exists. Otherwise preserve the database error.
test('P0-04: Venta.create duplicate without matching scoped sale propagates 11000', async () => {
  const originalProductFind = ProductoServicio.findOne;
  const originalVentaCreate = Venta.create;
  const originalVentaFind = Venta.findOne;
  const empresaId = new mongoose.Types.ObjectId();
  const sedeId = new mongoose.Types.ObjectId();
  const pedidoId = new mongoose.Types.ObjectId();
  const productoId = new mongoose.Types.ObjectId();
  const duplicate = new Error('E11000 duplicate key on sale insert');
  duplicate.code = 11000;
  let createCalls = 0;
  let replayReads = 0;
  ProductoServicio.findOne = () => ({
    select: () => ({
      session: () => ({
        lean: async () => ({ _id: productoId, costoUnitario: 10 })
      })
    })
  });
  Venta.create = async () => { createCalls++; throw duplicate; };
  Venta.findOne = (filter) => {
    replayReads++;
    assert.equal(String(filter.empresaId), String(empresaId));
    assert.equal(String(filter.sedeId), String(sedeId));
    assert.equal(String(filter.origenId), String(pedidoId));
    assert.equal(filter.origen, 'restaurante');
    return { session: async () => null };
  };
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
    assert.equal(createCalls, 1);
    assert.equal(replayReads, 1);
  } finally {
    ProductoServicio.findOne = originalProductFind;
    Venta.create = originalVentaCreate;
    Venta.findOne = originalVentaFind;
  }
});
