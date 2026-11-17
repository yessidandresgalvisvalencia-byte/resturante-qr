'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ProductoServicio = require('../../models/ProductoServicio');
const Venta = require('../../models/Venta');
const { registrarVentaDesdePedido } = require('../../services/ventas.service');

test('P0-04: derived monetary overflow rejects sale before any write', async () => {
  const originalFind = ProductoServicio.findOne;
  const originalCreate = Venta.create;
  const empresaId = new mongoose.Types.ObjectId();
  const sedeId = new mongoose.Types.ObjectId();
  const productoServicioId = new mongoose.Types.ObjectId();
  let writes = 0;
  let cost = Number.MAX_SAFE_INTEGER;
  ProductoServicio.findOne = () => ({
    select: () => ({ session: () => ({ lean: async () => ({
      _id: productoServicioId, costoUnitario: cost
    }) }) })
  });
  Venta.create = async () => { writes++; throw new Error('unexpected write'); };
  const pedido = {
    _id: new mongoose.Types.ObjectId(), empresaId, sedeId, productoServicioId,
    cantidad: 2, precioUnitario: 1, precio: 2
  };
  try {
    // Both inputs are safe integers; their product is not.
    await assert.rejects(
      registrarVentaDesdePedido({ pedido, empresaId, sedeId, emitirEvento: false }),
      /calculos economicos fuera de rango seguro/
    );
    // A safe cost and safe total can yield an unsafe negative profit.
    cost = Number.MAX_SAFE_INTEGER;
    await assert.rejects(
      registrarVentaDesdePedido({
        pedido: { ...pedido, cantidad: 1, precio: 0, precioUnitario: 0 },
        empresaId, sedeId, emitirEvento: false
      }),
      /unexpected write/
    );
    // With quantity two, both computed cost and gross profit overflow.
    assert.equal(writes, 1);
  } finally {
    ProductoServicio.findOne = originalFind;
    Venta.create = originalCreate;
  }
});
