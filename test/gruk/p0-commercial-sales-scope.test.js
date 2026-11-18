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
              (filter.sedeId === null ? product.sedeId != null :
                !Array.isArray(filter.sedeId?.$in) ||
                !filter.sedeId.$in.some(site => String(site) === String(product.sedeId)))) return null;
          return product;
        }
      };
    }
  };
  const stubs = {
    mongoose: { Types: { ObjectId: { isValid: value => /^[a-f\d]{24}$/i.test(String(value)) } } },
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

// Use syntactically valid ObjectIds: the production service validates identities
// before reading MongoDB. This harness is a unit-level contract, not MongoDB E2E.
const pedido = { _id: '444444444444444444444444', productoServicioId: '333333333333333333333333', cantidad: 1,
  precioUnitario: 100, precio: 100, producto: 'Prueba' };

test('rejects a product owned by another company before creating a sale', async () => {
  const harness = loadService({ _id: '333333333333333333333333', empresaId: 'bbbbbbbbbbbbbbbbbbbbbbbb', sedeId: '111111111111111111111111', costoUnitario: 1 });
  await assert.rejects(harness.service.registrarVentaDesdePedido({
    pedido, empresaId: 'aaaaaaaaaaaaaaaaaaaaaaaa', sedeId: '111111111111111111111111', emitirEvento: true
  }), /ProductoServicio no pertenece/);
  assert.equal(harness.writes(), 0);
  assert.equal(harness.emittedEvents(), 0);
  assert.equal(harness.queries[0].empresaId, 'aaaaaaaaaaaaaaaaaaaaaaaa');
});

test('rejects a product owned by another site of the same company before creating a sale', async () => {
  const harness = loadService({ _id: '333333333333333333333333', empresaId: 'aaaaaaaaaaaaaaaaaaaaaaaa', sedeId: '222222222222222222222222', costoUnitario: 1 });
  await assert.rejects(harness.service.registrarVentaDesdePedido({
    pedido, empresaId: 'aaaaaaaaaaaaaaaaaaaaaaaa', sedeId: '111111111111111111111111', emitirEvento: true
  }), /ProductoServicio no pertenece/);
  assert.equal(harness.writes(), 0);
  assert.equal(harness.emittedEvents(), 0);
  assert.equal(harness.queries[0].sedeId.$in[0], '111111111111111111111111');
});

test('rejects missing tenant context without querying products or writing sales', async () => {
  const harness = loadService({ _id: '333333333333333333333333', empresaId: 'aaaaaaaaaaaaaaaaaaaaaaaa', sedeId: '111111111111111111111111', costoUnitario: 1 });
  await assert.rejects(harness.service.registrarVentaDesdePedido({
    pedido, empresaId: null, sedeId: '111111111111111111111111', emitirEvento: true
  }), /empresaId requerido/);
  assert.equal(harness.queries.length, 0);
  assert.equal(harness.writes(), 0);
  assert.equal(harness.emittedEvents(), 0);
});


test('rejects missing product identity before querying or creating a sale', async () => {
  const harness = loadService({ _id: '333333333333333333333333', empresaId: 'aaaaaaaaaaaaaaaaaaaaaaaa', sedeId: '111111111111111111111111', costoUnitario: 1 });
  await assert.rejects(harness.service.registrarVentaDesdePedido({
    pedido: { ...pedido, productoServicioId: null },
    empresaId: 'aaaaaaaaaaaaaaaaaaaaaaaa', sedeId: '111111111111111111111111', emitirEvento: true
  }), /pedido sin productoServicioId/);
  assert.equal(harness.queries.length, 0);
  assert.equal(harness.writes(), 0);
  assert.equal(harness.emittedEvents(), 0);
});

test('rejects missing order before reading products, writing sales or emitting events', async () => {
  const harness = loadService({ _id: '333333333333333333333333', empresaId: 'aaaaaaaaaaaaaaaaaaaaaaaa', sedeId: '111111111111111111111111', costoUnitario: 1 });
  await assert.rejects(harness.service.registrarVentaDesdePedido({
    pedido: null, empresaId: 'aaaaaaaaaaaaaaaaaaaaaaaa', sedeId: '111111111111111111111111', emitirEvento: true
  }), /pedido requerido/);
  assert.equal(harness.queries.length, 0);
  assert.equal(harness.writes(), 0);
  assert.equal(harness.emittedEvents(), 0);
});


test('rejects a site-scoped product when the sale omits site context', async () => {
  const harness = loadService({ _id: '333333333333333333333333', empresaId: 'aaaaaaaaaaaaaaaaaaaaaaaa', sedeId: '222222222222222222222222', costoUnitario: 1 });
  await assert.rejects(harness.service.registrarVentaDesdePedido({
    pedido, empresaId: 'aaaaaaaaaaaaaaaaaaaaaaaa', sedeId: null, emitirEvento: true
  }), /ProductoServicio no pertenece|sedeId requerido/);
  assert.equal(harness.writes(), 0);
  assert.equal(harness.emittedEvents(), 0);
  assert.equal(harness.queries[0]?.empresaId, 'aaaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(harness.queries[0]?.sedeId, null);
});

// Positive control: prove the harness accepts a legitimate same-company, same-site sale.
// Without this control, an implementation that rejects every request could pass all
// negative tests while breaking the commercial checkout flow.
test('accepts a same-company same-site product and creates exactly one sale', async () => {
  const harness = loadService({ _id: '333333333333333333333333', empresaId: 'aaaaaaaaaaaaaaaaaaaaaaaa', sedeId: '111111111111111111111111', costoUnitario: 1 });
  const result = await harness.service.registrarVentaDesdePedido({
    pedido, empresaId: 'aaaaaaaaaaaaaaaaaaaaaaaa', sedeId: '111111111111111111111111', emitirEvento: true
  });
  assert.equal(result.creada, true);
  assert.equal(harness.queries.length, 1);
  assert.equal(harness.queries[0].empresaId, 'aaaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(harness.queries[0].sedeId.$in[0], '111111111111111111111111');
  assert.equal(harness.writes(), 1);
  assert.equal(harness.emittedEvents(), 1);
});


// Event suppression is a supported path for callers that publish only after
// committing their transaction. It must not prevent the sale from being saved.
test('persists an authorized sale without publishing when emitirEvento is false', async () => {
  const harness = loadService({ _id: '333333333333333333333333', empresaId: 'aaaaaaaaaaaaaaaaaaaaaaaa', sedeId: '111111111111111111111111', costoUnitario: 1 });
  const result = await harness.service.registrarVentaDesdePedido({
    pedido, empresaId: 'aaaaaaaaaaaaaaaaaaaaaaaa', sedeId: '111111111111111111111111', emitirEvento: false
  });
  assert.equal(result.creada, true);
  assert.equal(harness.queries.length, 1);
  assert.equal(harness.writes(), 1);
  assert.equal(harness.emittedEvents(), 0);
});

// A malformed branch identity must fail closed before any product lookup,
// sale write or event publication, even when the product otherwise matches.
test('rejects malformed site identity before reading products or writing sales', async () => {
  const harness = loadService({ _id: '333333333333333333333333', empresaId: 'aaaaaaaaaaaaaaaaaaaaaaaa', sedeId: '111111111111111111111111', costoUnitario: 1 });
  await assert.rejects(harness.service.registrarVentaDesdePedido({
    pedido, empresaId: 'aaaaaaaaaaaaaaaaaaaaaaaa', sedeId: 'not-an-object-id', emitirEvento: true
  }), /sedeId invalido/);
  assert.equal(harness.queries.length, 0);
  assert.equal(harness.writes(), 0);
  assert.equal(harness.emittedEvents(), 0);
});


test('rejects an order explicitly owned by another company before product lookup or side effects', async () => {
  const harness = loadService({ _id: '333333333333333333333333', empresaId: 'aaaaaaaaaaaaaaaaaaaaaaaa', sedeId: '111111111111111111111111', costoUnitario: 1 });
  await assert.rejects(harness.service.registrarVentaDesdePedido({
    pedido: { ...pedido, empresaId: 'bbbbbbbbbbbbbbbbbbbbbbbb' },
    empresaId: 'aaaaaaaaaaaaaaaaaaaaaaaa', sedeId: '111111111111111111111111', emitirEvento: true
  }), /pedido de otra empresa/);
  assert.equal(harness.queries.length, 0);
  assert.equal(harness.writes(), 0);
  assert.equal(harness.emittedEvents(), 0);
});

test('rejects an order explicitly owned by another site before product lookup or side effects', async () => {
  const harness = loadService({ _id: '333333333333333333333333', empresaId: 'aaaaaaaaaaaaaaaaaaaaaaaa', sedeId: '111111111111111111111111', costoUnitario: 1 });
  await assert.rejects(harness.service.registrarVentaDesdePedido({
    pedido: { ...pedido, sedeId: '222222222222222222222222' },
    empresaId: 'aaaaaaaaaaaaaaaaaaaaaaaa', sedeId: '111111111111111111111111', emitirEvento: true
  }), /pedido de otra sede/);
  assert.equal(harness.queries.length, 0);
  assert.equal(harness.writes(), 0);
  assert.equal(harness.emittedEvents(), 0);
});


test('rejects malformed customer identity before product lookup, sale write or event', async () => {
  const harness = loadService({ _id: '333333333333333333333333', empresaId: 'aaaaaaaaaaaaaaaaaaaaaaaa', sedeId: '111111111111111111111111', costoUnitario: 1 });
  await assert.rejects(harness.service.registrarVentaDesdePedido({
    pedido: { ...pedido, clienteId: 'invalid-customer-id' },
    empresaId: 'aaaaaaaaaaaaaaaaaaaaaaaa', sedeId: '111111111111111111111111', emitirEvento: true
  }), /clienteId invalido/);
  assert.equal(harness.queries.length, 0);
  assert.equal(harness.writes(), 0);
  assert.equal(harness.emittedEvents(), 0);
});

test('rejects malformed order identity before product lookup, sale write or event', async () => {
  const harness = loadService({ _id: '333333333333333333333333', empresaId: 'aaaaaaaaaaaaaaaaaaaaaaaa', sedeId: '111111111111111111111111', costoUnitario: 1 });
  await assert.rejects(harness.service.registrarVentaDesdePedido({
    pedido: { ...pedido, _id: 'invalid-order-id' },
    empresaId: 'aaaaaaaaaaaaaaaaaaaaaaaa', sedeId: '111111111111111111111111', emitirEvento: true
  }), /pedidoId invalido/);
  assert.equal(harness.queries.length, 0);
  assert.equal(harness.writes(), 0);
  assert.equal(harness.emittedEvents(), 0);
});
