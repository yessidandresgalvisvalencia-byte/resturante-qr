"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const mongoose=require("mongoose");
const Cuenta=require("../../modules/finanzas-personales/models/cuentaFinanciera.model");
const Movimiento=require("../../modules/finanzas-personales/models/TransaccionPersonal");
const Cursor=require("../../modules/finanzas-personales/models/CursorCompensacionPersonal");
const Evento=require("../../modules/finanzas-personales/models/EventoCompensatorioPersonal");
const Outbox=require("../../modules/finanzas-personales/models/outboxPersonal.model");
const {crearRegistrador}=require("../../modules/finanzas-personales/services/registradorCompensacionPersonal.service");
const {crearAplicadorAtomicoPersonal}=require("../../modules/finanzas-personales/services/aplicarCompensacionCajaAtomica.service");
const {verificarCadena}=require("../../modules/finanzas-personales/services/eventoCompensatorioPersonal.service");
const uri=process.env.TEST_MONGO_URI;
const autorizado=process.env.GRUK_TEST_DB_CONFIRM==="SOLO_PRUEBAS_LOCALES";
function exigirAislamiento(){
 if(!autorizado)throw Error("CONFIRMACION_MONGO_DE_PRUEBAS_REQUERIDA");
 let u;
 try{u=new URL(uri);}catch(_){throw Error("URI_DE_PRUEBAS_INVALIDA");}
 if(u.protocol!=="mongodb:"||!["127.0.0.1","[::1]"].includes(u.hostname)||
   u.port!=="27017"||u.username||u.password||u.host.includes(",")||
   u.searchParams.get("directConnection")!=="true")
  throw Error("MONGO_REMOTO_PROHIBIDO");
}
test("Mongo real aislado: cursor, evento, caja y outbox se confirman o revierten juntos",{
 skip:!uri||!autorizado,timeout:60000
},async()=>{
 exigirAislamiento();
 const dbName="gruk_fp_comp_test_"+crypto.randomUUID().replace(/-/g,"");
 await mongoose.connect(uri,{dbName,serverSelectionTimeoutMS:7000});
 try{
  await Promise.all([Cuenta.init(),Movimiento.init(),Cursor.init(),Evento.init(),Outbox.init()]);
  const usuarioId=new mongoose.Types.ObjectId();
  const [cuenta]=await Cuenta.create([{
   usuarioId,nombre:"COMP-PRUEBA",tipo:"AHORROS",saldoMinor:100000,
   moneda:"COP",activa:true,requiereReconciliacion:false,
   saldoVerificadoEn:new Date(),origenSaldo:"USUARIO"
  }]);
  const [asiento]=await Movimiento.create([{
   usuarioId,cuentaId:cuenta._id,cuenta:cuenta.nombre,
   tipo:"GASTO",montoMinor:25000,concepto:"Rappi",categoria:"Alimentacion",
   fecha:new Date("2026-10-20T12:00:00.000Z"),estado:"ACTIVA",
   impactoCaja:true,recurrente:false
  }]);
  const original={
   usuarioId:String(usuarioId),movimientoId:String(asiento._id),
   tipo:"GASTO",montoMinor:25000,concepto:"Rappi",categoria:"Alimentacion"
  };
  const aplicar=crearAplicadorAtomicoPersonal();
  const registrar=crearRegistrador({aplicarAtomico:aplicar});
  const primera=await registrar({original,tipo:"CORRECCION",cambios:{montoMinor:22000},
   idempotencyKey:"primera",fechaISO:"2026-10-20T15:00:00.000Z"});
  assert.equal(primera.deltaCajaMinor,"3000");
  assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,103000);
  assert.equal(await Evento.countDocuments({usuarioId:String(usuarioId)}),1);
  assert.equal(await Outbox.countDocuments({usuarioId}),1);
  const cabeza=await Cursor.findById(String(usuarioId)).lean();
  assert.equal(cabeza.secuencia,1);
  assert.equal(cabeza.hashActual,primera.hashActual);
  const preservado=await Movimiento.findById(asiento._id).lean();
  assert.equal(preservado.montoMinor,25000);
  assert.equal(preservado.estado,"ACTIVA");
  const segundoOriginal={...original,montoMinor:22000};
  const registrarFalla=crearRegistrador({aplicarAtomico:async contexto=>{
   await aplicar(contexto);
   throw Error("FALLO_SIMULADO_DESPUES_DE_OUTBOX");
  }});
  await assert.rejects(()=>registrarFalla({
   original:segundoOriginal,tipo:"CORRECCION",cambios:{montoMinor:20000},
   idempotencyKey:"segunda",fechaISO:"2026-10-20T16:00:00.000Z"
  }),/FALLO_SIMULADO_DESPUES_DE_OUTBOX/);
  assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,103000);
  assert.equal(await Evento.countDocuments({usuarioId:String(usuarioId)}),1);
  assert.equal(await Outbox.countDocuments({usuarioId}),1);
  assert.deepEqual(await Cursor.findById(String(usuarioId)).lean(),cabeza);
  assert.equal((await Movimiento.findById(asiento._id).lean()).montoMinor,25000);
  const eventos=await Evento.find({usuarioId:String(usuarioId)}).sort({secuencia:1}).lean();
  assert.equal(verificarCadena(eventos,{prevHash:"0".repeat(64)}),true);
 }finally{
  try{
   if(mongoose.connection.readyState===1&&mongoose.connection.db.databaseName===dbName)
    await mongoose.connection.dropDatabase();
  }finally{await mongoose.disconnect();}
 }
});
test("la integración de Mongo requiere destino loopback y autorización expresa",()=>{
 assert.throws(()=>exigirAislamiento(),/CONFIRMACION|MONGO_REMOTO|URI_DE_PRUEBAS/);
});
