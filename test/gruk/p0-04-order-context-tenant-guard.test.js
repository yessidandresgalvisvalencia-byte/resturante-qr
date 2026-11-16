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
