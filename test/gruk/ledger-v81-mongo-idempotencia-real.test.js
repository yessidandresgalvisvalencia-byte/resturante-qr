"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Evento=require("../../modules/finanzas-personales/models/eventoV81.model");
const Cabeza=require("../../modules/finanzas-personales/models/cabezaV81.model");
const {anexarEventoV81}=require("../../modules/finanzas-personales/services/persistenciaLedgerV81.service");
const {verificarCadena}=require("../../modules/finanzas-personales/services/cadenaEventosV81.service");

const uri=process.env.GRUK_V81_TEST_MONGO_URI;
const {validarMongoPruebasV81}=require("../../scripts/exigir-mongo-v81-pruebas");
let seguro=false;
try{seguro=validarMongoPruebasV81(uri);}catch(_){seguro=false;}
const base={id:"v81_reintento_igual",tipo:"GASTO",montoCentavos:2500030n,fechaContable:"2026-01-01",timestamp:"2026-01-01T10:00:00-05:00"};

test("MongoDB real: reintento concurrente idempotente e aislamiento entre usuarios",{
 skip:seguro?false:"Requiere MongoDB replica set local (loopback), base gruk_v81_test_*, sin credenciales, NODE_ENV no productivo",
 timeout:60000
},async()=>{
 const a=new mongoose.Types.ObjectId(),b=new mongoose.Types.ObjectId(),c=new mongoose.Types.ObjectId(),d=new mongoose.Types.ObjectId();
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

  // Dos IDs distintos compiten por la misma cabeza; ambos deben poder recuperarse
  // mediante el ID original sin perder un evento ni repetirlo.
  const entradas=[
   {...base,id:"v81_concurrente_uno"},
   {...base,id:"v81_concurrente_dos",montoCentavos:9900n}
  ];
  const carrera=await Promise.allSettled(entradas.map(datos=>anexarEventoV81(d,datos)));
  assert.ok(carrera.some(r=>r.status==="fulfilled"));
  for(const resultado of carrera){
   if(resultado.status==="rejected"){
    assert.equal(resultado.reason.statusCode,409);
    assert.equal(resultado.reason.codigo,"REINTENTAR_MISMO_ID");
   }
  }
  // El resultado de la carrera no implica que un fallo sea definitivo:
  // repetir con la misma clave resuelve tanto escrituras confirmadas como abortadas.
  for(const datos of entradas){
   const resuelto=await anexarEventoV81(d,datos);
   assert.equal(resuelto.id,datos.id);
  }
  const eventosD=await Evento.find({usuarioId:d}).sort({version:1}).lean();
  const cabezaD=await Cabeza.findOne({usuarioId:d}).lean();
  assert.equal(eventosD.length,2);
  assert.equal(cabezaD.version,2);
  assert.equal(new Set(eventosD.map(e=>e.eventId)).size,2);
  assert.equal(eventosD.reduce((s,e)=>s+BigInt(e.montoCentavos),0n),2509930n);
  // Un replay del primer evento despues del segundo no debe recalcularlo
  // usando la cabeza actual, ni crear version 3, ni cambiar su hash original.
  const hashInicial=eventosD.find(e=>e.eventId===entradas[0].id).hashActual;
  const versionInicial=eventosD.find(e=>e.eventId===entradas[0].id).version;
  const replayTrasOtro=await anexarEventoV81(d,entradas[0]);
  assert.equal(replayTrasOtro.hashActual,hashInicial);
  assert.equal(replayTrasOtro.version,versionInicial);
  assert.equal(await Evento.countDocuments({usuarioId:d}),2);
  assert.equal((await Cabeza.findOne({usuarioId:d}).lean()).hashActual,cabezaD.hashActual);
  await assert.rejects(
   ()=>anexarEventoV81(d,{...entradas[0],montoCentavos:2500031n}),
   error=>error.statusCode===409 && error.codigo!=="REINTENTAR_MISMO_ID"
  );
  assert.equal(await Evento.countDocuments({usuarioId:d}),2);
  assert.equal((await Cabeza.findOne({usuarioId:d}).lean()).hashActual,cabezaD.hashActual);

  assert.equal(verificarCadena(eventosD.map(e=>({
   id:e.eventId,userId:String(e.usuarioId),version:e.version,tipo:e.tipo,
   montoCentavos:BigInt(e.montoCentavos),fechaContable:e.fechaContable,
   timestamp:e.timestamp,corrigeId:e.corrigeId,motivo:e.motivo,
   tipoCorregido:e.tipoCorregido,hashAnterior:e.hashAnterior,hashActual:e.hashActual
  })),cabezaD.hashActual),true);

  // Simulación exclusivamente local de manipulación directa, fuera de Mongoose.
  // Un atacante que altere un monto almacenado no debe poder anexar otro evento.
  await Evento.collection.updateOne({_id:primero._id},{$set:{montoCentavos:"2500031"}});
  await assert.rejects(
   ()=>anexarEventoV81(a,{...base,id:"v81_despues_de_tamper"}),
   error=>error.statusCode===409 && /integridad/i.test(error.message)
  );
  assert.equal(await Evento.countDocuments({usuarioId:a}),1);
  assert.equal((await Cabeza.findOne({usuarioId:a}).lean()).hashActual,cabeza.hashActual);

  // Borrado simulado del segundo de tres eventos. La cabeza conserva el hash final.
  for(const [i,id] of ["v81_primero","v81_intermedio","v81_tercero"].entries()){
   const agregado=await anexarEventoV81(c,{...base,id});
   assert.equal(agregado.version,i+1);
  }
  const cabezaAntes=await Cabeza.findOne({usuarioId:c}).lean();
  const terceroAntes=await Evento.findOne({usuarioId:c,version:3}).lean();
  assert.equal(cabezaAntes.hashActual,terceroAntes.hashActual);
  const borrado=await Evento.collection.deleteOne({usuarioId:c,version:2});
  assert.equal(borrado.deletedCount,1);
  assert.equal(await Evento.countDocuments({usuarioId:c}),2);
  assert.equal((await Cabeza.findOne({usuarioId:c}).lean()).hashActual,cabezaAntes.hashActual);
  await assert.rejects(
   ()=>anexarEventoV81(c,{...base,id:"v81_despues_de_borrado"}),
   error=>error.statusCode===409 && /integridad/i.test(error.message)
  );
  assert.equal(await Evento.countDocuments({usuarioId:c}),2);
  assert.equal((await Cabeza.findOne({usuarioId:c}).lean()).version,3);
  assert.equal((await Cabeza.findOne({usuarioId:c}).lean()).hashActual,cabezaAntes.hashActual);
 }finally{
  // Limpieza exclusiva de los cuatro ObjectIds generados para esta prueba.
  await Evento.collection.deleteMany({usuarioId:{$in:[a,b,c,d]}});
  await Cabeza.collection.deleteMany({usuarioId:{$in:[a,b,c,d]}});
  await mongoose.disconnect();
 }
});

