"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto"),mongoose=require("mongoose"),express=require("express");
const {validarMongoPruebasV81}=require("../../scripts/exigir-mongo-v81-pruebas");
const patrimonio=require("../../modules/finanzas-personales/services/patrimonioPersonal.service");
const cuotas=require("../../modules/finanzas-personales/services/reversionCuotaCreditoPersonal.service");
const Prestamo=require("../../modules/finanzas-personales/models/prestamoPersonal.model"),Tx=require("../../modules/finanzas-personales/models/TransaccionPersonal");
const Cuenta=require("../../modules/finanzas-personales/models/cuentaFinanciera.model"),Outbox=require("../../modules/finanzas-personales/models/outboxPersonal.model");
const Evento=require("../../modules/finanzas-personales/models/EventoCompensatorioPersonal"),Cursor=require("../../modules/finanzas-personales/models/CursorCompensacionPersonal");
const {consultarCaja,consultarPeriodo}=require("../../modules/finanzas-personales/services/consultaCompensadaPersonal.service");
const {flujoPeriodo,republicarPendientes}=require("../../modules/finanzas-personales/services/flujoCajaPersonal.service");
const uri=process.env.GRUK_V81_TEST_MONGO_URI;
test("MongoDB real: reversión de créditos conserva capital, pago real, fuentes e idempotencia",{
 skip:!uri&&process.env.GRUK_REQUIRE_COMPENSACION_MONGO_TEST!=="1"?"Requiere replica set local aislado":false,timeout:60000
},async()=>{
 validarMongoPruebasV81(uri);await mongoose.connect(uri,{serverSelectionTimeoutMS:7000});
 const secreto=process.env.PERSONAL_IDEMPOTENCY_SECRET;process.env.PERSONAL_IDEMPOTENCY_SECRET=crypto.randomBytes(32).toString("hex");
 const usuarios=[],crearOutbox=Outbox.create;let server;
 const rango=usuarioId=>({usuarioId,desde:"0001-01-01T00:00:00.000Z",hasta:"9999-12-31T23:59:59.999Z"});
 async function fixture({modo="CUENTA",real=450,pagar=true}={}){
  const usuarioId=new mongoose.Types.ObjectId();usuarios.push(usuarioId);
  const fecha=new Date(Date.now()-3600000);
  const cuenta=await Cuenta.create({usuarioId,nombre:"Cuenta de prueba",tipo:"AHORROS",saldoMinor:10000,saldoAnclaMinor:10000,saldoAnclaEn:fecha,saldoVerificadoEn:fecha,origenSaldo:"USUARIO",requiereReconciliacion:false});
  const p=await Prestamo.create({usuarioId,direccion:"POR_PAGAR",contraparte:"Entidad",concepto:"Crédito de prueba",principalMinor:1000,saldoMinor:1000,cuotaMinor:400,numeroCuotas:3,periodicidad:"MENSUAL",periodicidadConfirmada:true,fechaInicio:fecha,fechaVencimiento:new Date(Date.now()+86400000)});
  const solicitud={prestamoId:p._id,cuentaId:modo==="CUENTA"?cuenta._id:null,numeroCuota:1,montoPagadoRealMinor:real,modo,externalId:crypto.randomUUID()};
  const pago=pagar?await patrimonio.pagarCuotaCredito(usuarioId,solicitud):null;
  return {usuarioId,cuenta,p,solicitud,pago,key:crypto.randomUUID()};
 }
 const revertir=(f,key=f.key,tx=f.pago.transaccion._id)=>cuotas.deshacer(f.usuarioId,f.p._id,{movimientoId:tx,idempotencyKey:key});
 async function estado(f){return {
  prestamo:await Prestamo.findById(f.p._id).lean(),cuenta:await Cuenta.findById(f.cuenta._id).lean(),
  fuentes:await Tx.find({usuarioId:f.usuarioId}).sort({_id:1}).lean(),eventos:await Evento.find({usuarioId:String(f.usuarioId)}).sort({secuencia:1}).lean(),
  outbox:await Outbox.find({usuarioId:f.usuarioId}).sort({_id:1}).lean(),cursor:await Cursor.findById(String(f.usuarioId)).lean()
 };}
 async function rechaza(f,operacion=()=>revertir(f)){
  const antes=await estado(f);await assert.rejects(operacion(),e=>[404,409].includes(e.statusCode));assert.deepEqual(await estado(f),antes);
 }
 try{
  await Promise.all([Prestamo.init(),Tx.init(),Cuenta.init(),Outbox.init(),Evento.init(),Cursor.init()]);
  const f=await fixture();
  const solicitudSegunda={...f.solicitud,numeroCuota:2,externalId:crypto.randomUUID()};
  const segundo=await patrimonio.pagarCuotaCredito(f.usuarioId,solicitudSegunda);
  const fuente=await Tx.findById(segundo.transaccion._id).lean();
  const recibo=await revertir(f,f.key,segundo.transaccion._id);
  assert.equal(recibo.compensacion.version,4);assert.equal(recibo.compensacion.original.montoMinor,400);
  assert.equal(recibo.compensacion.original.montoPagadoRealMinor,450);assert.equal(recibo.compensacion.deltaCajaMinor,"450");
  assert.equal((await Prestamo.findById(f.p._id)).saldoMinor,600);assert.equal((await Cuenta.findById(f.cuenta._id)).saldoMinor,9550);
  assert.deepEqual(await Tx.findById(segundo.transaccion._id).lean(),fuente);
  const detalle=await cuotas.obtenerPagosCredito(f.usuarioId,f.p._id);
  assert.equal(detalle.pagos.length,1);assert.equal(detalle.totalPagadoRealMinor,450);
  assert.equal((await flujoPeriodo(f.usuarioId,rango(f.usuarioId))).pagosDeudaMinor,450);
  assert.equal(patrimonio.saldoCuentasDesdeAnclas([await Cuenta.findById(f.cuenta._id).lean()],await consultarCaja(f.usuarioId)),9550);
  assert.equal((await revertir(f,f.key,segundo.transaccion._id)).duplicado,true);
  const cursorReplay=await Cursor.findById(String(f.usuarioId)).lean();
  await Cursor.collection.updateOne({_id:cursorReplay._id},{$set:{hashActual:"f".repeat(64)}});
  try{await rechaza(f,()=>revertir(f,f.key,segundo.transaccion._id));}finally{
   await Cursor.collection.replaceOne({_id:cursorReplay._id},cursorReplay);
  }
  await rechaza(f,()=>patrimonio.pagarCuotaCredito(f.usuarioId,solicitudSegunda));
  // La referencia original del primer pago activo sigue siendo idempotente.
  assert.equal((await patrimonio.pagarCuotaCredito(f.usuarioId,f.solicitud)).duplicado,true);
  const nuevo=await patrimonio.pagarCuotaCredito(f.usuarioId,{...f.solicitud,numeroCuota:2,externalId:crypto.randomUUID()});
  await revertir(f,f.key,segundo.transaccion._id);
  assert.equal((await Cuenta.findById(f.cuenta._id)).saldoMinor,9100);
  await rechaza(f,()=>revertir(f,crypto.randomUUID(),segundo.transaccion._id));
  await rechaza(f); // No puede deshacer la primera cuota mientras la segunda esté vigente.
  const cierre=await patrimonio.pagarCuotaCredito(f.usuarioId,{...f.solicitud,numeroCuota:3,montoPagadoRealMinor:250,externalId:crypto.randomUUID()});
  assert.equal((await Prestamo.findById(f.p._id)).estado,"PAGADO");
  await revertir(f,crypto.randomUUID(),cierre.transaccion._id);
  assert.equal((await Prestamo.findById(f.p._id)).saldoMinor,200);
  assert.equal((await Prestamo.findById(f.p._id)).periodicidadConfirmada,true);
  assert.equal((await Cuenta.findById(f.cuenta._id)).saldoMinor,9100);
  assert.equal((await consultarPeriodo(rango(f.usuarioId))).filter(x=>x.tipo==="PAGO_DEUDA").length,2);

  const h=await fixture({modo:"HISTORICO"});const historico=await revertir(h);
  assert.equal(historico.compensacion.deltaCajaMinor,"0");assert.equal((await Cuenta.findById(h.cuenta._id)).saldoMinor,10000);
  assert.equal((await Prestamo.findById(h.p._id)).saldoMinor,1000);
  const legado=await fixture({real:400});await Tx.collection.updateOne({_id:legado.pago.transaccion._id},{$set:{montoPagadoRealMinor:null}});
  await revertir(legado);assert.equal((await Cuenta.findById(legado.cuenta._id)).saldoMinor,10000);

  for(const corromper of [
   async x=>Tx.collection.updateOne({_id:x.pago.transaccion._id},{$set:{montoPagadoRealMinor:399}}),
   async x=>Tx.collection.updateOne({_id:x.pago.transaccion._id},{$set:{descripcion:"Cuota 2 confirmada"}}),
   async x=>Prestamo.updateOne({_id:x.p._id},{$set:{saldoMinor:700}}),
   async x=>Cuenta.updateOne({_id:x.cuenta._id},{$set:{saldoMinor:Number.MAX_SAFE_INTEGER-449}}),
   async x=>Tx.collection.updateOne({_id:x.pago.transaccion._id},{$unset:{impactoCaja:""}}),
   async x=>Cuenta.collection.updateOne({_id:x.cuenta._id},{$set:{moneda:"USD"}})
  ]){const x=await fixture();await corromper(x);await rechaza(x);}
  const ajeno=await fixture();
  await rechaza(ajeno,()=>cuotas.deshacer(f.usuarioId,ajeno.p._id,{movimientoId:ajeno.pago.transaccion._id,idempotencyKey:crypto.randomUUID()}));

  const carrera=await fixture();const resultados=await Promise.allSettled([revertir(carrera,"carrera_a"),revertir(carrera,"carrera_b")]);
  assert.equal(resultados.filter(x=>x.status==="fulfilled").length,1);
  assert.equal(await Evento.countDocuments({usuarioId:String(carrera.usuarioId)}),1);
  assert.equal((await Cuenta.findById(carrera.cuenta._id)).saldoMinor,10000);
  const fallo=await fixture(),antes=await estado(fallo);
  Outbox.create=async()=>{throw Error("Fallo simulado de auditoría");};
  try{await assert.rejects(revertir(fallo),/Fallo simulado/);}finally{Outbox.create=crearOutbox;}
  assert.deepEqual(await estado(fallo),antes);

  const http=await fixture(),app=express(),router=require("../../modules/finanzas-personales/routes");
  app.use(express.json());app.use((req,res,next)=>{req.personalAuth={userId:String(http.usuarioId)};next();});
  for(const [metodo,path] of [["post","/prestamos/:id/cuotas/deshacer"],["get","/prestamos/:id/cuotas"]]){
   const layer=router.stack.find(x=>x.route?.path===path);app[metodo](path,...layer.route.stack.map(x=>x.handle));
  }
  server=app.listen(0,"127.0.0.1");await new Promise(resolve=>server.once("listening",resolve));
  const url=`http://127.0.0.1:${server.address().port}/prestamos/${http.p._id}/cuotas`;
  const request=()=>fetch(url+"/deshacer",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":http.key},body:JSON.stringify({movimientoId:String(http.pago.transaccion._id),usuarioId:String(f.usuarioId),montoPagadoRealMinor:1})});
  assert.equal((await request()).status,200);assert.equal((await (await request()).json()).resultado.duplicado,true);
  const vista=await fetch(url);assert.equal(vista.status,200);const body=await vista.json();
  assert.equal(body.cuotasPagadas.length,0);assert.equal(body.proximaCuota,1);assert.equal(body.saldoPendienteMinor,1000);
  await republicarPendientes(500);assert.equal(await Outbox.countDocuments({usuarioId:{$in:usuarios},estado:{$ne:"PUBLICADO"}}),0);
 }finally{
  Outbox.create=crearOutbox;if(server)await new Promise(resolve=>server.close(resolve));
  for(const Modelo of [Prestamo,Tx,Cuenta,Outbox])await Modelo.collection.deleteMany({usuarioId:{$in:usuarios}});
  await Evento.collection.deleteMany({usuarioId:{$in:usuarios.map(String)}});await Cursor.deleteMany({_id:{$in:usuarios.map(String)}});
  await mongoose.disconnect();if(secreto===undefined)delete process.env.PERSONAL_IDEMPOTENCY_SECRET;else process.env.PERSONAL_IDEMPOTENCY_SECRET=secreto;
 }
});
