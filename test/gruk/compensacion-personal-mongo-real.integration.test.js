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
  // Las rutas heredadas no pueden mutar el original cuando ya está compensado.
  const flujoLegado=require("../../modules/finanzas-personales/services/flujoCajaPersonal.service");
  await assert.rejects(()=>flujoLegado.corregirTransaccion(usuarioId,String(asiento._id),
   {montoMinor:20000}),e=>e.statusCode===409&&/ledger compensatorio/.test(e.message));
  await assert.rejects(()=>flujoLegado.anularTransaccion(usuarioId,String(asiento._id)),
   e=>e.statusCode===409&&/ledger compensatorio/.test(e.message));
  assert.equal((await Movimiento.findById(asiento._id).lean()).montoMinor,25000);
  assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,103000);
  assert.equal(await Outbox.countDocuments({usuarioId}),1);
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
  // Dos correcciones compiten sobre la MISMA cuenta y cursor del usuario.
  // Una operación que reciba WriteConflict no puede dejar saldo ni outbox sueltos.
  const [asientoSegundo]=await Movimiento.create([{
   usuarioId,cuentaId:cuenta._id,cuenta:cuenta.nombre,
   tipo:"GASTO",montoMinor:30000,concepto:"Transporte",categoria:"Movilidad",
   fecha:new Date("2026-10-20T13:00:00.000Z"),estado:"ACTIVA",
   impactoCaja:true,recurrente:false
  }]);
  const segundo={usuarioId:String(usuarioId),movimientoId:String(asientoSegundo._id),
   tipo:"GASTO",montoMinor:30000,concepto:"Transporte",categoria:"Movilidad"};
  const propuestas=[
   {original:segundoOriginal,tipo:"CORRECCION",cambios:{montoMinor:21000},
    idempotencyKey:"concurrente_uno",fechaISO:"2026-10-20T17:00:00.000Z"},
   {original:segundo,tipo:"CORRECCION",cambios:{montoMinor:28000},
    idempotencyKey:"concurrente_dos",fechaISO:"2026-10-20T17:00:00.000Z"}
  ];
  const carrera=await Promise.allSettled(propuestas.map(p=>registrar(p)));
  const confirmados=carrera.filter(p=>p.status==="fulfilled");
  assert.ok(confirmados.length>=1,"Debe confirmarse al menos una compensación concurrente");
  for(const fallo of carrera.filter(p=>p.status==="rejected"))
   assert.ok(fallo.reason.statusCode===409||[112,251].includes(fallo.reason.code)||
    fallo.reason.hasErrorLabel?.("TransientTransactionError")===true,
    "Fallo concurrente inesperado: "+String(fallo.reason));
  const deltas=confirmados.reduce((n,r)=>n+BigInt(r.value.deltaCajaMinor),0n);
  const cuentaFinal=await Cuenta.findById(cuenta._id).lean();
  assert.equal(BigInt(cuentaFinal.saldoMinor),103000n+deltas);
  assert.equal(await Evento.countDocuments({usuarioId:String(usuarioId)}),1+confirmados.length);
  assert.equal(await Outbox.countDocuments({usuarioId}),1+confirmados.length);
  const cabezaFinal=await Cursor.findById(String(usuarioId)).lean();
  assert.equal(cabezaFinal.secuencia,1+confirmados.length);
  assert.equal((await Movimiento.findById(asientoSegundo._id).lean()).montoMinor,30000);
  const eventos=await Evento.find({usuarioId:String(usuarioId)}).sort({secuencia:1}).lean();
  assert.equal(verificarCadena(eventos,{prevHash:"0".repeat(64)}),true);
  assert.equal(eventos.at(-1).hashActual,cabezaFinal.hashActual);
 }finally{
  try{
   if(mongoose.connection.readyState===1&&mongoose.connection.db.databaseName===dbName)
    await mongoose.connection.dropDatabase();
  }finally{await mongoose.disconnect();}
 }
});
test("la integración de Mongo requiere destino loopback y autorización expresa",()=>{
 if(uri&&autorizado)assert.doesNotThrow(()=>exigirAislamiento());
 else assert.throws(()=>exigirAislamiento(),/CONFIRMACION|MONGO_REMOTO|URI_DE_PRUEBAS/);
});
