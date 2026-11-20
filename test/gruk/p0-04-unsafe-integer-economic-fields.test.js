'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ProductoServicio = require('../../models/ProductoServicio');
const Venta = require('../../models/Venta');
const { registrarVentaDesdePedido } = require('../../services/ventas.service');

test('P0-04: unsafe integer economic inputs fail closed before a sale write', async () => {
  const originalFind = ProductoServicio.findOne;
  const originalCreate = Venta.create;
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
      for (const valor of [Number.MAX_SAFE_INTEGER + 1, String(Number.MAX_SAFE_INTEGER + 1)]) {
        await assert.rejects(
          registrarVentaDesdePedido({
            pedido: { ...pedido, [campo]: valor }, empresaId, sedeId, emitirEvento: false
          }),
          /fuera de rango seguro/
        );
      }
    }
    cost = Number.MAX_SAFE_INTEGER + 1;
    await assert.rejects(
      registrarVentaDesdePedido({ pedido, empresaId, sedeId, emitirEvento: false }),
      /fuera de rango seguro/
    );
    assert.equal(writes, 0);
  } finally {
    ProductoServicio.findOne = originalFind;
    Venta.create = originalCreate;
  }
});
