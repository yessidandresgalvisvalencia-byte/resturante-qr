'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ProductoServicio = require('../../models/ProductoServicio');
const Venta = require('../../models/Venta');
const { registrarVentaDesdePedido } = require('../../services/ventas.service');

test('P0-04: global catalog sale retains tenant scope without a branch', async () => {
  const originalFind = ProductoServicio.findOne;
  const originalCreate = Venta.create;
  const empresaId = new mongoose.Types.ObjectId();
  const productoServicioId = new mongoose.Types.ObjectId();
  const pedidoId = new mongoose.Types.ObjectId();
  const filters = [];
  const writes = [];
  ProductoServicio.findOne = (filter) => {
    filters.push(filter);
    return {
      select() { return this; },
      session() { return this; },
      async lean() { return { _id: productoServicioId, costoUnitario: 100 }; }
    };
  };
  Venta.create = async (records) => {
    writes.push(...records);
    return [{ ...records[0], _id: new mongoose.Types.ObjectId() }];
  };
  try {
    const result = await registrarVentaDesdePedido({
      empresaId,
      pedido: {
        _id: pedidoId,
        productoServicioId,
        cantidad: 2,
        precioUnitario: 300,
        precio: 600
      },
      emitirEvento: false
    });
    assert.equal(result.creada, true);
    assert.deepEqual(filters, [{ _id: productoServicioId, empresaId, sedeId: null }]);
    assert.equal(writes.length, 1);
    assert.equal(String(writes[0].empresaId), String(empresaId));
    assert.equal(writes[0].sedeId, null);
    assert.equal(String(writes[0].origenId), String(pedidoId));
  } finally {
    ProductoServicio.findOne = originalFind;
    Venta.create = originalCreate;
  }
});
