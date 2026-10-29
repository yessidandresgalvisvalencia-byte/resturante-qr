"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const mongoose=require("mongoose"),express=require("express");
const {validarMongoPruebasV81}=require("../../scripts/exigir-mongo-v81-pruebas");
const service=require("../../modules/finanzas-personales/services/reclasificarTrabajoCompensadoPersonal.service");
const Prestamo=require("../../modules/finanzas-personales/models/prestamoPersonal.model");
const Tx=require("../../modules/finanzas-personales/models/TransaccionPersonal");
const Cuenta=require("../../modules/finanzas-personales/models/cuentaFinanciera.model");
const Outbox=require("../../modules/finanzas-personales/models/outboxPersonal.model");
const Evento=require("../../modules/finanzas-personales/models/EventoCompensatorioPersonal");
const Cursor=require("../../modules/finanzas-personales/models/CursorCompensacionPersonal");
const {consultarPeriodo,consultarCaja}=require("../../modules/finanzas-personales/services/consultaCompensadaPersonal.service");
const {saldoCuentasDesdeAnclas,corregirPrestamo}=require("../../modules/finanzas-personales/services/patrimonioPersonal.service");
const {republicarPendientes}=require("../../modules/finanzas-personales/services/flujoCajaPersonal.service");
const uri=process.env.GRUK_V81_TEST_MONGO_URI;
test("MongoDB real: reparar cobros de trabajo conserva fuentes y caja, con reintentos y rollback",{
 skip:!uri&&process.env.GRUK_REQUIRE_COMPENSACION_MONGO_TEST!=="1"?"Requiere replica set local aislado":false,timeout:60000
},async()=>{
 validarMongoPruebasV81(uri);
 await mongoose.connect(uri,{serverSelectionTimeoutMS:7000});
 const usuarios=[],outboxCreate=Outbox.create;
 let server;
 async function fixture({usuarioId=new mongoose.Types.ObjectId(),origen="PRESTAMO",saldo=400,cobros=[400,200],historico=false}={}){
  if(!usuarios.some(u=>String(u)===String(usuarioId)))usuarios.push(usuarioId);
  const cuenta=await Cuenta.create({usuarioId,nombre:crypto.randomUUID(),tipo:"AHORROS",saldoMinor:10000});
  const fecha=new Date(Date.now()-60000);
  const p=await Prestamo.create({usuarioId,direccion:"POR_COBRAR",origenCuentaPorCobrar:origen,concepto:"Trabajo de prueba",contraparte:"Cliente",principalMinor:1000,saldoMinor:saldo,fechaInicio:fecha,estado:saldo?"ACTIVO":"PAGADO"});
  const fuentes=await Tx.create(cobros.map((m,i)=>({usuarioId,prestamoId:p._id,tipo:"COBRO_PRESTAMO",montoMinor:m,concepto:"Cobro "+(i+1),categoria:"Cuentas por cobrar",cuentaId:historico?null:cuenta._id,cuenta:historico?"HISTORICO":cuenta.nombre,impactoCaja:!historico,medioPago:historico?"OTRO":"TRANSFERENCIA",fecha})));
  return {usuarioId,cuenta,p,fuentes};
 }
 async function estado(f){return {
  fuentes:await Tx.find({usuarioId:f.usuarioId}).sort({_id:1}).lean(),
  cuentas:await Cuenta.find({usuarioId:f.usuarioId}).sort({_id:1}).lean(),
  prestamos:await Prestamo.find({usuarioId:f.usuarioId}).sort({_id:1}).lean(),
  eventos:await Evento.find({usuarioId:String(f.usuarioId)}).sort({secuencia:1}).lean(),
  outbox:await Outbox.find({usuarioId:f.usuarioId}).sort({_id:1}).lean(),
  cursor:await Cursor.findById(String(f.usuarioId)).lean()
 };}
 const corregir=f=>service.corregirOrigenTrabajo(f.usuarioId,f.p._id);
 const periodo=usuarioId=>({usuarioId,desde:"0001-01-01T00:00:00.000Z",hasta:"9999-12-31T23:59:59.999Z"});
 try{
  await Promise.all([Prestamo.init(),Tx.init(),Cuenta.init(),Outbox.init(),Evento.init(),Cursor.init()]);
  const f=await fixture();const antes=await estado(f);
  const r=await corregir(f);
  assert.equal(r.reclasificados,2);assert.equal(r.ingresoTrabajoMinor,600);assert.equal(r.saldoPendienteMinor,400);
  const despues=await estado(f);
  assert.deepEqual(despues.fuentes,antes.fuentes);assert.deepEqual(despues.cuentas,antes.cuentas);
  assert.equal(despues.prestamos[0].principalMinor,1000);assert.equal(despues.prestamos[0].saldoMinor,400);
  assert.equal(despues.prestamos[0].origenCuentaPorCobrar,"TRABAJO");
  assert.equal(despues.eventos.length,2);assert.equal(despues.outbox.length,2);
  assert.ok(despues.eventos.every(e=>e.version===3&&e.deltaCajaMinor==="0"));
  assert.ok((await consultarPeriodo(periodo(f.usuarioId))).every(m=>m.tipo==="INGRESO"&&m.categoria==="Trabajo cobrado"));
  const caja=await consultarCaja(f.usuarioId);
  assert.equal(caja.length,2);assert.ok(caja.every(m=>m.tipo==="COBRO_PRESTAMO"));
  assert.equal(saldoCuentasDesdeAnclas([{_id:f.cuenta._id,saldoAnclaMinor:9400,saldoAnclaEn:new Date(+f.fuentes[0].fecha-1)}],caja),10000);
  assert.equal((await corregir(f)).reclasificados,0);
  assert.equal(await Evento.countDocuments({usuarioId:String(f.usuarioId)}),2);
  assert.equal(await Outbox.countDocuments({usuarioId:f.usuarioId}),2);
  assert.deepEqual((await estado(f)).fuentes,antes.fuentes);
  // Editar el origen en ambos sentidos debe usar el estado vigente, no reescribir el cobro.
  await corregirPrestamo(f.usuarioId,f.p._id,{origenCuentaPorCobrar:"PRESTAMO"});
  assert.ok((await consultarPeriodo(periodo(f.usuarioId))).every(m=>m.tipo==="COBRO_PRESTAMO"));
  await corregirPrestamo(f.usuarioId,f.p._id,{origenCuentaPorCobrar:"TRABAJO"});
  assert.ok((await consultarPeriodo(periodo(f.usuarioId))).every(m=>m.tipo==="INGRESO"));
  assert.equal(await Evento.countDocuments({usuarioId:String(f.usuarioId)}),6);
  assert.deepEqual((await estado(f)).fuentes,antes.fuentes);
  assert.deepEqual((await estado(f)).cuentas,antes.cuentas);
  assert.equal(saldoCuentasDesdeAnclas([{_id:f.cuenta._id,saldoAnclaMinor:9400,saldoAnclaEn:new Date(+f.fuentes[0].fecha-1)}],await consultarCaja(f.usuarioId)),10000);

  const h=await fixture({historico:true});
  await corregir(h);assert.equal((await Cuenta.findById(h.cuenta._id)).saldoMinor,10000);
  assert.equal((await consultarCaja(h.usuarioId)).length,2);

  const ajeno=new mongoose.Types.ObjectId();usuarios.push(ajeno);
  await assert.rejects(service.corregirOrigenTrabajo(ajeno,f.p._id),e=>e.statusCode===404);
  assert.equal(await Evento.countDocuments({usuarioId:String(ajeno)}),0);

  // La reparación automática no infiere que un préstamo sea trabajo por el concepto.
  const noConfirmado=await fixture({saldo:0,cobros:[1000]});
  const no=await service.reconciliarIngresosTrabajo(noConfirmado.usuarioId);
  assert.equal(no.corregidos,0);assert.equal(no.requierenRevisionManual,1);
  assert.equal((await Tx.findById(noConfirmado.fuentes[0]._id)).tipo,"COBRO_PRESTAMO");

  // Un lote puede reparar cuentas verificadas y señalar otras desincronizadas.
  const bien=await fixture({origen:"TRABAJO",saldo:0,cobros:[1000]});
  const mal=await fixture({usuarioId:bien.usuarioId,origen:"TRABAJO",saldo:0,cobros:[999]});
  const malOriginal=await Tx.findById(mal.fuentes[0]._id).lean();
  const lote=await service.reconciliarIngresosTrabajo(bien.usuarioId);
  assert.equal(lote.corregidos,1);assert.equal(lote.requierenRevisionManual,1);
  assert.deepEqual(await Tx.findById(mal.fuentes[0]._id).lean(),malOriginal);
  assert.equal(await Evento.countDocuments({usuarioId:String(bien.usuarioId)}),1);
  assert.equal((await service.reconciliarIngresosTrabajo(bien.usuarioId)).corregidos,0);

  for(const corromper of [
   async x=>Prestamo.updateOne({_id:x.p._id},{$set:{saldoMinor:2000}}),
   async x=>Prestamo.updateOne({_id:x.p._id},{$set:{estado:"CANCELADO"}}),
   async x=>Tx.collection.updateOne({_id:x.fuentes[0]._id},{$set:{montoMinor:401}}),
   async x=>Tx.collection.updateOne({_id:x.fuentes[0]._id},{$set:{recurrente:true}}),
   async x=>Tx.collection.updateOne({_id:x.fuentes[0]._id},{$unset:{impactoCaja:""}})
  ]){
   const x=await fixture();await corromper(x);const previo=await estado(x);
   await assert.rejects(corregir(x),e=>e.statusCode===409);
   assert.deepEqual(await estado(x),previo);
  }

  const carrera=await fixture({origen:"TRABAJO",saldo:0,cobros:[1000]});
  const simultaneos=await Promise.allSettled([corregir(carrera),corregir(carrera)]);
  assert.ok(simultaneos.some(x=>x.status==="fulfilled"));
  assert.equal(await Evento.countDocuments({usuarioId:String(carrera.usuarioId)}),1);
  assert.equal(await Outbox.countDocuments({usuarioId:carrera.usuarioId}),1);
  assert.equal((await Cuenta.findById(carrera.cuenta._id)).saldoMinor,10000);

  const rollback=await fixture();const previo=await estado(rollback);let llamadas=0;
  Outbox.create=async function(...args){if(++llamadas===2)throw Error("Auditoría interrumpida");return outboxCreate.apply(this,args);};
  try{await assert.rejects(corregir(rollback),/Auditoría interrumpida/);}finally{Outbox.create=outboxCreate;}
  assert.deepEqual(await estado(rollback),previo);
  const falloEdicion=await fixture();const antesEdicion=await estado(falloEdicion);
  Outbox.create=async function(docs,...rest){
   if(docs[0].eventName==="PRESTAMO_PERSONAL_CORREGIDO")throw Error("Auditoría del préstamo interrumpida");
   return outboxCreate.call(this,docs,...rest);
  };
  try{await assert.rejects(corregirPrestamo(falloEdicion.usuarioId,falloEdicion.p._id,{origenCuentaPorCobrar:"TRABAJO"}),/Auditoría del préstamo interrumpida/);}
  finally{Outbox.create=outboxCreate;}
  assert.deepEqual(await estado(falloEdicion),antesEdicion);

  // Usar los handlers realmente registrados, con identidad fija solo en el servidor de prueba.
  const router=require("../../modules/finanzas-personales/routes");
  const app=express();app.use(express.json());
  const http=await fixture();
  app.use((req,res,next)=>{req.personalAuth={userId:String(http.usuarioId)};next();});
  for(const path of ["/cuentas-por-cobrar/:id/corregir-origen-trabajo","/reconciliar-ingresos-trabajo"]){
   const layer=router.stack.find(x=>x.route?.path===path);
   app.post(path,...layer.route.stack.map(x=>x.handle));
  }
  for(const path of ["/rastrear-cobro","/diagnostico-cobro-importe","/diagnostico-cobro-trabajo","/diagnostico-cobros"]){
   const layer=router.stack.find(x=>x.route?.path===path);
   app.get(path,...layer.route.stack.map(x=>x.handle));
  }
  server=app.listen(0,"127.0.0.1");await new Promise(resolve=>server.once("listening",resolve));
  const response=await fetch(`http://127.0.0.1:${server.address().port}/cuentas-por-cobrar/${http.p._id}/corregir-origen-trabajo`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({usuarioId:String(ajeno),montoMinor:1})});
  assert.equal(response.status,200);assert.equal((await response.json()).reclasificados,2);
  const bulk=await fetch(`http://127.0.0.1:${server.address().port}/reconciliar-ingresos-trabajo`,{method:"POST"});
  assert.equal(bulk.status,200);assert.equal((await bulk.json()).corregidos,0);
  for(const path of ["/rastrear-cobro?montoMinor=400","/diagnostico-cobro-importe?montoMinor=400"]){
   const consulta=await fetch(`http://127.0.0.1:${server.address().port}${path}`);
   assert.equal(consulta.status,200);
   const datos=await consulta.json();assert.equal(datos.movimientos.length,1);
   assert.equal(datos.movimientos[0].tipo,"INGRESO");
  }
  const diagnostico=await fetch(`http://127.0.0.1:${server.address().port}/diagnostico-cobro-trabajo?nombre=Cliente&montoMinor=1000`);
  assert.equal(diagnostico.status,200);
  const caso=(await diagnostico.json()).casos[0];assert.equal(caso.ingresoRegistradoMinor,600);
  assert.ok(caso.movimientos.every(m=>m.tipo==="INGRESO"));
  const cobros=await fetch(`http://127.0.0.1:${server.address().port}/diagnostico-cobros`);
  assert.equal(cobros.status,200);assert.ok((await cobros.json()).cobros[0].movimientos.every(m=>m.tipo==="INGRESO"));
  await republicarPendientes(500);
  assert.equal(await Outbox.countDocuments({usuarioId:{$in:usuarios},estado:{$ne:"PUBLICADO"}}),0);
 }finally{
  Outbox.create=outboxCreate;
  if(server)await new Promise(resolve=>server.close(resolve));
  for(const Modelo of [Prestamo,Tx,Cuenta,Outbox])await Modelo.deleteMany({usuarioId:{$in:usuarios}});
  await Evento.collection.deleteMany({usuarioId:{$in:usuarios.map(String)}});
  await Cursor.deleteMany({_id:{$in:usuarios.map(String)}});
  await mongoose.disconnect();
 }
});