test("MongoDB real: transferencia propia simultánea aplica un solo débito y un solo outbox",{
 skip:seguro?false:"Requiere MongoDB aislado y validado en loopback",timeout:60000
},async()=>{
 const crypto=require("node:crypto");
 const Cuenta=require("../../modules/finanzas-personales/models/cuentaFinanciera.model");
 const Outbox=require("../../modules/finanzas-personales/models/outboxPersonal.model");
 const {transferir}=require("../../modules/finanzas-personales/services/patrimonioPersonal.service");
 const usuarioId=new mongoose.Types.ObjectId();
 const secretAnterior=process.env.PERSONAL_IDEMPOTENCY_SECRET;
 process.env.PERSONAL_IDEMPOTENCY_SECRET="gruk-v81-prueba-local-transferencia-no-produccion";
 await mongoose.connect(uri,{serverSelectionTimeoutMS:7000});
 try{
  await Promise.all([Cuenta.init(),Outbox.init()]);
  const [origen,destino]=await Cuenta.create([
   {usuarioId,nombre:"ORIGEN-"+crypto.randomUUID(),tipo:"AHORROS",moneda:"COP",activa:true,saldoMinor:100000,
    saldoAnclaMinor:100000,saldoAnclaEn:new Date("2026-10-01T00:00:00Z"),saldoVerificadoEn:new Date("2026-10-01T00:00:00Z"),requiereReconciliacion:false},
   {usuarioId,nombre:"DESTINO-"+crypto.randomUUID(),tipo:"AHORROS",moneda:"COP",activa:true,saldoMinor:20000,
    saldoAnclaMinor:20000,saldoAnclaEn:new Date("2026-10-01T00:00:00Z"),saldoVerificadoEn:new Date("2026-10-01T00:00:00Z"),requiereReconciliacion:false}
  ]);
  const args={origenId:origen._id,destinoId:destino._id,montoMinor:30000,externalId:crypto.randomUUID()};
  const simultaneas=await Promise.allSettled([transferir(usuarioId,args),transferir(usuarioId,args)]);
  assert.ok(simultaneas.some(x=>x.status==="fulfilled"),"al menos un envío confirma");
  const repetido=await transferir(usuarioId,args);
  assert.equal(repetido.duplicado,true);
  const [o,d]=await Promise.all([Cuenta.findById(origen._id).lean(),Cuenta.findById(destino._id).lean()]);
  assert.equal(o.saldoMinor,70000);
  assert.equal(d.saldoMinor,50000);
  assert.equal(o.requiereReconciliacion,true);
  assert.equal(d.requiereReconciliacion,true);
  const eventos=await Outbox.find({usuarioId,aggregateType:"TRANSFERENCIA_PROPIA"}).lean();
  assert.equal(eventos.length,1);
  assert.equal(eventos[0].payload.montoMinor,30000);
  await assert.rejects(()=>transferir(usuarioId,{...args,montoMinor:30001}),e=>e.statusCode===409);
  assert.equal(await Outbox.countDocuments({usuarioId,aggregateType:"TRANSFERENCIA_PROPIA"}),1);
  assert.equal((await Cuenta.findById(origen._id)).saldoMinor,70000);
  // Un usuario ajeno no puede operar las cuentas de otro, aunque conozca sus IDs.
  const ajeno=new mongoose.Types.ObjectId();
  await assert.rejects(()=>transferir(ajeno,{...args,externalId:crypto.randomUUID()}),
   e=>e.statusCode===409);
  assert.equal(await Outbox.countDocuments({usuarioId:ajeno,aggregateType:"TRANSFERENCIA_PROPIA"}),0);
  assert.equal((await Cuenta.findById(origen._id)).saldoMinor,70000);
  assert.equal((await Cuenta.findById(destino._id)).saldoMinor,50000);
  // Una operación posterior con UUID distinto sí debe aplicarse exactamente una vez.
  const segunda={...args,montoMinor:5000,externalId:crypto.randomUUID()};
  const nueva=await transferir(usuarioId,segunda);
  assert.equal(nueva.duplicado,false);
  assert.equal((await transferir(usuarioId,segunda)).duplicado,true);
  const [origenFinal,destinoFinal]=await Promise.all([
   Cuenta.findById(origen._id).lean(),Cuenta.findById(destino._id).lean()]);
  assert.equal(origenFinal.saldoMinor,65000);
  assert.equal(destinoFinal.saldoMinor,55000);
  assert.equal(origenFinal.saldoMinor+destinoFinal.saldoMinor,120000,"la transferencia conserva el total");
  assert.equal(await Outbox.countDocuments({usuarioId,aggregateType:"TRANSFERENCIA_PROPIA"}),2);
  // Una ancla fechada antes de las transferencias no puede marcarse como verificada.
  const patrimonio=require("../../modules/finanzas-personales/services/patrimonioPersonal.service");
  await assert.rejects(()=>patrimonio.reconciliarCuenta(usuarioId,{cuentaId:origen._id,saldoMinor:65000,fecha:new Date("2026-10-01T00:00:00Z")}),e=>e.statusCode===409);
  await assert.rejects(()=>patrimonio.reconciliarCuenta(usuarioId,{cuentaId:destino._id,saldoMinor:55000,fecha:new Date("2026-10-01T00:00:00Z")}),e=>e.statusCode===409);
  assert.equal((await Cuenta.findById(origen._id)).requiereReconciliacion,true);
  assert.equal((await Cuenta.findById(destino._id)).requiereReconciliacion,true);
  assert.equal(await Outbox.countDocuments({usuarioId,eventName:"SALDO_CUENTA_RECONCILIADO"}),0);
  await assert.rejects(()=>patrimonio.reconciliarCuenta(usuarioId,{cuentaId:String(origen._id).toUpperCase(),saldoMinor:65000,fecha:new Date("2026-10-01T00:00:00Z")}),e=>e.statusCode===409);
  await assert.rejects(()=>patrimonio.reconciliarCuenta(usuarioId,{cuentaId:String(destino._id).toUpperCase(),saldoMinor:55000,fecha:new Date("2026-10-01T00:00:00Z")}),e=>e.statusCode===409);
  assert.equal(await Outbox.countDocuments({usuarioId,eventName:"SALDO_CUENTA_RECONCILIADO"}),0);
  // Completar la conciliación después de las transferencias no debe volver a sumar el dinero.
  await patrimonio.reconciliarCuenta(usuarioId,{cuentaId:origen._id,saldoMinor:65000,fecha:new Date()});
  await patrimonio.reconciliarCuenta(usuarioId,{cuentaId:destino._id,saldoMinor:55000,fecha:new Date()});
  const confirmado=await patrimonio.snapshot(usuarioId);
  assert.equal(confirmado.saldoVerificado,true);
  assert.equal(confirmado.anclaCompleta,true);
  assert.equal(confirmado.liquidezMinor,120000,"la transferencia no crea ni pierde dinero al reconciliar");
  assert.equal(confirmado.fuenteLiquidez,"ANCLA_RECONCILIADA");
  assert.equal(await Outbox.countDocuments({usuarioId,aggregateType:"TRANSFERENCIA_PROPIA"}),2);
  assert.equal(await Outbox.countDocuments({usuarioId,eventName:"SALDO_CUENTA_RECONCILIADO"}),2);
  // Nunca retroceder una ancla verificada: preserva saldo, fecha y auditoría.
  const cuentaVerificada=await Cuenta.findById(origen._id).lean();
  await assert.rejects(()=>patrimonio.reconciliarCuenta(usuarioId,{cuentaId:origen._id,saldoMinor:1,fecha:cuentaVerificada.saldoAnclaEn}),e=>e.statusCode===409);
  await assert.rejects(()=>patrimonio.reconciliarCuenta(usuarioId,{
   cuentaId:origen._id,saldoMinor:1,fecha:new Date("2026-10-01T00:00:00Z")
  }),e=>e.statusCode===409);
  const cuentaTrasRechazo=await Cuenta.findById(origen._id).lean();
  assert.equal(cuentaTrasRechazo.saldoMinor,cuentaVerificada.saldoMinor);
  assert.equal(cuentaTrasRechazo.saldoAnclaMinor,cuentaVerificada.saldoAnclaMinor);
  assert.equal(cuentaTrasRechazo.saldoAnclaEn.getTime(),cuentaVerificada.saldoAnclaEn.getTime());
  assert.equal(await Outbox.countDocuments({usuarioId,eventName:"SALDO_CUENTA_RECONCILIADO"}),2);
  // Un movimiento de caja posterior a la fecha declarada impide certificar un saldo antiguo.
  const Transaccion=require("../../modules/finanzas-personales/models/TransaccionPersonal");
  const cuentaConMovimiento=await Cuenta.create({usuarioId,nombre:"MOVIMIENTO-"+crypto.randomUUID(),
   tipo:"AHORROS",moneda:"COP",saldoMinor:10000,requiereReconciliacion:true});
  const fechaMovimiento=new Date(Date.now()-5000);
  await Transaccion.create({usuarioId,cuentaId:cuentaConMovimiento._id,tipo:"GASTO",
   montoMinor:1000,concepto:"Compra de prueba",categoria:"Pruebas",cuenta:cuentaConMovimiento.nombre,
   fecha:fechaMovimiento,estado:"ACTIVA",medioPago:"DEBITO"});
  const auditoriaAnterior=await Outbox.countDocuments({usuarioId,eventName:"SALDO_CUENTA_RECONCILIADO"});
  await assert.rejects(()=>patrimonio.reconciliarCuenta(usuarioId,{
   cuentaId:cuentaConMovimiento._id,saldoMinor:10000,
   fecha:new Date(fechaMovimiento.getTime()-1000)}),e=>e.statusCode===409);
  await assert.rejects(()=>patrimonio.reconciliarCuenta(usuarioId,{
   cuentaId:cuentaConMovimiento._id,saldoMinor:10000,
   fecha:fechaMovimiento}),e=>e.statusCode===409);
  assert.equal((await Cuenta.findById(cuentaConMovimiento._id)).requiereReconciliacion,true);
  assert.equal((await Cuenta.findById(cuentaConMovimiento._id)).saldoMinor,10000);
  assert.equal(await Outbox.countDocuments({usuarioId,eventName:"SALDO_CUENTA_RECONCILIADO"}),auditoriaAnterior);
  // Una fecha efectivamente posterior al movimiento sí puede conciliarse.
  await patrimonio.reconciliarCuenta(usuarioId,{cuentaId:cuentaConMovimiento._id,
   saldoMinor:10000,fecha:new Date(fechaMovimiento.getTime()+1000)});
  assert.equal((await Cuenta.findById(cuentaConMovimiento._id)).requiereReconciliacion,false);
  // Dos verificaciones simultáneas con el mismo instante no pueden certificar dos importes.
  const cuentaConcurrente=await Cuenta.create({usuarioId,nombre:"CONCURRENCIA-"+crypto.randomUUID(),
   tipo:"AHORROS",moneda:"COP",saldoMinor:30000,requiereReconciliacion:true});
  const fechaConcurrente=new Date(Date.now()-1000);
  const intentosConcurrentes=await Promise.allSettled([
   patrimonio.reconciliarCuenta(usuarioId,{cuentaId:cuentaConcurrente._id,saldoMinor:31000,fecha:fechaConcurrente}),
   patrimonio.reconciliarCuenta(usuarioId,{cuentaId:cuentaConcurrente._id,saldoMinor:32000,fecha:fechaConcurrente})
  ]);
  const confirmados=intentosConcurrentes.filter(x=>x.status==="fulfilled");
  assert.equal(confirmados.length,1,"una única conciliación debe ser aceptada");
  const balanceGanador=confirmados[0].value.saldoMinor;
  assert.ok(balanceGanador===31000||balanceGanador===32000);
  const cuentaTrasCarrera=await Cuenta.findById(cuentaConcurrente._id).lean();
  assert.equal(cuentaTrasCarrera.saldoMinor,balanceGanador);
  assert.equal(cuentaTrasCarrera.saldoAnclaMinor,balanceGanador);
  assert.equal(cuentaTrasCarrera.saldoAnclaEn.getTime(),fechaConcurrente.getTime());
  const eventosConcurrentes=await Outbox.find({usuarioId,eventName:"SALDO_CUENTA_RECONCILIADO",
   aggregateId:cuentaConcurrente._id}).lean();
  assert.equal(eventosConcurrentes.length,1,"no pueden existir dos certificaciones contables simultáneas");
  // Carrera entre transferencia y conciliación: nunca se declara verificado un saldo
  // cuya cuenta ya recibió una transferencia posterior a la fecha verificada.
  const [origenCarrera,destinoCarrera]=await Cuenta.create([
   {usuarioId,nombre:"CARRERA-ORIGEN-"+crypto.randomUUID(),tipo:"AHORROS",
    moneda:"COP",saldoMinor:50000,requiereReconciliacion:true},
   {usuarioId,nombre:"CARRERA-DESTINO-"+crypto.randomUUID(),tipo:"AHORROS",
    moneda:"COP",saldoMinor:5000,requiereReconciliacion:true}
  ]);
  const fechaVerificacionCarrera=new Date(Date.now()-3000);
  const transferirCarrera={origenId:origenCarrera._id,destinoId:destinoCarrera._id,
   montoMinor:10000,externalId:crypto.randomUUID()};
  const carrera=await Promise.allSettled([
   transferir(usuarioId,transferirCarrera),
   patrimonio.reconciliarCuenta(usuarioId,{cuentaId:origenCarrera._id,
    saldoMinor:50000,fecha:fechaVerificacionCarrera})
  ]);
  const [transferenciaResultado,conciliacionResultado]=carrera;
  assert.ok(carrera.some(r=>r.status==="fulfilled"),"alguna operación concurrente debe finalizar");
  const [origenTrasCarrera,destinoTrasCarrera]=await Promise.all([
   Cuenta.findById(origenCarrera._id).lean(),Cuenta.findById(destinoCarrera._id).lean()]);
  const transferenciaAplicada=transferenciaResultado.status==="fulfilled";
  assert.equal(origenTrasCarrera.saldoMinor,transferenciaAplicada?40000:50000);
  assert.equal(destinoTrasCarrera.saldoMinor,transferenciaAplicada?15000:5000);
  assert.equal(origenTrasCarrera.saldoMinor+destinoTrasCarrera.saldoMinor,55000,
   "la carrera no debe crear ni destruir dinero");
  if(transferenciaAplicada){
   assert.equal(origenTrasCarrera.requiereReconciliacion,true,
    "no se puede certificar un saldo anterior a una transferencia confirmada");
   assert.equal(destinoTrasCarrera.requiereReconciliacion,true);
  }else if(conciliacionResultado.status==="fulfilled"){
   assert.equal(origenTrasCarrera.requiereReconciliacion,false);
  }
  assert.equal(await Outbox.countDocuments({usuarioId,aggregateType:"TRANSFERENCIA_PROPIA",
   aggregateId:origenCarrera._id}),transferenciaAplicada?1:0);
  assert.equal(await Outbox.countDocuments({usuarioId,eventName:"SALDO_CUENTA_RECONCILIADO",
   aggregateId:origenCarrera._id}),conciliacionResultado.status==="fulfilled"?1:0);
  // Una cuenta antigua corrupta en USD no puede mezclarse con caja COP.
  await Cuenta.collection.updateOne({_id:destino._id},{$set:{moneda:"USD"}});
  await assert.rejects(
   ()=>transferir(usuarioId,{...args,montoMinor:1000,externalId:crypto.randomUUID()}),
   e=>e.statusCode===404
  );
  assert.equal((await Cuenta.findById(origen._id)).saldoMinor,65000);
  assert.equal((await Cuenta.findById(destino._id)).saldoMinor,55000);
  assert.equal(await Outbox.countDocuments({usuarioId,aggregateType:"TRANSFERENCIA_PROPIA"}),2);
  await Cuenta.collection.updateOne({_id:destino._id},{$set:{moneda:"COP"}});
 }finally{
  await require("../../modules/finanzas-personales/models/TransaccionPersonal").deleteMany({usuarioId});
  await Outbox.deleteMany({usuarioId});
  await Cuenta.deleteMany({usuarioId});
  await mongoose.disconnect();
  if(secretAnterior===undefined)delete process.env.PERSONAL_IDEMPOTENCY_SECRET;
  else process.env.PERSONAL_IDEMPOTENCY_SECRET=secretAnterior;
 }
});
