'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Venta = require('../../models/Venta');

test('P0-04: sale origin uniqueness is scoped to empresaId', () => {
  const originIndexes = Venta.schema.indexes().filter(([keys, options]) =>
    options.unique === true && Object.hasOwn(keys, 'origen') && Object.hasOwn(keys, 'origenId'));
  assert.equal(originIndexes.length, 1, 'expected exactly one declared unique origin index');
  assert.deepEqual(originIndexes[0][0], { empresaId: 1, origen: 1, origenId: 1 });
  assert.deepEqual(originIndexes[0][1].partialFilterExpression, {
    origenId: { $type: 'objectId' }
  });
});

test('P0-04: tenant identifier is required for sale records', () => {
  const missingTenant = new Venta({ concepto: 'test', precioUnitario: 1, total: 1 });
  const error = missingTenant.validateSync();
  assert.ok(error?.errors?.empresaId, 'missing empresaId must fail validation');
});
