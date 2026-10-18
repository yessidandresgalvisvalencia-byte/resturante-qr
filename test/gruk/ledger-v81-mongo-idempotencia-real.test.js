"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Evento=require("../../modules/finanzas-personales/models/eventoV81.model");
const Cabeza=require("../../modules/finanzas-personales/models/cabezaV81.model");
const {anexarEventoV81}=require("../../modules/finanzas-personales/services/persistenciaLedgerV81.service");
const {verificarCadena}=require("../../modules/finanzas-personales/services/cadenaEventosV81.service");

const uri=process.env.GRUK_V81_TEST_MONGO_URI;
const dbName=uri ? (()=>{try{return new URL(uri).pathname.replace(/^\//,"");}catch{return "";}})() : "";
const seguro=Boolean(uri && /^gruk_v81_test_[a-z0-9_-]+$/i.test(dbName) && process.env.NODE_ENV!=="production");
const base={id:"v81_reintento_igual",tipo:"GASTO",montoCentavos:2500030n,fechaContable:"2026-01-01",timestamp:"2026-01-01T10:00:00-05:00"};

test("MongoDB real: reintento concurrente idempotente e aislamiento entre usuarios",{
 skip:seguro?false:"Requiere GRUK_V81_TEST_MONGO_URI con base exclusiva gruk_v81_test_* y NODE_ENV no productivo",
 timeout:60000
},async()=>{
 const a=new mongoose.Types.ObjectId(),b=new mongoose.Types.ObjectId();
 await mongoose.connect(uri,{serverSelectionTimeoutMS:7000});
 try{
  // El índice compuesto es una condición de la garantía, no una suposición.
  await Promise.all([Evento.init(),Cabeza.init()]);
  const solicitudes=await Promise.allSettled([
   anexarEventoV81(a,base),
   anexarEventoV81(a,base)
  ]);
  assert.equal(solicitudes.filter(x=>x.status==="fulfilled").length>=1,true);
  for(const resultado of solicitudes){
   if(resultado.status==="rejected")assert.equal(resultado.reason.statusCode===409 || [112,251].includes(resultado.reason.code) || resultado.reason.hasErrorLabel?.("TransientTransactionError")===true,true);
  }
  assert.equal(await Evento.countDocuments({usuarioId:a,eventId:base.id}),1);
  const primero=await Evento.findOne({usuarioId:a,eventId:base.id}).lean();
  const cabeza=await Cabeza.findOne({usuarioId:a}).lean();
  assert.equal(cabeza.version,1);
  assert.equal(cabeza.hashActual,primero.hashActual);

  // El reintento secuencial devuelve exactamente el evento existente.
  const reintento=await anexarEventoV81(a,base);
  assert.equal(reintento.hashActual,primero.hashActual);
  assert.equal(await Evento.countDocuments({usuarioId:a}),1);
  await assert.rejects(
   ()=>anexarEventoV81(a,{...base,montoCentavos:2500130n}),
   error=>error.statusCode===409
  );
  assert.equal(await Evento.countDocuments({usuarioId:a}),1);

  // El mismo eventId de otro usuario no debe colisionar ni consultar el primero.
  const otro=await anexarEventoV81(b,base);
  assert.equal(otro.version,1);
  assert.notEqual(otro.hashActual,primero.hashActual);
  assert.equal(await Evento.countDocuments({usuarioId:b}),1);
  assert.equal(await Evento.countDocuments({usuarioId:a}),1);

  const rows=await Evento.find({usuarioId:a}).sort({version:1}).lean();
  assert.equal(verificarCadena(rows.map(e=>({
   id:e.eventId,userId:String(e.usuarioId),version:e.version,tipo:e.tipo,
   montoCentavos:BigInt(e.montoCentavos),fechaContable:e.fechaContable,
   timestamp:e.timestamp,corrigeId:e.corrigeId,motivo:e.motivo,
   tipoCorregido:e.tipoCorregido,hashAnterior:e.hashAnterior,hashActual:e.hashActual
  })),cabeza.hashActual),true);
 }finally{
  // Limpieza exclusiva de los dos ObjectIds generados para esta prueba.
  await Evento.collection.deleteMany({usuarioId:{$in:[a,b]}});
  await Cabeza.collection.deleteMany({usuarioId:{$in:[a,b]}});
  await mongoose.disconnect();
 }
});
