'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ProductoServicio = require('../../models/ProductoServicio');
const Venta = require('../../models/Venta');
const eventBus = require('../../core/eventos/eventBus');
const { registrarVentaDesdePedido } = require('../../services/ventas.service');

// A replay is a read of an existing sale, never a second financial event.
test('P0-04: successful idempotent replay does not emit VENTA_COMPLETADA twice', async () => {
  const originals = {
    product: ProductoServicio.findOne,
    create: Venta.create,
    find: Venta.findOne,
    emit: eventBus.emit
  };
  const empresaId = new mongoose.Types.ObjectId();
  const sedeId = new mongoose.Types.ObjectId();
  const pedidoId = new mongoose.Types.ObjectId();
  const productoId = new mongoose.Types.ObjectId();
  const duplicate = Object.assign(new Error('E11000'), { code: 11000 });
  let emitted = 0;
  let created = 0;
  const venta = {
    _id: new mongoose.Types.ObjectId(),
    empresaId, sedeId, origen: 'restaurante', origenId: pedidoId,
    productoServicioId: productoId, clienteId: null,
    cantidad: 1, precioUnitario: 100, total: 100, metodoPago: '',
    estado: 'pagada'
  };
  ProductoServicio.findOne = () => ({
    select: () => ({ session: () => ({ lean: async () => ({
      _id: productoId, costoUnitario: 10
    }) }) })
  });
  Venta.create = async () => { created++; throw duplicate; };
  Venta.findOne = (filter) => {
    assert.equal(String(filter.empresaId), String(empresaId));
    assert.equal(String(filter.sedeId), String(sedeId));
    assert.equal(String(filter.origenId), String(pedidoId));
    return { session: async () => venta };
  };
  eventBus.emit = (name) => {
    if (name === 'VENTA_COMPLETADA') emitted++;
    return true;
  };
  try {
    const result = await registrarVentaDesdePedido({
      pedido: {
        _id: pedidoId, empresaId, sedeId, productoServicioId: productoId,
        cantidad: 1, precioUnitario: 100, precio: 100
      },
      empresaId, sedeId, emitirEvento: true
    });
    assert.equal(result.creada, false);
    assert.equal(result.venta, venta);
    assert.equal(created, 1);
    assert.equal(emitted, 0);
  } finally {
    ProductoServicio.findOne = originals.product;
    Venta.create = originals.create;
    Venta.findOne = originals.find;
    eventBus.emit = originals.emit;
  }
});
