'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ProductoServicio = require('../../models/ProductoServicio');
const Cliente = require('../../models/Cliente');
const Venta = require('../../models/Venta');
const { registrarVentaDesdePedido } = require('../../services/ventas.service');

test('P0-04: matching tenant and branch can persist a sale with scoped product and customer', async () => {
  const originalProduct = ProductoServicio.findOne;
  const originalCustomer = Cliente.findOne;
  const originalCreate = Venta.create;
  const empresaId = new mongoose.Types.ObjectId();
  const sedeId = new mongoose.Types.ObjectId();
  const productoServicioId = new mongoose.Types.ObjectId();
  const clienteId = new mongoose.Types.ObjectId();
  const pedidoId = new mongoose.Types.ObjectId();
  const productFilters = [];
  const customerFilters = [];
  const writes = [];
  const query = (value) => ({
    select() { return this; },
    session() { return this; },
    async lean() { return value; }
  });
  ProductoServicio.findOne = (filter) => {
    productFilters.push(filter);
    return query({ _id: productoServicioId, costoUnitario: 10 });
  };
  Cliente.findOne = (filter) => {
    customerFilters.push(filter);
    return query({ _id: clienteId });
  };
  Venta.create = async (documents, options) => {
    writes.push({ documents, options });
    return [{ _id: new mongoose.Types.ObjectId(), ...documents[0] }];
  };
  const pedido = {
    _id: pedidoId, empresaId, sedeId, productoServicioId, clienteId,
    cantidad: 2, precioUnitario: 25, precio: 50, producto: 'Producto',
    metodoPago: 'efectivo'
  };
  try {
    const result = await registrarVentaDesdePedido({
      pedido, empresaId, sedeId, emitirEvento: false
    });
    assert.equal(result.creada, true);
    assert.equal(writes.length, 1);
    assert.deepEqual(productFilters, [{
      _id: productoServicioId, empresaId, sedeId: { $in: [sedeId, null] }
    }]);
    assert.deepEqual(customerFilters, [{
      _id: clienteId, empresaId, deletedAt: null, sedeId
    }]);
    const saved = writes[0].documents[0];
    assert.equal(saved.empresaId, empresaId);
    assert.equal(saved.sedeId, sedeId);
    assert.equal(saved.origenId, pedidoId);
    assert.equal(saved.productoServicioId, productoServicioId);
    assert.equal(saved.clienteId, clienteId);
    assert.equal(saved.estado, 'pagada');
    assert.equal(saved.total, 50);
  } finally {
    ProductoServicio.findOne = originalProduct;
    Cliente.findOne = originalCustomer;
    Venta.create = originalCreate;
  }
});
