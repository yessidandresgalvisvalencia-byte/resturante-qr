'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ProductoServicio = require('../../models/ProductoServicio');
const Venta = require('../../models/Venta');
const eventBus = require('../../core/eventos/eventBus');
const { registrarVentaDesdePedido } = require('../../services/ventas.service');

test('P0-04: event handler duplicate-key error is not mistaken for Venta.create replay', async () => {
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
  const duplicate = Object.assign(new Error('event consumer E11000'), { code: 11000 });
  let created = 0;
  let recovered = 0;
  ProductoServicio.findOne = () => ({
    select: () => ({ session: () => ({ lean: async () => ({
      _id: productoId, costoUnitario: 10
    }) }) })
  });
  Venta.create = async () => {
    created++;
    return [{ _id: new mongoose.Types.ObjectId(), empresaId, sedeId }];
  };
  Venta.findOne = () => {
    recovered++;
    throw new Error('must not attempt recovery');
  };
  eventBus.emit = () => { throw duplicate; };
  try {
    await assert.rejects(
      registrarVentaDesdePedido({
        pedido: {
          _id: pedidoId, empresaId, sedeId, productoServicioId: productoId,
          cantidad: 1, precioUnitario: 100, precio: 100
        },
        empresaId, sedeId, emitirEvento: true
      }),
      (error) => error === duplicate
    );
    assert.equal(created, 1);
    assert.equal(recovered, 0);
  } finally {
    ProductoServicio.findOne = originals.product;
    Venta.create = originals.create;
    Venta.findOne = originals.find;
    eventBus.emit = originals.emit;
  }
});
