"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const mongoose=require("mongoose");
const {validarMongoPruebasV81}=require("../../scripts/exigir-mongo-v81-pruebas");
const service=require("../../modules/finanzas-personales/services/compromisosCuotas.service");
const Padre=require("../../modules/finanzas-personales/models/compromisoCuotas.model");
const Cuota=require("../../modules/finanzas-personales/models/cuotaHija.model");
const Tx=require("../../modules/finanzas-personales/models/TransaccionPersonal");
const Cuenta=require("../../modules/finanzas-personales/models/cuentaFinanciera.model");
const Outbox=require("../../modules/finanzas-personales/models/outboxPersonal.model");
const Cursor=require("../../modules/finanzas-personales/models/CursorCompensacionPersonal");
const Evento=require("../../modules/finanzas-personales/models/EventoCompensatorioPersonal");
const {personalEventBus,PERSONAL_EVENTS}=require("../../modules/finanzas-personales/events/eventBusPersonal");
const {republicarPendientes}=require("../../modules/finanzas-personales/services/flujoCajaPersonal.service");
const uri=process.env.GRUK_V81_TEST_MONGO_URI;

test("MongoDB real: pagos y reversiones de cuotas conservan saldos, aislamiento y atomicidad",{
 skip:!uri&&process.env.GRUK_REQUIRE_COMPENSACION_MONGO_TEST!=="1"?"Requiere replica set local aislado":false,
 timeout:60000
},async()=>{
 validarMongoPruebasV81(uri);
 const secretAnterior=process.env.PERSONAL_IDEMPOTENCY_SECRET;
 process.env.PERSONAL_IDEMPOTENCY_SECRET=crypto.randomBytes(32).toString("hex");
 const usuarios=[];
 const outboxCreate=Outbox.create;
 await mongoose.connect(uri,{serverSelectionTimeoutMS:7000});
 async function fixture({pagada=true,modo="CUENTA",total=1001,n=3}={}){
  const usuarioId=new mongoose.Types.ObjectId();usuarios.push(usuarioId);
  const cuenta=await Cuenta.create({usuarioId,nombre:"Cuenta de prueba",tipo:"AHORROS",saldoMinor:10000});
  const padre=await service.crear(usuarioId,{concepto:"Compra financiada",categoria:"HOGAR",montoTotalMinor:total,numeroCuotas:n});
  const solicitud={compromisoId:String(padre._id),numero:1,modo,cuentaId:modo==="CUENTA"?cuenta._id:null,externalId:crypto.randomUUID()};
  const pago=pagada?await service.pagar(usuarioId,solicitud):null;
  return {usuarioId,cuenta,padre,solicitud,pago};
 }
 async function estado(f){
  // Lecturas posteriores al commit/rollback: también detectan cambios de timestamps y auditoría.
  return {
   padre:await Padre.findById(f.padre._id).lean(),
   cuotas:await Cuota.find({usuarioId:f.usuarioId}).sort({numero:1}).lean(),
   cuenta:await Cuenta.findById(f.cuenta._id).lean(),
   tx:await Tx.find({usuarioId:f.usuarioId}).sort({_id:1}).lean(),
   outbox:await Outbox.find({usuarioId:f.usuarioId}).sort({_id:1}).lean(),
   cursor:await Cursor.findById(String(f.usuarioId)).lean()
  };
 }
 const revertir=f=>service.deshacer(f.usuarioId,{compromisoId:f.solicitud.compromisoId,numero:1});
 async function rechazoSinCambios(f,operacion=revertir){
  const antes=await estado(f);
  await assert.rejects(operacion(f),e=>e.statusCode===409);
  assert.deepEqual(await estado(f),antes);
 }
 try{
  await Promise.all([Padre.init(),Cuota.init(),Tx.init(),Cuenta.init(),Outbox.init(),Cursor.init(),Evento.init()]);
  // La ruta completa de crear/pagar/revertir debe persistir sus eventos, no abortar por enum.
  const f=await fixture();
  assert.equal(f.pago.transaccion.montoMinor,334);
  assert.equal((await Cuenta.findById(f.cuenta._id)).saldoMinor,9666);
  const dup=await service.pagar(f.usuarioId,f.solicitud);
  assert.equal(dup.duplicado,true);
  const reversion=await revertir(f);
  assert.equal(reversion.compromiso.saldoMinor,1001);
  assert.equal(reversion.compromiso.cuotasPagadas,0);
  assert.equal(reversion.cuota.estado,"PENDIENTE");
  assert.equal((await Cuenta.findById(f.cuenta._id)).saldoMinor,10000);
  await rechazoSinCambios(f);
  // El identificador de pago anulado no puede reutilizarse para volver a descontar.
  await rechazoSinCambios(f,x=>service.pagar(x.usuarioId,x.solicitud));
  const nuevo=await service.pagar(f.usuarioId,{...f.solicitud,externalId:crypto.randomUUID()});
  assert.equal(nuevo.duplicado,false);
  assert.equal((await Cuenta.findById(f.cuenta._id)).saldoMinor,9666);

  const historico=await fixture({modo:"HISTORICO",total:10,n:1});
  assert.equal((await Padre.findById(historico.padre._id)).estado,"FINALIZADA");
  await revertir(historico);
  assert.equal((await Cuenta.findById(historico.cuenta._id)).saldoMinor,10000);
  assert.equal((await Padre.findById(historico.padre._id)).estado,"ACTIVA");

  // Corrupciones independientes: no devolver caja si no coincide el asiento con su cuota.
  const corrupciones=[
   async x=>Tx.updateOne({_id:x.pago.transaccion._id},{$set:{montoMinor:335}}),
   async x=>Cuota.updateOne({_id:x.pago.cuota._id},{$set:{montoMinor:333}}),
   async x=>Padre.updateOne({_id:x.padre._id},{$set:{saldoMinor:666}}),
   async x=>Padre.updateOne({_id:x.padre._id},{$set:{cuotasPagadas:1.5}}),
   async x=>Tx.updateOne({_id:x.pago.transaccion._id},{$set:{prestamoId:new mongoose.Types.ObjectId()}}),
   async x=>Tx.collection.updateOne({_id:x.pago.transaccion._id},{$unset:{impactoCaja:""}}),
   async x=>Tx.updateOne({_id:x.pago.transaccion._id},{$set:{fecha:new Date(0)}}),
   async x=>Tx.updateOne({_id:x.pago.transaccion._id},{$set:{cuentaId:null}})
  ];
  for(const corromper of corrupciones){const x=await fixture();await corromper(x);await rechazoSinCambios(x);}
  const falsoHistorico=await fixture({modo:"HISTORICO"});
  await Tx.updateOne({_id:falsoHistorico.pago.transaccion._id},{$set:{cuentaId:falsoHistorico.cuenta._id}});
  await rechazoSinCambios(falsoHistorico);
  const overflow=await fixture();
  await Cuenta.updateOne({_id:overflow.cuenta._id},{$set:{saldoMinor:Number.MAX_SAFE_INTEGER-333}});
  await rechazoSinCambios(overflow);
  const moneda=await fixture();
  await Cuenta.collection.updateOne({_id:moneda.cuenta._id},{$set:{moneda:"USD"}});
  await rechazoSinCambios(moneda);
  const ajeno=await fixture();
  const otro=new mongoose.Types.ObjectId();usuarios.push(otro);
  await Cuenta.updateOne({_id:ajeno.cuenta._id},{$set:{usuarioId:otro}});
  await rechazoSinCambios(ajeno);

  // Un pago nuevo tampoco puede consumir cuotas o saldos desincronizados.
  for(const campo of ["saldoMinor","montoMinor"]){
   const x=await fixture({pagada:false});
   if(campo==="saldoMinor")await Padre.updateOne({_id:x.padre._id},{$set:{saldoMinor:1000}});
   else await Cuota.updateOne({usuarioId:x.usuarioId,numero:1},{$set:{montoMinor:335}});
   await rechazoSinCambios(x,y=>service.pagar(y.usuarioId,y.solicitud));
  }
  const saldoInseguro=await fixture({pagada:false});
  await Cuenta.collection.updateOne({_id:saldoInseguro.cuenta._id},{$set:{saldoMinor:Number.MAX_SAFE_INTEGER+1}});
  await rechazoSinCambios(saldoInseguro,x=>service.pagar(x.usuarioId,x.solicitud));

  // Dos reversiones simultáneas solo pueden devolver el dinero una vez.
  const concurrente=await fixture();
  const carrera=await Promise.allSettled([revertir(concurrente),revertir(concurrente)]);
  assert.equal(carrera.filter(x=>x.status==="fulfilled").length,1);
  assert.equal(carrera.filter(x=>x.status==="rejected").length,1);
  assert.equal((await Cuenta.findById(concurrente.cuenta._id)).saldoMinor,10000);
  assert.equal(await Outbox.countDocuments({usuarioId:concurrente.usuarioId,eventName:"COMPROMISO_CUOTA_REVERTIDA"}),1);

  // Un error de auditoría posterior a las escrituras revierte TODA la operación.
  const rollback=await fixture();
  const antes=await estado(rollback);
  Outbox.create=async()=>{throw Error("Fallo simulado de auditoría");};
  try{await assert.rejects(revertir(rollback),/Fallo simulado/);}finally{Outbox.create=outboxCreate;}
  assert.deepEqual(await estado(rollback),antes);

  // Los tres eventos persistidos deben ser aceptados también por el publicador real.
  const recibidos=[];
  const nombres=[PERSONAL_EVENTS.COMPROMISO_CUOTAS_CREADO,PERSONAL_EVENTS.COMPROMISO_CUOTA_PAGADA,PERSONAL_EVENTS.COMPROMISO_CUOTA_REVERTIDA];
  const escuchar=e=>recibidos.push(e);
  nombres.forEach(n=>personalEventBus.on(n,escuchar));
  try{await republicarPendientes(500);}finally{nombres.forEach(n=>personalEventBus.off(n,escuchar));}
  for(const nombre of nombres){
   assert.ok(recibidos.some(e=>e.eventName===nombre&&e.usuarioId===String(f.usuarioId)));
  }
  assert.equal(await Outbox.countDocuments({usuarioId:{$in:usuarios},estado:{$ne:"PUBLICADO"}}),0);
 }finally{
  Outbox.create=outboxCreate;
  // Solo en base local validada y exclusivamente identidades aleatorias de esta prueba.
  for(const Modelo of [Cuota,Padre,Tx,Cuenta,Outbox])await Modelo.deleteMany({usuarioId:{$in:usuarios}});
  await Cursor.deleteMany({_id:{$in:usuarios.map(String)}});
  await mongoose.disconnect();
  if(secretAnterior===undefined)delete process.env.PERSONAL_IDEMPOTENCY_SECRET;
  else process.env.PERSONAL_IDEMPOTENCY_SECRET=secretAnterior;
 }
});
