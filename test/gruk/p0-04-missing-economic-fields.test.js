'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ProductoServicio = require('../../models/ProductoServicio');
const Venta = require('../../models/Venta');
const { registrarVentaDesdePedido } = require('../../services/ventas.service');

test('P0-04: absent economic fields never coerce to zero-value paid sales', async () => {
  const original = { product: ProductoServicio.findOne, create: Venta.create };
  const empresaId = new mongoose.Types.ObjectId();
  const sedeId = new mongoose.Types.ObjectId();
  const productoServicioId = new mongoose.Types.ObjectId();
  let writes = 0;
  let cost = 5;
  ProductoServicio.findOne = () => ({
    select: () => ({ session: () => ({ lean: async () => ({
      _id: productoServicioId, costoUnitario: cost
    }) }) })
  });
  Venta.create = async () => { writes++; throw new Error('unexpected write'); };
  const pedido = {
    _id: new mongoose.Types.ObjectId(), empresaId, sedeId, productoServicioId,
    cantidad: 1, precioUnitario: 100, precio: 100
  };
  try {
    for (const campo of ['cantidad', 'precioUnitario', 'precio']) {
      for (const valor of [null, undefined, '', '  ']) {
        await assert.rejects(
          registrarVentaDesdePedido({
            pedido: { ...pedido, [campo]: valor }, empresaId, sedeId, emitirEvento: false
          }),
          /datos economicos invalidos/
        );
      }
    }
    for (const valor of [null, undefined, '', '  ']) {
      cost = valor;
      await assert.rejects(
        registrarVentaDesdePedido({ pedido, empresaId, sedeId, emitirEvento: false }),
        /datos economicos invalidos/
      );
    }
    assert.equal(writes, 0);
  } finally {
    ProductoServicio.findOne = original.product;
    Venta.create = original.create;
  }
});
