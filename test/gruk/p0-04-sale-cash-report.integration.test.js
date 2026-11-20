"use strict";

// Disposable, loopback-only MongoDB integration: paid order -> persisted sale ->
// cash ledger -> branch report -> exact replay without duplicated cash entries.
// This does NOT assert inventory decrement, which still needs a dedicated gate.
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const ProductoServicio = require("../../models/ProductoServicio");
const Venta = require("../../models/Venta");
const MovimientoCaja = require("../../core/finanzas/models/MovimientoCaja");
const eventBus = require("../../core/eventos/eventBus");
const { registrarVentaDesdePedido } = require("../../services/ventas.service");
const { registrarMovimientoDesdeEvento, obtenerResumenCaja } = require("../../core/finanzas/caja.service");

const uri = process.env.GRUK_TEST_MONGO_URI;
const permitted = process.env.GRUK_TEST_MONGO_DISPOSABLE === "1" &&
  (uri === "mongodb://127.0.0.1:27017/" || uri === "mongodb://localhost:27017/");

test("P0-04: disposable Mongo real paid order -> sale -> cash -> branch report, replay is idempotent", {
  skip: !permitted && "requires explicit disposable loopback MongoDB and GRUK_TEST_MONGO_DISPOSABLE=1"
}, async () => {
  const dbName = "gruk_p004_cash_" + crypto.randomBytes(10).toString("hex");
  const conn = mongoose.createConnection(uri, { dbName, serverSelectionTimeoutMS: 8000 });
  const originals = {
    productFind: ProductoServicio.findOne,
    ventaCreate: Venta.create, ventaFind: Venta.findOne,
    cashCreate: MovimientoCaja.create, cashFind: MovimientoCaja.find,
    cashFindOne: MovimientoCaja.findOne, cashExists: MovimientoCaja.exists,
    cashAggregate: MovimientoCaja.aggregate
  };
  let capture = null;
  const onSale = event => { capture = event; };
  try {
    await conn.asPromise();
    const Products = conn.model("P004CashProduct", ProductoServicio.schema, "productoservicios");
    const Sales = conn.model("P004CashSale", Venta.schema, "ventas");
    const Cash = conn.model("P004CashMovement", MovimientoCaja.schema, "movimientos_caja");
    await Sales.init();
    await Cash.init();

    ProductoServicio.findOne = (...args) => Products.findOne(...args);
    Venta.create = (...args) => Sales.create(...args);
    Venta.findOne = (...args) => Sales.findOne(...args);
    MovimientoCaja.create = (...args) => Cash.create(...args);
    MovimientoCaja.find = (...args) => Cash.find(...args);
    MovimientoCaja.findOne = (...args) => Cash.findOne(...args);
    MovimientoCaja.exists = (...args) => Cash.exists(...args);
    MovimientoCaja.aggregate = (...args) => Cash.aggregate(...args);

    const empresaId = new mongoose.Types.ObjectId();
    const sedeId = new mongoose.Types.ObjectId();
    const foreignCompany = new mongoose.Types.ObjectId();
    const foreignSite = new mongoose.Types.ObjectId();
    const product = await Products.create({
      empresaId, sedeId, tipo: "producto", nombre: "P004 pedido de prueba",
      precioVenta: 25000, costoUnitario: 10000
    });
    const pedido = {
      _id: new mongoose.Types.ObjectId(),
      empresaId, sedeId,
      restaurantId: "p004-rest",
      productoServicioId: product._id,
      cantidad: 2, precioUnitario: 25000, precio: 50000,
      producto: "P004 pedido de prueba", metodoPago: ""
    };

    eventBus.on("VENTA_COMPLETADA", onSale);
    const first = await registrarVentaDesdePedido({
      pedido, empresaId, sedeId, emitirEvento: true
    });
    assert.equal(first.creada, true);
    assert.equal(first.venta.total, 50000);
    assert.equal(first.venta.costoTotal, 20000);
    assert.equal(first.venta.utilidadBruta, 30000);
    assert.equal(capture?.eventName, "VENTA_COMPLETADA");
    assert.equal(String(capture.payload.empresaId), String(empresaId));
    assert.equal(String(capture.payload.sedeId), String(sedeId));

    const firstCash = await registrarMovimientoDesdeEvento(capture, { emitirEvento: false });
    assert.equal(firstCash.creado, true);
    assert.equal(firstCash.movimiento.monto, 50000);
    assert.equal(firstCash.movimiento.origenTipo, "VENTA");
    assert.equal(String(firstCash.movimiento.empresaId), String(empresaId));
    assert.equal(String(firstCash.movimiento.sedeId), String(sedeId));

    const replaySale = await registrarVentaDesdePedido({
      pedido, empresaId, sedeId, emitirEvento: true
    });
    assert.equal(replaySale.creada, false);
    assert.equal(String(replaySale.venta._id), String(first.venta._id));
    const replayCash = await registrarMovimientoDesdeEvento(capture, { emitirEvento: false });
    assert.equal(replayCash.creado, false, "cash ledger must deduplicate replay");
    assert.equal(await Sales.countDocuments({ empresaId, origenId: pedido._id }), 1);
    assert.equal(await Cash.countDocuments({ empresaId, origenId: first.venta._id }), 1);

    const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const until = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const branchReport = await obtenerResumenCaja({ empresaId, sedeId, desde: from, hasta: until });
    assert.equal(branchReport.ventasPagadas.cantidad, 1);
    assert.equal(branchReport.ventasPagadas.monto, 50000);
    assert.equal(branchReport.entradasConfirmadas, 50000);
    assert.equal(branchReport.flujoConfirmadoParcial, 50000);

    // Real MongoDB accumulation must be decimal-exact (0.10 + 0.20).
    // Create actual paid sales rather than synthetic ledger-only rows.
    const smallProduct = await Products.create({
      empresaId, sedeId, tipo: "producto", nombre: "P004 decimal cash",
      precioVenta: 0.1, costoUnitario: 0
    });
    for (const amount of [0.1, 0.2]) {
      const smallOrder = {
        _id: new mongoose.Types.ObjectId(),
        empresaId, sedeId, restaurantId: "p004-rest",
        productoServicioId: smallProduct._id,
        cantidad: 1, precioUnitario: amount, precio: amount,
        producto: "P004 decimal cash", metodoPago: ""
      };
      const smallSale = await registrarVentaDesdePedido({
        pedido: smallOrder, empresaId, sedeId, emitirEvento: true
      });
      assert.equal(smallSale.creada, true);
      assert.equal((await registrarMovimientoDesdeEvento(capture, {
        emitirEvento: false
      })).creado, true);
    }
    const exactReport = await obtenerResumenCaja({
      empresaId, sedeId, desde: from, hasta: until
    });
    assert.equal(exactReport.ventasPagadas.cantidad, 3);
    assert.equal(exactReport.ventasPagadas.monto, 50000.3);
    assert.equal(exactReport.entradasConfirmadas, 50000.3);
    assert.equal(exactReport.flujoConfirmadoParcial, 50000.3);
    assert.equal(await Cash.countDocuments({ empresaId }), 3);

    const siblingSiteReport = await obtenerResumenCaja({
      empresaId, sedeId: foreignSite, desde: from, hasta: until
    });
    assert.equal(siblingSiteReport.entradasConfirmadas, 0);
    const anotherTenantReport = await obtenerResumenCaja({
      empresaId: foreignCompany, desde: from, hasta: until
    });
    assert.equal(anotherTenantReport.entradasConfirmadas, 0);
  } finally {
    eventBus.off("VENTA_COMPLETADA", onSale);
    ProductoServicio.findOne = originals.productFind;
    Venta.create = originals.ventaCreate;
    Venta.findOne = originals.ventaFind;
    MovimientoCaja.create = originals.cashCreate;
    MovimientoCaja.find = originals.cashFind;
    MovimientoCaja.findOne = originals.cashFindOne;
    MovimientoCaja.exists = originals.cashExists;
    MovimientoCaja.aggregate = originals.cashAggregate;
    if (conn.readyState === 1) {
      await conn.dropDatabase();
    }
    await conn.close();
  }
});
