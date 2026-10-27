"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Evento=require("../../modules/finanzas-personales/models/EventoCompensatorioPersonal");
const Cursor=require("../../modules/finanzas-personales/models/CursorCompensacionPersonal");
const Cuenta=require("../../modules/finanzas-personales/models/cuentaFinanciera.model");
const Transaccion=require("../../modules/finanzas-personales/models/TransaccionPersonal");
const Outbox=require("../../modules/finanzas-personales/models/outboxPersonal.model");
const {crearAplicador}=require("../../modules/finanzas-personales/services/compensarMovimientoPersonal.service");
const {consultarPeriodo}=require("../../modules/finanzas-personales/services/consultaCompensadaPersonal.service");
const {flujoPeriodo}=require("../../modules/finanzas-personales/services/flujoCajaPersonal.service");
const flujoCaja=require("../../modules/finanzas-personales/services/flujoCajaPersonal.service");
const historialCompensado=require("../../modules/finanzas-personales/services/historialCompensadoPersonal.service");
const neuronaFlujo=require("../../modules/finanzas-personales/intelligence/neurons/flujoDeCaja.neuron");
const conciliacionHistorica=require("../../modules/finanzas-personales/services/conciliacionHistoricoCuentaV81.service");
const resumenLedger=require("../../modules/finanzas-personales/services/resumenLedgerPersonal.service");
const finanzas=require("../../modules/finanzas-personales/services/finanzasPersonales.service");
const hormiga=require("../../modules/finanzas-personales/services/gastosHormigaResumen.service");
const patrimonio=require("../../modules/finanzas-personales/services/patrimonioPersonal.service");
const home=require("../../modules/finanzas-personales/services/homePersonal.service");
const Reserva=require("../../modules/finanzas-personales/models/reservaCuotaRecurrente.model");
const {periodoRecurrenteColombia}=require("../../modules/finanzas-personales/services/vinculoRecurrenteV81.service");
const {crearRegistrador,GENESIS}=require("../../modules/finanzas-personales/services/registradorCompensacionPersonal.service");
const {verificarCadena}=require("../../modules/finanzas-personales/services/eventoCompensatorioPersonal.service");
const {validarMongoPruebasV81}=require("../../scripts/exigir-mongo-v81-pruebas");
const uri=process.env.GRUK_V81_TEST_MONGO_URI;
test("compensaciones MongoDB real: estado vigente, concurrencia, rollback e aislamiento",{
 skip:!uri&&process.env.GRUK_REQUIRE_COMPENSACION_MONGO_TEST!=="1"?"Requiere replica set local aislado":false,
 timeout:60000
},async()=>{
 validarMongoPruebasV81(uri);
 await mongoose.connect(uri,{serverSelectionTimeoutMS:7000});
 const usuarios=Array.from({length:7},()=>new mongoose.Types.ObjectId().toString());
 const movimientoId=new mongoose.Types.ObjectId().toString();
 const original={usuarioId:usuarios[0],movimientoId,tipo:"GASTO",montoMinor:25000,concepto:"Rappi",categoria:"Alimentacion"};
 const registrar=crearRegistrador();
 const solicitud=(key,orig=original)=>({original:orig,tipo:"CORRECCION",cambios:{montoMinor:22000},idempotencyKey:key,fechaISO:"2026-10-25T15:00:00.000Z"});
 try{
  await Promise.all([Evento.init(),Cursor.init(),Cuenta.init(),Transaccion.init(),Outbox.init(),Reserva.init()]);
  const primero=await registrar(solicitud("correccion"));
  assert.equal(primero.deltaCajaMinor,"3000");
  await assert.rejects(registrar(solicitud("obsoleta")),/desactualizado/);
  const actual={...original,montoMinor:22000};
  const anular=key=>({...solicitud(key,actual),tipo:"ANULACION",cambios:{}});
  const carrera=await Promise.allSettled([registrar(anular("anular_a")),registrar(anular("anular_b"))]);
  assert.equal(carrera.filter(x=>x.status==="fulfilled").length,1);
  assert.equal(carrera.filter(x=>x.status==="rejected").length,1);
  assert.equal(carrera.find(x=>x.status==="fulfilled").value.deltaCajaMinor,"22000");
  await assert.rejects(registrar(anular("tercer_reverso")),/ya anulado/);
  const rows=await Evento.find({usuarioId:usuarios[0]},{_id:0}).sort({secuencia:1}).lean();
  assert.equal(rows.length,2);
  assert.equal(verificarCadena(rows,{prevHash:GENESIS}),true);
  const cursor=await Cursor.findById(usuarios[0]).lean();
  assert.equal(cursor.secuencia,2);
  assert.equal(cursor.hashActual,rows[1].hashActual);
  // La misma identidad de movimiento y clave en otro usuario no reutiliza su historial.
  const otro=await registrar(solicitud("correccion",{...original,usuarioId:usuarios[1]}));
  assert.equal(otro.secuencia,1);
  // Error DESPUÉS del CAS real: la transacción debe revertir el cursor.
  const fallido=crearRegistrador({EventoModelo:{
   collection:Evento.collection,
   findOne:(...args)=>Evento.findOne(...args),find:(...args)=>Evento.find(...args),
   create:async()=>{throw new Error("INSERCION_SIMULADA_FALLIDA");}
  }});
  await assert.rejects(fallido(solicitud("fallo",{...original,usuarioId:usuarios[2]})),/INSERCION_SIMULADA_FALLIDA/);
  assert.equal(await Cursor.findById(usuarios[2]).lean(),null);
  assert.equal(await Evento.countDocuments({usuarioId:usuarios[2]}),0);
  const cuenta=await Cuenta.create({usuarioId:usuarios[2],nombre:"PRUEBA",tipo:"EFECTIVO",saldoMinor:100000});
  const session=await mongoose.startSession();
  const opciones={readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"};
  try{
   // El fallo posterior al evento Y al saldo debe revertir ambas escrituras reales.
   await assert.rejects(session.withTransaction(async()=>{
    const e=await registrar(solicitud("unidad_atomica",{...original,usuarioId:usuarios[2]}),{session});
    assert.equal(session.inTransaction(),true);
    await Cuenta.updateOne({_id:cuenta._id},{$inc:{saldoMinor:Number(e.deltaCajaMinor)}},{session});
    throw new Error("FALLO_DESPUES_DEL_SALDO");
   },opciones),/FALLO_DESPUES_DEL_SALDO/);
   assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,100000);
   assert.equal(await Cursor.findById(usuarios[2]).lean(),null);
   assert.equal(await Evento.countDocuments({usuarioId:usuarios[2]}),0);
   // La misma clave queda disponible tras abortar; confirmar aplica exactamente un ajuste.
   await session.withTransaction(async()=>{
    const e=await registrar(solicitud("unidad_atomica",{...original,usuarioId:usuarios[2]}),{session});
    await Cuenta.updateOne({_id:cuenta._id},{$inc:{saldoMinor:Number(e.deltaCajaMinor)}},{session});
   },opciones);
   assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,103000);
   assert.equal((await Cursor.findById(usuarios[2]).lean()).secuencia,1);
   assert.equal(await Evento.countDocuments({usuarioId:usuarios[2]}),1);
  }finally{await session.endSession();}
  // Orquestador real: fuente inalterada, cuenta por ID y outbox en la misma transacción.
  const aplicar=crearAplicador();
  for(const usuarioId of usuarios.slice(3,5)){
   const ancla=new Date(Date.now()-3600000);
   const cuenta=await Cuenta.create({usuarioId,nombre:"CAJA",tipo:"EFECTIVO",saldoMinor:50000,
    saldoAnclaMinor:50000,saldoAnclaEn:ancla,saldoVerificadoEn:ancla,requiereReconciliacion:false});
   const tx=await Transaccion.create({usuarioId,cuentaId:cuenta._id,cuenta:"CAJA",tipo:"GASTO",
    montoMinor:25000,concepto:"Rappi",categoria:"Alimentacion",fecha:new Date(Date.now()-7200000)});
   const fuenteAntes=await Transaccion.findById(tx._id).lean();
   const solicitud={usuarioId,movimientoId:String(tx._id),tipo:"CORRECCION",
    cambios:{montoMinor:22000,categoria:"Otros"},idempotencyKey:"ajuste_caja"};
   const periodo={usuarioId,desde:new Date(+fuenteAntes.fecha-1).toISOString(),
    hasta:new Date(+fuenteAntes.fecha+1).toISOString()};
   if(usuarioId===usuarios[3]){
    await assert.rejects(aplicar({...solicitud,usuarioId:usuarios[4]}),e=>e.statusCode===404);
    await aplicar(solicitud);
    assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,53000);
    assert.equal((await patrimonio.snapshot(usuarioId)).liquidezMinor,53000);
    const pantalla=await home.obtener(usuarioId);
    assert.equal(pantalla.caja.saldoLiquidoMinor,53000);
    const lectura=await consultarPeriodo({...periodo,categoria:"Otros"});
    assert.equal(lectura.length,1);
    assert.equal(lectura[0].montoMinor,22000);
    const flujo=await flujoPeriodo(usuarioId,periodo);
    assert.equal(flujo.gastosMinor,22000);
    assert.equal(flujo.flujoNetoMinor,-22000);
    const resumen=await resumenLedger.resumen(usuarioId,periodo);
    assert.equal(resumen.gastosMinor,22000);
    assert.equal(resumen.flujoLibreMinor,-22000);
    const filtrosHistorial={q:"Rappi",tipo:"GASTO",estado:"TODOS",monto:22000,pagina:1};
    assert.equal((await historialCompensado.buscar(usuarioId,filtrosHistorial)).length,1);
    assert.equal((await historialCompensado.buscar(usuarioId,{...filtrosHistorial,monto:25000})).length,0);
    const reporte=await neuronaFlujo.analyze(usuarioId,periodo);
    assert.equal(reporte.hallazgos[0].impacto_anual_estimado,264000);
    const informe=await finanzas.resumenPeriodo(usuarioId,periodo);
    assert.equal(informe.categorias.Otros.gastos,22000);
    const diario=await finanzas.diario(usuarioId,{...periodo,limit:100});
    assert.equal(diario[0].gastos,22000);
    assert.equal((await finanzas.resumen(usuarioId,fuenteAntes.fecha)).gastos,22000);
    assert.equal((await hormiga.obtener(usuarioId,{ahora:new Date(+fuenteAntes.fecha+1)})).mesMinor,22000);
    assert.equal((await consultarPeriodo({...periodo,categoria:"Alimentacion"})).length,0);
    const replay=await aplicar(solicitud);
    assert.equal(replay.hashActual,lectura[0].compensacionHash);
    assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,53000);
    assert.equal(await Outbox.countDocuments({usuarioId}),1);
    await assert.rejects(aplicar({...solicitud,cambios:{montoMinor:21000}}),/datos distintos/);
    await aplicar({...solicitud,cambios:{tipo:"INGRESO"},idempotencyKey:"cambio_tipo"});
    const reclasificado=await finanzas.resumenPeriodo(usuarioId,periodo);
    assert.equal(reclasificado.gastos,0);
    assert.equal(reclasificado.ingresos,22000);
    assert.equal(reclasificado.categorias.Otros.ingresos,22000);
    assert.equal((await patrimonio.snapshot(usuarioId)).liquidezMinor,97000);
    assert.equal((await finanzas.diario(usuarioId,periodo))[0].ingresos,22000);
    const mensual=await finanzas.resumen(usuarioId,fuenteAntes.fecha);
    assert.equal(mensual.ingresos,22000);
    assert.equal(mensual.gastos,0);
    assert.equal((await hormiga.obtener(usuarioId,{ahora:new Date(+fuenteAntes.fecha+1)})).mesMinor,0);
    await aplicar({...solicitud,tipo:"ANULACION",cambios:{},idempotencyKey:"anular_caja"});
    assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,75000);
    assert.equal((await patrimonio.snapshot(usuarioId)).liquidezMinor,75000);
    assert.equal((await home.obtener(usuarioId)).caja.saldoLiquidoMinor,75000);
    assert.equal(await Outbox.countDocuments({usuarioId}),3);
    assert.equal(await Evento.countDocuments({usuarioId}),3);
    assert.equal((await consultarPeriodo(periodo)).length,0);
    assert.equal((await flujoPeriodo(usuarioId,periodo)).gastosMinor,0);
    assert.equal((await resumenLedger.resumen(usuarioId,periodo)).flujoLibreMinor,0);
    assert.deepEqual(await finanzas.diario(usuarioId,periodo),[]);
    assert.equal((await finanzas.resumenPeriodo(usuarioId,periodo)).balance,0);
    assert.equal((await historialCompensado.buscar(usuarioId,{q:"Rappi",tipo:"TODOS",estado:"ANULADA",pagina:1}))[0].estado,"ANULADA");
    assert.equal((await historialCompensado.buscar(usuarioId,{q:"Rappi",tipo:"TODOS",estado:"TODOS",pagina:1})).length,0);
    assert.equal((await finanzas.resumen(usuarioId,fuenteAntes.fecha)).ingresos,0);
    assert.equal((await hormiga.obtener(usuarioId,{ahora:new Date(+fuenteAntes.fecha+1)})).mesMinor,0);
    const anuladas=await consultarPeriodo({...periodo,incluirAnuladas:true});
    assert.equal(anuladas.length,1);
    assert.equal(anuladas[0].estado,"ANULADA");
    const repetirAnulacion=await aplicar({...solicitud,tipo:"ANULACION",cambios:{},idempotencyKey:"anular_caja"});
    assert.equal(repetirAnulacion.hashActual,anuladas[0].compensacionHash);
    assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,75000);
    assert.equal(await Outbox.countDocuments({usuarioId}),3);
    const dia=conciliacionHistorica.fechaContableBogotaV81(fuenteAntes.fecha);
    const hoyConciliacion=conciliacionHistorica.fechaContableBogotaV81(new Date());
    const siguiente=new Date(+new Date(hoyConciliacion+"T00:00:00Z")+86400000).toISOString().slice(0,10);
    const conciliacion=await conciliacionHistorica.conciliarHistoricoCuentaV81({usuarioId,cuentaId:String(cuenta._id),
     desde:dia,hastaExclusivo:siguiente,saldoInicialCentavos:0n,saldoObservadoCentavos:0n});
    assert.equal(conciliacion.diferenciaCentavos,"0");
   }else{
    const fallarAuditoria=crearAplicador({OutboxModelo:{create:async()=>{throw Error("OUTBOX_FALLIDO");}}});
    await assert.rejects(fallarAuditoria(solicitud),/OUTBOX_FALLIDO/);
    assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,50000);
    assert.equal(await Evento.countDocuments({usuarioId}),0);
    assert.equal(await Cursor.findById(usuarioId).lean(),null);
    assert.equal(await Outbox.countDocuments({usuarioId}),0);
    const recurrente=await Transaccion.create({usuarioId,cuentaId:cuenta._id,tipo:"GASTO",montoMinor:25000,concepto:"Arriendo",categoria:"Fijos",fecha:new Date(),recurrente:true});
    await assert.rejects(aplicar({...solicitud,movimientoId:String(recurrente._id)}),/tratamiento especial/);
   }
   assert.deepEqual(await Transaccion.findById(tx._id).lean(),fuenteAntes);
   if(usuarioId===usuarios[3]){
    await Evento.collection.deleteOne({usuarioId,secuencia:1});
    await assert.rejects(consultarPeriodo({...periodo,incluirAnuladas:true}),/INTEGRIDAD_LEDGER/);
   }
  }
  const usuarioId=usuarios[5];
  const cuentaRecurrente=await Cuenta.create({usuarioId,nombre:"RECURRENTE",tipo:"EFECTIVO",saldoMinor:60000});
  const origen=await Transaccion.create({usuarioId,cuentaId:cuentaRecurrente._id,tipo:"GASTO",montoMinor:100000,
   concepto:"Arriendo",categoria:"Fijos",recurrente:true,frecuencia:"MENSUAL",impactoCaja:false,fecha:new Date("2026-09-01T15:00:00Z")});
  const abonos=await Transaccion.create([25000,15000].map((montoMinor,i)=>({usuarioId,cuentaId:cuentaRecurrente._id,
   cuenta:"RECURRENTE",tipo:"GASTO",montoMinor,concepto:"Abono arriendo",categoria:"Fijos",
   recurrenteOrigenId:origen._id,fecha:new Date(`2026-10-${15+i}T15:00:00Z`)})));
  const abonoOriginal=await Transaccion.findById(abonos[0]._id).lean();
  const {inicio,fin}=periodoRecurrenteColombia({fechaOrigen:origen.fecha,fechaPago:abonos[0].fecha,frecuencia:"MENSUAL"});
  const reserva=await Reserva.create({usuarioId,origenId:origen._id,periodoInicio:inicio,periodoFin:fin,
   importeCuotaMinor:100000,reservadoMinor:40000});
  const anularAbono=(id,key)=>({usuarioId,movimientoId:String(id),tipo:"ANULACION",idempotencyKey:key});
  await assert.rejects(aplicar({...anularAbono(abonos[0]._id,"corregir_abono"),tipo:"CORRECCION",cambios:{montoMinor:20000}}),/solo admite anulación/);
  await Reserva.updateOne({_id:reserva._id},{$set:{reservadoMinor:39000}});
  await assert.rejects(aplicar(anularAbono(abonos[0]._id,"reserva_inconsistente")),/desincronizada/);
  assert.equal(await Evento.countDocuments({usuarioId}),0);
  await Reserva.updateOne({_id:reserva._id},{$set:{reservadoMinor:40000}});
  const falloRecurrente=crearAplicador({OutboxModelo:{create:async()=>{throw Error("AUDITORIA_RECURRENTE_FALLIDA");}}});
  await assert.rejects(falloRecurrente(anularAbono(abonos[0]._id,"fallar_abono")),/AUDITORIA_RECURRENTE_FALLIDA/);
  assert.equal((await Reserva.findById(reserva._id).lean()).reservadoMinor,40000);
  assert.equal((await Cuenta.findById(cuentaRecurrente._id).lean()).saldoMinor,60000);
  assert.equal(await Evento.countDocuments({usuarioId}),0);
  const carreraAbonos=await Promise.allSettled([
   aplicar(anularAbono(abonos[0]._id,"anular_abono_a")),aplicar(anularAbono(abonos[0]._id,"anular_abono_b"))]);
  assert.equal(carreraAbonos.filter(x=>x.status==="fulfilled").length,1);
  assert.equal((await Reserva.findById(reserva._id).lean()).reservadoMinor,15000);
  assert.equal((await Cuenta.findById(cuentaRecurrente._id).lean()).saldoMinor,85000);
  await aplicar(anularAbono(abonos[1]._id,"anular_segundo_abono"));
  assert.equal((await Reserva.findById(reserva._id).lean()).reservadoMinor,0);
  assert.equal((await Cuenta.findById(cuentaRecurrente._id).lean()).saldoMinor,100000);
  assert.equal(await Evento.countDocuments({usuarioId}),2);
  assert.deepEqual(await Transaccion.findById(abonos[0]._id).lean(),abonoOriginal);
  await assert.rejects(flujoCaja.anularTransaccion(usuarioId,String(abonos[0]._id)),/heredada bloqueada/);
  await assert.rejects(flujoCaja.corregirTransaccion(usuarioId,String(abonos[0]._id),{categoria:"Otra"}),/heredada bloqueada/);
  const secretAnterior=process.env.PERSONAL_IDEMPOTENCY_SECRET;
  process.env.PERSONAL_IDEMPOTENCY_SECRET="SOLO_PRUEBA_LOCAL_REEMPLAZO_RECURRENTE_32_BYTES";
  try{
   const reemplazo=await flujoCaja.registrarTransaccion(usuarioId,{tipo:"GASTO",montoMinor:100000,
    concepto:"Reemplazo de abonos anulados",categoria:"Fijos",cuenta:"RECURRENTE",medioPago:"EFECTIVO",
    fecha:abonos[1].fecha,recurrenteOrigenId:origen._id,externalId:"reemplazo_compensado"});
   assert.equal(reemplazo.montoMinor,100000);
   assert.equal((await Reserva.findById(reserva._id).lean()).reservadoMinor,100000);
   assert.equal((await Cuenta.findById(cuentaRecurrente._id).lean()).saldoMinor,0);
   const actuales=await consultarPeriodo({usuarioId,desde:inicio.toISOString(),hasta:fin.toISOString(),tipo:"GASTO"});
   const vinculados=actuales.filter(x=>String(x.recurrenteOrigenId)===String(origen._id));
   assert.equal(vinculados.length,1);
   assert.equal(String(vinculados[0]._id),String(reemplazo._id));
  }finally{
   if(secretAnterior===undefined)delete process.env.PERSONAL_IDEMPOTENCY_SECRET;
   else process.env.PERSONAL_IDEMPOTENCY_SECRET=secretAnterior;
  }
  // HTTP real sobre el handler de producción y MongoDB local, identidad fijada por middleware de ensayo.
  const httpUsuario=usuarios[6];
  const httpCuenta=await Cuenta.create({usuarioId:httpUsuario,nombre:"HTTP",tipo:"EFECTIVO",saldoMinor:50000});
  const httpTx=await Transaccion.create({usuarioId:httpUsuario,cuentaId:httpCuenta._id,cuenta:"HTTP",
   tipo:"GASTO",montoMinor:25000,concepto:"Café HTTP",categoria:"Otros",fecha:new Date()});
  const express=require("express"),{crearHandler}=require("../../modules/finanzas-personales/services/compensacionPersonal.handler");
  const app=express();app.use(express.json(),(req,res,next)=>{req.personalAuth={userId:httpUsuario};req.validated=req.body;next();});
  app.patch("/transacciones/:id",crearHandler({tipo:"CORRECCION"}));
  app.delete("/transacciones/:id",crearHandler({tipo:"ANULACION"}));
  const server=await new Promise((resolve,reject)=>{const s=app.listen(0,"127.0.0.1",()=>resolve(s));s.on("error",reject);});
  try{
   const url=`http://127.0.0.1:${server.address().port}/transacciones/${httpTx._id}`;
   const opciones={method:"PATCH",headers:{"Content-Type":"application/json","Idempotency-Key":"http_corregir"},body:JSON.stringify({montoMinor:22000})};
   const sinClave=await fetch(url,{...opciones,headers:{"Content-Type":"application/json"}});
   assert.equal(sinClave.status,400);
   const primera=await fetch(url,opciones);assert.equal(primera.status,200);const json=await primera.json();
   const repeticion=await fetch(url,opciones);assert.equal(repeticion.status,200);
   assert.equal((await repeticion.json()).compensacion.hashActual,json.compensacion.hashActual);
   assert.equal((await Cuenta.findById(httpCuenta._id).lean()).saldoMinor,53000);
   for(let n=0;n<2;n++)assert.equal((await fetch(url,{method:"DELETE",headers:{"Idempotency-Key":"http_anular"}})).status,200);
   assert.equal((await Cuenta.findById(httpCuenta._id).lean()).saldoMinor,75000);
   assert.equal(await Evento.countDocuments({usuarioId:httpUsuario}),2);
   assert.equal(await Outbox.countDocuments({usuarioId:httpUsuario}),2);
   assert.equal((await Transaccion.findById(httpTx._id).lean()).montoMinor,25000);
  }finally{await new Promise(resolve=>server.close(resolve));}
 }finally{
  // Los modelos rechazan deletes: limpieza directa SOLO tras validar el destino loopback de pruebas.
  await Evento.collection.deleteMany({usuarioId:{$in:usuarios}});
  await Cursor.collection.deleteMany({_id:{$in:usuarios}});
  await Cuenta.deleteMany({usuarioId:{$in:usuarios}});
  await Transaccion.deleteMany({usuarioId:{$in:usuarios}});
  await Outbox.deleteMany({usuarioId:{$in:usuarios}});
  await Reserva.deleteMany({usuarioId:{$in:usuarios}});
  await require("../../modules/finanzas-personales/models/reporteNeuronaPersonal.model").deleteMany({usuarioId:{$in:usuarios}});
  await mongoose.disconnect();
 }
});
