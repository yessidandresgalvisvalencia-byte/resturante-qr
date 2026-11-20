'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ProductoServicio = require('../../models/ProductoServicio');
const Venta = require('../../models/Venta');
const { registrarVentaDesdePedido } = require('../../services/ventas.service');

test('P0-04: cancelled or unpaid duplicate cannot be replayed as a paid sale', async () => {
  const originalProductFind = ProductoServicio.findOne;
  const originalCreate = Venta.create;
  const originalVentaFind = Venta.findOne;
  const empresaId = new mongoose.Types.ObjectId();
  const sedeId = new mongoose.Types.ObjectId();
  const pedidoId = new mongoose.Types.ObjectId();
  const productoId = new mongoose.Types.ObjectId();
  const pedido = {
    _id: pedidoId, empresaId, sedeId, productoServicioId: productoId,
    cantidad: 1, precioUnitario: 100, precio: 100
  };
  let currentState = 'anulada';
  let reads = 0;
  let attempts = 0;
  ProductoServicio.findOne = () => ({
    select: () => ({ session: () => ({ lean: async () => ({
      _id: productoId, costoUnitario: 20
    }) }) })
  });
  Venta.create = async () => {
    attempts++;
    const error = new Error('duplicate key');
    error.code = 11000;
    throw error;
  };
  Venta.findOne = (filter) => {
    reads++;
    assert.deepEqual(filter, {
      origen: 'restaurante', origenId: pedidoId, empresaId, sedeId
    });
    return { session: async () => ({
      estado: currentState, cantidad: 1, precioUnitario: 100, total: 100,
      productoServicioId: productoId, metodoPago: '', clienteId: null
    }) };
  };
  try {
    for (const estado of ['anulada', 'pendiente']) {
      currentState = estado;
      await assert.rejects(
        registrarVentaDesdePedido({
          pedido, empresaId, sedeId, emitirEvento: false
        }),
        (error) => error.code === 'GRUK_VENTA_REPLAY_STATE_CONFLICT'
      );
    }
    assert.equal(reads, 2);
    assert.equal(attempts, 2);
  } finally {
    ProductoServicio.findOne = originalProductFind;
    Venta.create = originalCreate;
    Venta.findOne = originalVentaFind;
  }
});
