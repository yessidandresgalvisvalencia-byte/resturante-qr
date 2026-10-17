"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const {anexarEventoV81}=require("../../modules/finanzas-personales/services/persistenciaLedgerV81.service");
const {verificarLedgerPersistidoV81}=require("../../modules/finanzas-personales/services/verificacionLedgerV81.service");
const Evento=require("../../modules/finanzas-personales/models/eventoV81.model");
const Cabeza=require("../../modules/finanzas-personales/models/cabezaV81.model");

const uri=process.env.TEST_MONGO_URI;
const configurada=Boolean(uri);
const db=uri ? new URL(uri).pathname.slice(1) : "";
// Impide usar por accidente una BD con movimientos reales.
if(configurada && !/(^test($|_)|_test$|_test_)/i.test(db)) {
 throw new Error("TEST_MONGO_URI debe apuntar explícitamente a una base de prueba");
}
const datos=(id)=>({
 id,tipo:"GASTO",montoCentavos:2500000n,
 fechaContable:"2026-10-17",timestamp:"2026-10-17T14:00:00-05:00"
});
test("integración MongoDB V81: reintentos, concurrencia e integridad", {skip:!configurada},async()=>{
 await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
 const usuarioId=new mongoose.Types.ObjectId();
 try{
  await Promise.all([Evento.init(),Cabeza.init()]);
  const original=await anexarEventoV81(usuarioId,datos("registro-uno"));
  const repetido=await anexarEventoV81(usuarioId,datos("registro-uno"));
  assert.equal(original.hashActual,repetido.hashActual);
  assert.equal(await Evento.countDocuments({usuarioId}),1);
  await assert.rejects(
   anexarEventoV81(usuarioId,{...datos("registro-uno"),montoCentavos:3000000n}),
   e=>e.statusCode===409
  );
  const intentos=await Promise.allSettled([
   anexarEventoV81(usuarioId,datos("registro-dos")),
   anexarEventoV81(usuarioId,datos("registro-tres"))
  ]);
  assert.ok(intentos.some(x=>x.status==="fulfilled"));
  for(const x of intentos) if(x.status==="rejected") assert.ok(
   x.reason?.statusCode===409 || x.reason?.hasErrorLabel?.("TransientTransactionError"),
   "Solo se permiten conflictos transitorios de concurrencia"
  );
  // Dos anulaciones simultáneas sobre el mismo gasto no pueden aplicarse dos veces.
  const cancelaciones=await Promise.allSettled([
   anexarEventoV81(usuarioId,{...datos("anulacion-uno"),tipo:"ANULACION",montoCentavos:0n,corrigeId:"registro-uno",motivo:"Movimiento duplicado"}),
   anexarEventoV81(usuarioId,{...datos("anulacion-dos"),tipo:"ANULACION",montoCentavos:0n,corrigeId:"registro-uno",motivo:"Movimiento duplicado"})
  ]);
  assert.equal(cancelaciones.filter(x=>x.status==="fulfilled").length,1);
  assert.equal(await Evento.countDocuments({usuarioId,corrigeId:"registro-uno",tipo:"ANULACION"}),1);
  const auditoria=await verificarLedgerPersistidoV81(usuarioId);
  assert.equal(auditoria.integridad,"VERIFICADA");
  const cabeza=await Cabeza.findOne({usuarioId}).lean();
  assert.equal(auditoria.cantidad,cabeza.version);
  assert.equal(auditoria.cantidad,await Evento.countDocuments({usuarioId}));
 }finally{
  // Borrar exclusivamente registros de prueba con usuarioId aleatorio en BD de test.
  await Evento.collection.deleteMany({usuarioId});
  await Cabeza.collection.deleteMany({usuarioId});
  await mongoose.disconnect();
 }
});
