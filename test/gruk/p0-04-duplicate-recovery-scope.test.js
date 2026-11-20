'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ProductoServicio = require('../../models/ProductoServicio');
const Venta = require('../../models/Venta');
const { registrarVentaDesdePedido } = require('../../services/ventas.service');

test('P0-04: duplicate-key recovery never retrieves a sale outside the requested tenant and branch', async () => {
  const originalProduct = ProductoServicio.findOne;
  const originalCreate = Venta.create;
  const originalFind = Venta.findOne;
  const empresaId = new mongoose.Types.ObjectId();
  const sedeId = new mongoose.Types.ObjectId();
  const pedidoId = new mongoose.Types.ObjectId();
  const productoId = new mongoose.Types.ObjectId();
  const filters = [];
  ProductoServicio.findOne = () => ({
    select: () => ({ session: () => ({ lean: async () => ({ _id: productoId, costoUnitario: 0 }) }) })
  });
  Venta.create = async () => {
    const error = new Error('duplicate key');
    error.code = 11000;
    throw error;
  };
  Venta.findOne = (filter) => {
    filters.push(filter);
    return { session: async () => null };
  };
  try {
    const pedido = {
      _id: pedidoId, empresaId, sedeId, productoServicioId: productoId,
      cantidad: 1, precioUnitario: 100, precio: 100
    };
    await assert.rejects(
      registrarVentaDesdePedido({ pedido, empresaId, sedeId, emitirEvento: false }),
      (error) => error.code === 11000
    );
    assert.equal(filters.length, 1);
    assert.deepEqual(filters[0], {
      origen: 'restaurante', origenId: pedidoId, empresaId, sedeId
    });
  } finally {
    ProductoServicio.findOne = originalProduct;
    Venta.create = originalCreate;
    Venta.findOne = originalFind;
  }
});
