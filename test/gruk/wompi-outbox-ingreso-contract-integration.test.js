"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { crearEventoVentaCompletada } = require("../../services/gruk/crearEventoVentaCompletada");
const { crearProyectorIngresoWompi } = require("../../services/p0/proyectarIngresoWompi");

test("Evento de venta Wompi concilia exactamente con ingreso COP del proyector", async () => {
  const venta = {
    _id:"507f1f77bcf86cd799439011",
    empresaId:"507f191e810c19729de860ea",
    origenId:"507f1f77bcf86cd799439012",
    origen:"restaurante", estado:"pagada",metodoPago:"tarjeta",
    total:52000, sedeId:null, metadata:{restaurantId:"rest-prueba"}
  };
  const evento = crearEventoVentaCompletada(venta);
  let ingreso = null;
  const VentaModel = {
    findOne(filter) {
      assert.equal(String(filter._id), String(venta._id));
      assert.equal(String(filter.empresaId), String(venta.empresaId));
      assert.equal(filter.metodoPago, "tarjeta");
      return { session() { return { lean: async () => venta }; } };
    }
  };
  const IngresoModel = {
    async create(docs,options) {
      assert.equal(options.session,"session-prueba");
      ingreso = docs[0];
    }
  };
  const procesar = async ({empresaId,consumidor,eventId,aplicar}) => {
    assert.equal(String(empresaId),String(venta.empresaId));
    assert.equal(consumidor,"finanzas_wompi_p0");
    assert.equal(eventId,evento.eventId);
    await aplicar({session:"session-prueba"});
    return {applied:true,replayed:false};
  };
  const proyectar = crearProyectorIngresoWompi({VentaModel,IngresoModel,procesar});
  assert.deepEqual(await proyectar(evento),{applied:true,replayed:false});
  assert.equal(ingreso.importeCentavos,5200000);
  assert.equal(ingreso.eventId,evento.eventId);
  assert.equal(String(ingreso.ventaId),String(venta._id));
  assert.equal(String(ingreso.empresaId),String(venta.empresaId));
});

test("Proyector no registra ingreso si evento altera el importe", async () => {
  const venta = {
    _id:"507f1f77bcf86cd799439011",
    empresaId:"507f191e810c19729de860ea",
    origenId:"507f1f77bcf86cd799439012",
    origen:"restaurante",estado:"pagada",metodoPago:"tarjeta",
    total:52000,metadata:{restaurantId:"rest-prueba"}
  };
  const evt = crearEventoVentaCompletada(venta);
  evt.payload.total = 52001;
  let writes=0;
  const proyectar=crearProyectorIngresoWompi({
    VentaModel:{ findOne() {return {session(){return {lean:async()=>venta}}};} },
    IngresoModel:{async create(){writes++;}},
    procesar:({aplicar})=>aplicar({session:"session-prueba"})
  });
  await assert.rejects(proyectar(evt),/INGRESO_MONTO_NO_CONCILIADO/);
  assert.equal(writes,0);
});
