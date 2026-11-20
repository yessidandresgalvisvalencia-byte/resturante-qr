'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ProductoServicio = require('../../models/ProductoServicio');
const Venta = require('../../models/Venta');
const { registrarVentaDesdePedido } = require('../../services/ventas.service');

test('P0-04: duplicate replay with changed economic contents is rejected without emitting events', async () => {
  const oldProduct = ProductoServicio.findOne;
  const oldCreate = Venta.create;
  const oldFind = Venta.findOne;
  const empresaId = new mongoose.Types.ObjectId();
  const sedeId = new mongoose.Types.ObjectId();
  const pedidoId = new mongoose.Types.ObjectId();
  const productoId = new mongoose.Types.ObjectId();
  let reads = 0;
  ProductoServicio.findOne = () => ({
    select: () => ({ session: () => ({ lean: async () => ({ _id: productoId, costoUnitario: 20 }) }) })
  });
  Venta.create = async () => {
    const error = new Error('duplicate key');
    error.code = 11000;
    throw error;
  };
  Venta.findOne = (filter) => {
    reads++;
    assert.deepEqual(filter, { origen: 'restaurante', origenId: pedidoId, empresaId, sedeId });
    return { session: async () => ({
      estado: 'pagada', cantidad: 1, precioUnitario: 100, total: 100,
      productoServicioId: productoId, metodoPago: '', clienteId: null
    }) };
  };
  try {
    await assert.rejects(
      registrarVentaDesdePedido({
        pedido: { _id: pedidoId, empresaId, sedeId, productoServicioId: productoId,
          cantidad: 1, precioUnitario: 100, precio: 120 },
        empresaId, sedeId, emitirEvento: false
      }),
      (error) => error.code === 'GRUK_VENTA_REPLAY_CONFLICT'
    );
    assert.equal(reads, 1);
  } finally {
    ProductoServicio.findOne = oldProduct;
    Venta.create = oldCreate;
    Venta.findOne = oldFind;
  }
});
