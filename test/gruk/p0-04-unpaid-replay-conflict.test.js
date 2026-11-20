'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ProductoServicio = require('../../models/ProductoServicio');
const Cliente = require('../../models/Cliente');
const Venta = require('../../models/Venta');
const { registrarVentaDesdePedido } = require('../../services/ventas.service');

test('P0-04: duplicate-key replay of unpaid or cancelled sale fails closed', async () => {
  const original = [ProductoServicio.findOne, Cliente.findOne, Venta.findOne, Venta.create];
  const empresaId = new mongoose.Types.ObjectId();
  const sedeId = new mongoose.Types.ObjectId();
  const pedidoId = new mongoose.Types.ObjectId();
  const productoId = new mongoose.Types.ObjectId();
  const pedido = { _id: pedidoId, empresaId, sedeId, productoServicioId: productoId,
    cantidad: 1, precioUnitario: 100, precio: 100, metodoPago: 'efectivo' };
  const saleFilters = [];
  let writes = 0;
  ProductoServicio.findOne = () => ({ select: () => ({ session: () => ({
    lean: async () => ({ _id: productoId, costoUnitario: 20 })
  }) }) });
  Cliente.findOne = () => { throw Error('unexpected customer lookup'); };
  Venta.create = async () => { writes++; const e = Error('duplicate'); e.code = 11000; throw e; };
  try {
    for (const estado of ['pendiente', 'cancelada']) {
      Venta.findOne = (filter) => {
        saleFilters.push(filter);
        return { session: async () => ({ estado, empresaId, sedeId,
          productoServicioId: productoId, cantidad: 1, precioUnitario: 100,
          total: 100, metodoPago: 'efectivo', clienteId: null }) };
      };
      await assert.rejects(
        registrarVentaDesdePedido({ pedido, empresaId, sedeId, emitirEvento: false }),
        (e) => e.code === 'GRUK_VENTA_REPLAY_STATE_CONFLICT'
      );
    }
    assert.equal(writes, 2);
    assert.equal(saleFilters.length, 2);
    for (const filter of saleFilters) {
      assert.equal(String(filter.empresaId), String(empresaId));
      assert.equal(String(filter.sedeId), String(sedeId));
      assert.equal(String(filter.origenId), String(pedidoId));
      assert.equal(filter.origen, 'restaurante');
    }
  } finally {
    [ProductoServicio.findOne, Cliente.findOne, Venta.findOne, Venta.create] = original;
  }
});
