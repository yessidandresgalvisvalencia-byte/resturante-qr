'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ProductoServicio = require('../../models/ProductoServicio');
const Venta = require('../../models/Venta');
const { registrarVentaDesdePedido } = require('../../services/ventas.service');

test('P0-04: paid replay with different product concept is a conflict', async () => {
  const original = [ProductoServicio.findOne, Venta.create, Venta.findOne];
  const empresaId = new mongoose.Types.ObjectId();
  const sedeId = new mongoose.Types.ObjectId();
  const pedidoId = new mongoose.Types.ObjectId();
  const productoId = new mongoose.Types.ObjectId();
  const pedido = { _id: pedidoId, empresaId, sedeId, productoServicioId: productoId,
    producto: 'Producto nuevo', cantidad: 2, precioUnitario: 100,
    precio: 200, metodoPago: 'efectivo' };
  let events = 0;
  ProductoServicio.findOne = () => ({ select: () => ({ session: () => ({
    lean: async () => ({ _id: productoId, costoUnitario: 30 })
  }) }) });
  Venta.create = async () => { const e = new Error('duplicate'); e.code = 11000; throw e; };
  Venta.findOne = (filter) => {
    assert.equal(String(filter.empresaId), String(empresaId));
    assert.equal(String(filter.sedeId), String(sedeId));
    return { session: async () => ({
      estado: 'pagada', concepto: 'Producto anterior', productoServicioId: productoId,
      cantidad: 2, precioUnitario: 100, total: 200, costoUnitario: 30,
      costoTotal: 60, metodoPago: 'efectivo', clienteId: null
    }) };
  };
  try {
    await assert.rejects(
      registrarVentaDesdePedido({ pedido, empresaId, sedeId, emitirEvento: false }),
      e => e.code === 'GRUK_VENTA_REPLAY_CONFLICT'
    );
    assert.equal(events, 0);
  } finally {
    [ProductoServicio.findOne, Venta.create, Venta.findOne] = original;
  }
});
