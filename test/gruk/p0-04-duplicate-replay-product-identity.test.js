'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ProductoServicio = require('../../models/ProductoServicio');
const Venta = require('../../models/Venta');
const eventBus = require('../../core/eventos/eventBus');
const { registrarVentaDesdePedido } = require('../../services/ventas.service');

test('P0-04: replay with a different product identity cannot reuse an existing paid sale', async () => {
  const original = {
    product: ProductoServicio.findOne, create: Venta.create,
    find: Venta.findOne, emit: eventBus.emit
  };
  const empresaId = new mongoose.Types.ObjectId();
  const sedeId = new mongoose.Types.ObjectId();
  const pedidoId = new mongoose.Types.ObjectId();
  const requestedProductId = new mongoose.Types.ObjectId();
  const existingProductId = new mongoose.Types.ObjectId();
  let emitted = 0;
  let recoveryReads = 0;
  ProductoServicio.findOne = () => ({
    select: () => ({ session: () => ({ lean: async () => ({
      _id: requestedProductId, costoUnitario: 20
    }) }) })
  });
  Venta.create = async () => { throw Object.assign(new Error('E11000'), { code: 11000 }); };
  Venta.findOne = (filter) => {
    recoveryReads++;
    assert.deepEqual(filter, { origen: 'restaurante', origenId: pedidoId, empresaId, sedeId });
    return { session: async () => ({
      estado: 'pagada', cantidad: 1, precioUnitario: 100, total: 100,
      productoServicioId: existingProductId, metodoPago: '', clienteId: null
    }) };
  };
  eventBus.emit = () => { emitted++; };
  try {
    await assert.rejects(
      registrarVentaDesdePedido({
        pedido: {
          _id: pedidoId, empresaId, sedeId, productoServicioId: requestedProductId,
          cantidad: 1, precioUnitario: 100, precio: 100
        },
        empresaId, sedeId
      }),
      (error) => error.code === 'GRUK_VENTA_REPLAY_CONFLICT'
    );
    assert.equal(recoveryReads, 1);
    assert.equal(emitted, 0);
  } finally {
    ProductoServicio.findOne = original.product;
    Venta.create = original.create;
    Venta.findOne = original.find;
    eventBus.emit = original.emit;
  }
});
