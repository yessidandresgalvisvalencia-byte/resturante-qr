'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ProductoServicio = require('../../models/ProductoServicio');
const Venta = require('../../models/Venta');
const { registrarVentaDesdePedido } = require('../../services/ventas.service');

test('P0-04: rejected unsafe derived frozen cost never writes a sale', async () => {
  const originalFind = ProductoServicio.findOne;
  const originalCreate = Venta.create;
  const empresaId = new mongoose.Types.ObjectId();
  const sedeId = new mongoose.Types.ObjectId();
  const productoId = new mongoose.Types.ObjectId();
  let writes = 0;
  ProductoServicio.findOne = (filter) => {
    assert.equal(String(filter.empresaId), String(empresaId));
    return { select: () => ({ session: () => ({
      lean: async () => ({ _id: productoId, costoUnitario: Number.MAX_SAFE_INTEGER })
    }) }) };
  };
  Venta.create = async () => { writes++; throw new Error('unexpected write'); };
  try {
    await assert.rejects(
      registrarVentaDesdePedido({
        pedido: {
          _id: new mongoose.Types.ObjectId(), empresaId, sedeId,
          productoServicioId: productoId, cantidad: 2,
          precioUnitario: 1, precio: 2, metodoPago: 'efectivo'
        },
        empresaId, sedeId, emitirEvento: false
      }),
      /calculos economicos fuera de rango seguro|DINERO_RANGO_/
    );
    assert.equal(writes, 0);
  } finally {
    ProductoServicio.findOne = originalFind;
    Venta.create = originalCreate;
  }
});
