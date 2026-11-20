"use strict";

// Runs exclusively on the disposable loopback MongoDB replica set initialized
// by GRUK CI. Drop only the random database created by this test.
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const ProductoServicio = require("../../models/ProductoServicio");
const Venta = require("../../models/Venta");
const Inventario = require("../../models/Inventario");
const MovimientoInventario = require("../../models/MovimientoInventario");
const { registrarVentaDesdePedido } = require("../../services/ventas.service");

const uri = process.env.TEST_MONGO_URI;
const enabled = uri === "mongodb://127.0.0.1:27017/?replicaSet=rs0";

test("P0-04: paid tracked order atomically discounts own stock, logs movement and rolls back on shortage", {
  skip: !enabled && "requires GRUK CI disposable loopback replica set"
}, async () => {
  const conn = mongoose.createConnection(uri, {
    dbName: "gruk_p004_tracked_" + crypto.randomBytes(8).toString("hex"),
    serverSelectionTimeoutMS: 10000
  });
  const old = {
    productFind: ProductoServicio.findOne,
    saleCreate: Venta.create,
    saleFind: Venta.findOne,
    stockFind: Inventario.find,
    stockUpdate: Inventario.findOneAndUpdate,
    movementCreate: MovimientoInventario.create
  };
  try {
    await conn.asPromise();
    const Products = conn.model("ProductoServicio", ProductoServicio.schema);
    const Sales = conn.model("Venta", Venta.schema);
    const Stock = conn.model("Inventario", Inventario.schema);
    const Movements = conn.model("MovimientoInventario", MovimientoInventario.schema);
    await Promise.all([Sales.init(), Stock.init(), Movements.init()]);

    ProductoServicio.findOne = (...args) => Products.findOne(...args);
    Venta.create = (...args) => Sales.create(...args);
    Venta.findOne = (...args) => Sales.findOne(...args);
    Inventario.find = (...args) => Stock.find(...args);
    Inventario.findOneAndUpdate = (...args) => Stock.findOneAndUpdate(...args);
    MovimientoInventario.create = (...args) => Movements.create(...args);

    const empresaId = new mongoose.Types.ObjectId();
    const sedeId = new mongoose.Types.ObjectId();
    const otraSede = new mongoose.Types.ObjectId();
    const product = await Products.create({
      empresaId, sedeId, tipo: "producto", nombre: "tracked sale",
      precioVenta: 30000, costoUnitario: 11000, manejaInventario: true
    });
    const inventory = await Stock.create({
      empresaId, sedeId, productoServicioId: product._id,
      restaurantId: "rest-test", nombre: "tracked sale", categoria: "stock",
      cantidad: 5, costo: 11000
    });
    const order = (cantidad, sitio = sedeId) => ({
      _id: new mongoose.Types.ObjectId(), empresaId, sedeId: sitio,
      restaurantId: "rest-test", productoServicioId: product._id,
      cantidad, precioUnitario: 30000, precio: cantidad * 30000,
      producto: "tracked sale", metodoPago: "efectivo"
    });
    const first = order(2);

    await assert.rejects(registrarVentaDesdePedido({
      pedido: first, empresaId, sedeId, emitirEvento: false
    }), /INVENTARIO_TRANSACCION_REQUERIDA/);
    assert.equal(await Sales.countDocuments({}), 0);

    const session = await conn.startSession();
    try {
      await session.withTransaction(async () => {
        const result = await registrarVentaDesdePedido({
          pedido: first, empresaId, sedeId, session, emitirEvento: false
        });
        assert.equal(result.creada, true);
        assert.equal(result.venta.total, 60000);
      });
      assert.equal((await Stock.findById(inventory._id)).cantidad, 3);
      assert.equal(await Sales.countDocuments({ empresaId, origenId: first._id }), 1);
      const movement = await Movements.findOne({ empresaId, sedeId, referenciaTipo: "VENTA" }).lean();
      assert.ok(movement);
      assert.equal(movement.cantidad, 2);
      assert.equal(movement.stockAnterior, 5);
      assert.equal(movement.stockNuevo, 3);
      assert.equal(movement.motivo, "venta");
      assert.equal(await Movements.countDocuments({ referenciaId: movement.referenciaId }), 1);

      const excessive = order(4);
      await assert.rejects(session.withTransaction(async () => {
        await registrarVentaDesdePedido({
          pedido: excessive, empresaId, sedeId, session, emitirEvento: false
        });
      }), /INVENTARIO_STOCK_INSUFICIENTE/);
      assert.equal((await Stock.findById(inventory._id)).cantidad, 3);
      assert.equal(await Sales.countDocuments({ empresaId, origenId: excessive._id }), 0);
      assert.equal(await Movements.countDocuments({ empresaId }), 1);

      const anotherBranch = order(1, otraSede);
      await assert.rejects(session.withTransaction(async () => {
        await registrarVentaDesdePedido({
          pedido: anotherBranch, empresaId, sedeId: otraSede, session, emitirEvento: false
        });
      }), /ProductoServicio no pertenece a la empresa/);
      assert.equal((await Stock.findById(inventory._id)).cantidad, 3);
      assert.equal(await Sales.countDocuments({ empresaId }), 1);

      // A restaurant in the same company/site must never consume another
      // restaurant's stock row by knowing the product ObjectId.
      const otherRestaurant = { ...order(1), restaurantId: "rest-sibling" };
      await assert.rejects(session.withTransaction(async () => {
        await registrarVentaDesdePedido({
          pedido: otherRestaurant, empresaId, sedeId, session, emitirEvento: false
        });
      }), /INVENTARIO_NO_UNICO_O_INEXISTENTE/);
      assert.equal((await Stock.findById(inventory._id)).cantidad, 3);
      assert.equal(await Sales.countDocuments({ empresaId }), 1);
      assert.equal(await Movements.countDocuments({ empresaId }), 1);
    } finally {
      await session.endSession();
    }
  } finally {
    ProductoServicio.findOne = old.productFind;
    Venta.create = old.saleCreate;
    Venta.findOne = old.saleFind;
    Inventario.find = old.stockFind;
    Inventario.findOneAndUpdate = old.stockUpdate;
    MovimientoInventario.create = old.movementCreate;
    if (conn.readyState === 1) await conn.dropDatabase();
    await conn.close();
  }
});
