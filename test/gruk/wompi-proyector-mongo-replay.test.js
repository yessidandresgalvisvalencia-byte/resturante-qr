"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { crearProyectorIngresoWompi } = require("../../services/p0/proyectarIngresoWompi");
const { crearProcesadorIdempotente } = require("../../services/p0/procesadorEventosIdempotente");
const { crearEventoVentaCompletada } = require("../../services/gruk/crearEventoVentaCompletada");

test("Mongo replica set: venta Wompi proyecta un solo ingreso pese al replay", async (t) => {
  if (!process.env.TEST_MONGO_URI) { t.skip("TEST_MONGO_URI requerido"); return; }
  const conn = await mongoose.createConnection(process.env.TEST_MONGO_URI, {
    dbName: "gruk_test_proyeccion_wompi_e2e", serverSelectionTimeoutMS: 5000
  }).asPromise();
  const empresaId = new mongoose.Types.ObjectId();
  const ventaId = new mongoose.Types.ObjectId();
  const origenId = new mongoose.Types.ObjectId();
  const Venta = conn.model("ProjectionVenta", new mongoose.Schema({
    empresaId: mongoose.Schema.Types.ObjectId, origenId: mongoose.Schema.Types.ObjectId,
    origen: String, estado: String, metodoPago: String, total: Number,
    metadata: mongoose.Schema.Types.Mixed
  }, {collection:"ventas"}));
  const Ingreso = conn.model("ProjectionIngreso", new mongoose.Schema({
    empresaId: mongoose.Schema.Types.ObjectId, ventaId: mongoose.Schema.Types.ObjectId,
    eventId: String, importeCentavos: Number, moneda: String, fuente: String
  }, {collection:"ingresos"}));
  const Recibo = conn.model("ProjectionRecibo", new mongoose.Schema({
    empresaId: mongoose.Schema.Types.ObjectId, consumidor: String, eventId: String
  }, {collection:"recibos"}));
  Recibo.schema.index({empresaId:1,consumidor:1,eventId:1},{unique:true});
  Ingreso.schema.index({empresaId:1,ventaId:1},{unique:true});
  try {
    await Promise.all([Recibo.init(),Ingreso.init()]);
    const venta = {
      _id:ventaId, empresaId, origenId, origen:"restaurante",
      estado:"pagada", metodoPago:"tarjeta",total:52000,
      metadata:{restaurantId:"staging-restaurante"}
    };
    await Venta.create(venta);
    const evento = crearEventoVentaCompletada(venta);
    const procesar = crearProcesadorIdempotente({
      Receipt:Recibo,
      mongooseInstance:{isValidObjectId:mongoose.isValidObjectId,startSession:()=>conn.startSession()}
    });
    const proyectar = crearProyectorIngresoWompi({
      VentaModel:Venta,IngresoModel:Ingreso,procesar
    });
    assert.equal((await proyectar(evento)).applied,true);
    assert.equal((await proyectar(evento)).replayed,true);
    const ingresos = await Ingreso.find({empresaId,ventaId}).lean();
    assert.equal(ingresos.length,1);
    assert.equal(ingresos[0].importeCentavos,5200000);
    assert.equal(await Recibo.countDocuments({empresaId,eventId:evento.eventId}),1);
    const adulterado = {...evento,payload:{...evento.payload,total:52001}};
    // A different event identity must not bypass the financial reconciliation.
    const ventaFalsa = {...venta,_id:new mongoose.Types.ObjectId(),origenId:new mongoose.Types.ObjectId()};
    await Venta.create(ventaFalsa);
    const eventoAlterado = crearEventoVentaCompletada(ventaFalsa);
    eventoAlterado.payload.total=52001;
    await assert.rejects(proyectar(eventoAlterado),/INGRESO_MONTO_NO_CONCILIADO/);
    assert.equal(await Ingreso.countDocuments({empresaId}),1);
    assert.equal(await Recibo.countDocuments({empresaId}),1);
  } finally {
    await conn.dropDatabase();
    await conn.close();
  }
});
