'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ProductoServicio = require('../../models/ProductoServicio');
const Venta = require('../../models/Venta');
const { registrarVentaDesdePedido } = require('../../services/ventas.service');

test('P0-04: source order must have a valid identity before any tenant data access or sale write', async () => {
  const originalLookup = ProductoServicio.findOne;
  const originalCreate = Venta.create;
  let reads = 0;
  let writes = 0;
  ProductoServicio.findOne = () => { reads++; throw new Error('unexpected lookup'); };
  Venta.create = async () => { writes++; throw new Error('unexpected write'); };
  try {
    const empresaId = new mongoose.Types.ObjectId();
    const sedeId = new mongoose.Types.ObjectId();
    const productoServicioId = new mongoose.Types.ObjectId();
    for (const badId of [undefined, null, '', 'not-an-object-id']) {
      await assert.rejects(
        registrarVentaDesdePedido({
          pedido: { _id: badId, empresaId, sedeId, productoServicioId },
          empresaId, sedeId, emitirEvento: false
        }),
        /pedidoId invalido/
      );
    }
    assert.equal(reads, 0);
    assert.equal(writes, 0);
  } finally {
    ProductoServicio.findOne = originalLookup;
    Venta.create = originalCreate;
  }
});
