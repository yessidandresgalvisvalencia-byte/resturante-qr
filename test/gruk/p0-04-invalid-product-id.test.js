'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ProductoServicio = require('../../models/ProductoServicio');
const Venta = require('../../models/Venta');
const { registrarVentaDesdePedido } = require('../../services/ventas.service');

test('P0-04: invalid product identity is rejected before tenant lookup and sale write', async () => {
  const originalLookup = ProductoServicio.findOne;
  const originalCreate = Venta.create;
  let reads = 0;
  let writes = 0;
  ProductoServicio.findOne = () => { reads++; throw new Error('unexpected lookup'); };
  Venta.create = async () => { writes++; throw new Error('unexpected write'); };
  try {
    const empresaId = new mongoose.Types.ObjectId();
    for (const invalidProductId of ['not-an-object-id', '', '123']) {
      await assert.rejects(
        registrarVentaDesdePedido({
          pedido: { _id: new mongoose.Types.ObjectId(), productoServicioId: invalidProductId },
          empresaId, emitirEvento: false
        }),
        /productoServicioId invalido|pedido sin productoServicioId/
      );
    }
    assert.equal(reads, 0);
    assert.equal(writes, 0);
  } finally {
    ProductoServicio.findOne = originalLookup;
    Venta.create = originalCreate;
  }
});
