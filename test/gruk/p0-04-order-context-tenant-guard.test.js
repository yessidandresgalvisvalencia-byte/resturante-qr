'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ProductoServicio = require('../../models/ProductoServicio');
const Venta = require('../../models/Venta');
const { registrarVentaDesdePedido } = require('../../services/ventas.service');

test('P0-04: mismatched order tenant or branch is rejected before lookup or write', async () => {
  const originalLookup = ProductoServicio.findOne;
  const originalCreate = Venta.create;
  let reads = 0;
  let writes = 0;
  ProductoServicio.findOne = () => { reads++; throw new Error('unexpected lookup'); };
  Venta.create = async () => { writes++; throw new Error('unexpected write'); };
  const empresaId = new mongoose.Types.ObjectId();
  const otraEmpresaId = new mongoose.Types.ObjectId();
  const sedeId = new mongoose.Types.ObjectId();
  const otraSedeId = new mongoose.Types.ObjectId();
  const pedido = { _id: new mongoose.Types.ObjectId(), productoServicioId: new mongoose.Types.ObjectId() };
  try {
    await assert.rejects(
      registrarVentaDesdePedido({ pedido: { ...pedido, empresaId: otraEmpresaId }, empresaId, sedeId, emitirEvento: false }),
      /pedido de otra empresa/
    );
    await assert.rejects(
      registrarVentaDesdePedido({ pedido: { ...pedido, empresaId, sedeId: otraSedeId }, empresaId, sedeId, emitirEvento: false }),
      /pedido de otra sede/
    );
    await assert.rejects(
      registrarVentaDesdePedido({ pedido: { ...pedido, sedeId: otraSedeId }, empresaId, emitirEvento: false }),
      /pedido de otra sede/
    );
    assert.equal(reads, 0);
    assert.equal(writes, 0);
  } finally {
    ProductoServicio.findOne = originalLookup;
    Venta.create = originalCreate;
  }
});

test('P0-04: matching order tenant and branch reaches scoped lookup without writing when product is absent', async () => {
  const originalLookup = ProductoServicio.findOne;
  const originalCreate = Venta.create;
  const empresaId = new mongoose.Types.ObjectId();
  const sedeId = new mongoose.Types.ObjectId();
  const productoServicioId = new mongoose.Types.ObjectId();
  const pedido = { _id: new mongoose.Types.ObjectId(), empresaId, sedeId, productoServicioId };
  let lookupFilter;
  let writes = 0;
  ProductoServicio.findOne = (filter) => {
    lookupFilter = filter;
    return { select() { return this; }, session() { return this; }, async lean() { return null; } };
  };
  Venta.create = async () => { writes++; throw new Error('unexpected write'); };
  try {
    await assert.rejects(
      registrarVentaDesdePedido({ pedido, empresaId, sedeId, emitirEvento: false }),
      /ProductoServicio no pertenece a la empresa/
    );
    assert.equal(String(lookupFilter.empresaId), String(empresaId));
    assert.equal(String(lookupFilter._id), String(productoServicioId));
    assert.deepEqual(lookupFilter.sedeId.$in.map(String), [String(sedeId), String(null)]);
    assert.equal(writes, 0);
  } finally {
    ProductoServicio.findOne = originalLookup;
    Venta.create = originalCreate;
  }
});


test('P0-04: missing or malformed order identity cannot reach product lookup or sale write', async () => {
  const originalLookup = ProductoServicio.findOne;
  const originalCreate = Venta.create;
  let reads = 0;
  let writes = 0;
  ProductoServicio.findOne = () => { reads++; throw new Error('unexpected lookup'); };
  Venta.create = async () => { writes++; throw new Error('unexpected write'); };
  const empresaId = new mongoose.Types.ObjectId();
  const productoServicioId = new mongoose.Types.ObjectId();
  try {
    for (const invalidId of [undefined, null, '', 'not-an-object-id']) {
      await assert.rejects(
        registrarVentaDesdePedido({
          pedido: { _id: invalidId, productoServicioId },
          empresaId,
          emitirEvento: false
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
