'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const servicePath = path.join(__dirname, '../../services/ventas.service.js');
function loadService(product) {
  const source = fs.readFileSync(servicePath, 'utf8');
  const queries = [];
  let writes = 0;
  let emittedEvents = 0;
  const productModel = {
    findOne(filter) {
      queries.push(filter);
      return {
        select() { return this; },
        session() { return this; },
        async lean() {
          if (String(filter._id) !== String(product._id) ||
              String(filter.empresaId) !== String(product.empresaId) ||
              (product.sedeId && String(filter.sedeId) !== String(product.sedeId))) return null;
          return product;
        }
      };
    }
  };
  const stubs = {
    mongoose: { Types: { ObjectId: { isValid: () => true } } },
    '../models/Venta': { async create() { writes++; return [{ _id: 'sale-1' }]; } },
    '../models/ProductoServicio': productModel,
    '../models/Cliente': {},
    '../core/eventos/eventBus': { emit() { emittedEvents++; } }
  };
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, require(id) {
    if (!(id in stubs)) throw new Error('Unexpected dependency: ' + id);
    return stubs[id];
  }, Number, String, Error }, { filename: servicePath });
  return { service: module.exports, queries, writes: () => writes, emittedEvents: () => emittedEvents };
}

const pedido = { _id: 'order-1', productoServicioId: 'product-1', cantidad: 1,
  precioUnitario: 100, precio: 100, producto: 'Prueba' };

test('rejects a product owned by another company before creating a sale', async () => {
  const harness = loadService({ _id: 'product-1', empresaId: 'company-B', sedeId: 'site-1', costoUnitario: 1 });
  await assert.rejects(harness.service.registrarVentaDesdePedido({
    pedido, empresaId: 'company-A', sedeId: 'site-1', emitirEvento: true
  }), /ProductoServicio no pertenece/);
  assert.equal(harness.writes(), 0);
  assert.equal(harness.emittedEvents(), 0);
  assert.equal(harness.queries[0].empresaId, 'company-A');
});

test('rejects a product owned by another site of the same company before creating a sale', async () => {
  const harness = loadService({ _id: 'product-1', empresaId: 'company-A', sedeId: 'site-2', costoUnitario: 1 });
  await assert.rejects(harness.service.registrarVentaDesdePedido({
    pedido, empresaId: 'company-A', sedeId: 'site-1', emitirEvento: true
  }), /ProductoServicio no pertenece/);
  assert.equal(harness.writes(), 0);
  assert.equal(harness.emittedEvents(), 0);
  assert.equal(harness.queries[0].sedeId, 'site-1');
});

test('rejects missing tenant context without querying products or writing sales', async () => {
  const harness = loadService({ _id: 'product-1', empresaId: 'company-A', sedeId: 'site-1', costoUnitario: 1 });
  await assert.rejects(harness.service.registrarVentaDesdePedido({
    pedido, empresaId: null, sedeId: 'site-1', emitirEvento: true
  }), /empresaId requerido/);
  assert.equal(harness.queries.length, 0);
  assert.equal(harness.writes(), 0);
  assert.equal(harness.emittedEvents(), 0);
});


test('rejects missing product identity before querying or creating a sale', async () => {
  const harness = loadService({ _id: 'product-1', empresaId: 'company-A', sedeId: 'site-1', costoUnitario: 1 });
  await assert.rejects(harness.service.registrarVentaDesdePedido({
    pedido: { ...pedido, productoServicioId: null },
    empresaId: 'company-A', sedeId: 'site-1', emitirEvento: true
  }), /pedido sin productoServicioId/);
  assert.equal(harness.queries.length, 0);
  assert.equal(harness.writes(), 0);
  assert.equal(harness.emittedEvents(), 0);
});

test('rejects missing order before reading products, writing sales or emitting events', async () => {
  const harness = loadService({ _id: 'product-1', empresaId: 'company-A', sedeId: 'site-1', costoUnitario: 1 });
  await assert.rejects(harness.service.registrarVentaDesdePedido({
    pedido: null, empresaId: 'company-A', sedeId: 'site-1', emitirEvento: true
  }), /pedido requerido/);
  assert.equal(harness.queries.length, 0);
  assert.equal(harness.writes(), 0);
  assert.equal(harness.emittedEvents(), 0);
});
