'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ProductoServicio = require('../../models/ProductoServicio');
const Venta = require('../../models/Venta');
const { registrarVentaDesdePedido } = require('../../services/ventas.service');

test('P0-04: nonzero decimal string cannot silently underflow to zero in a paid sale', async () => {
  const originalFind = ProductoServicio.findOne;
  const originalCreate = Venta.create;
  const empresaId = new mongoose.Types.ObjectId();
  const sedeId = new mongoose.Types.ObjectId();
  const productoServicioId = new mongoose.Types.ObjectId();
  const tiny = '0.' + '0'.repeat(400) + '1';
  let writes = 0;
  let cost = '1';
  ProductoServicio.findOne = () => ({ select: () => ({ session: () => ({ lean: async () => ({
    _id: productoServicioId, costoUnitario: cost
  }) }) }) });
  Venta.create = async () => { writes++; throw new Error('unexpected write'); };
  const pedido = { _id: new mongoose.Types.ObjectId(), empresaId, sedeId,
    productoServicioId, cantidad: 1, precioUnitario: '1', precio: '1' };
  try {
    for (const field of ['precioUnitario', 'precio']) {
      const malformed = { ...pedido, [field]: tiny };
      await assert.rejects(registrarVentaDesdePedido({ pedido: malformed, empresaId, sedeId, emitirEvento: false }),
        /precision economica insuficiente/);
    }
    cost = tiny;
    await assert.rejects(registrarVentaDesdePedido({ pedido, empresaId, sedeId, emitirEvento: false }),
      /precision economica insuficiente/);
    assert.equal(writes, 0);
  } finally {
    ProductoServicio.findOne = originalFind;
    Venta.create = originalCreate;
  }
});
