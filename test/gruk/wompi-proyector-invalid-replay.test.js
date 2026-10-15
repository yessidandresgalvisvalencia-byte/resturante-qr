"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { crearProyectorIngresoWompi } = require("../../services/p0/proyectarIngresoWompi");
const base = {
  empresaId:"507f191e810c19729de860ea",
  aggregateId:"507f1f77bcf86cd799439011",
  eventId:"VENTA_COMPLETADA:507f1f77bcf86cd799439011",
  eventName:"VENTA_COMPLETADA",
  payload:{ventaId:"507f1f77bcf86cd799439011",restaurantId:"gruk-test",total:52000}
};
test("El proyector rechaza importe inválido antes incluso de consultar recibo de replay", async () => {
  let procesados=0;
  const proyectar=crearProyectorIngresoWompi({
    procesar: async()=>{procesados++;return {replayed:true};}
  });
  for (const total of [NaN,Infinity,0,-1,52000.5,Math.floor(Number.MAX_SAFE_INTEGER/100)+1,"52000"]) {
    await assert.rejects(proyectar({...base,payload:{...base.payload,total}}),/INGRESO_EVENTO_INVALIDO/);
  }
  assert.equal(procesados,0);
});
