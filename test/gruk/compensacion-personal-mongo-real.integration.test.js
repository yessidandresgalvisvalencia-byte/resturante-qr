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
const {crearRegistradorFinancieroPersonal}=require("../../modules/finanzas-personales/services/registradorFinancieroPersonal.service");
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
  // Alta de obligación prevista en Mongo real: ni centavo de saldo,
  // ni evento financiero de pago, y replay con misma clave bloqueado.
  const {crearRegistradorObligacionPersonal}=require(
   "../../modules/finanzas-personales/services/registrarObligacionPersonal.service");
  const claveAntesObligacion=process.env.PERSONAL_IDEMPOTENCY_SECRET;
  process.env.PERSONAL_IDEMPOTENCY_SECRET="solo-test-obligaciones";
  try{
   const registrarObligacion=crearRegistradorObligacionPersonal();
   const prevista={montoMinor:500000,concepto:"Arriendo futuro",
    categoria:"Vivienda",fecha:"2026-11-15T12:00:00Z",
    recurrente:true,frecuencia:"MENSUAL",externalId:"arriendo-noviembre-test"};
   const cuentaPrevia=(await Cuenta.findById(cuenta._id).lean()).saldoMinor;
   const outboxPrevio=await Outbox.countDocuments({usuarioId});
   const creada=await registrarObligacion(String(usuarioId),prevista);
   assert.equal(creada.impactoCaja,false);
   assert.equal(creada.cuentaId,null);
   assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,cuentaPrevia);
   assert.equal(await Outbox.countDocuments({usuarioId}),outboxPrevio);
   await assert.rejects(()=>registrarObligacion(String(usuarioId),prevista),
    e=>e.statusCode===409);
   assert.equal(await Movimiento.countDocuments({_id:creada._id}),1);
   await Movimiento.deleteOne({_id:creada._id}); // Base efímera exclusiva de prueba.
  }finally{
   if(claveAntesObligacion===undefined)
    delete process.env.PERSONAL_IDEMPOTENCY_SECRET;
   else process.env.PERSONAL_IDEMPOTENCY_SECRET=claveAntesObligacion;
  }
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
  const registrar=crearRegistradorFinancieroPersonal();
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
  assert.ok(await Evento.findOne({usuarioId:String(usuarioId),
   movimientoId:String(asiento._id)}).lean(),
   "El evento del asiento debe encontrarse por identidad antes del bloqueo");
  const flujoLegado=require("../../modules/finanzas-personales/services/flujoCajaPersonal.service");
  // Los montos individuales son safe, pero cambiar GASTO a INGRESO
  // puede producir un delta > MAX_SAFE_INTEGER. Nunca $inc ni UPDATE.
  const [asientoLimite]=await Movimiento.create([{
   usuarioId,cuentaId:cuenta._id,cuenta:cuenta.nombre,
   tipo:"GASTO",montoMinor:Number.MAX_SAFE_INTEGER,
   concepto:"Simulación de borde",categoria:"Pruebas",
   fecha:new Date("2026-12-05T12:00:00.000Z"),
   estado:"ACTIVA",impactoCaja:true
  }]);
  const saldoAntesOverflow=(await Cuenta.findById(cuenta._id).lean()).saldoMinor;
  const outboxAntesOverflow=await Outbox.countDocuments({usuarioId});
  await assert.rejects(()=>flujoLegado.corregirTransaccion(
   usuarioId,String(asientoLimite._id),
   {tipo:"INGRESO",montoMinor:Number.MAX_SAFE_INTEGER}
  ),e=>e.statusCode===409&&/DELTA_LEGADO_INVALIDO/.test(e.message));
  assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,saldoAntesOverflow);
  assert.equal(await Outbox.countDocuments({usuarioId}),outboxAntesOverflow);
  const limiteIntacto=await Movimiento.findById(asientoLimite._id).lean();
  assert.equal(limiteIntacto.tipo,"GASTO");
  assert.equal(limiteIntacto.montoMinor,Number.MAX_SAFE_INTEGER);
  await Movimiento.deleteOne({_id:asientoLimite._id}); // Solo base aislada de prueba.
  await assert.rejects(()=>flujoLegado.corregirTransaccion(usuarioId,String(asiento._id),
   {montoMinor:20000}),e=>e.statusCode===409&&/ledger compensatorio/.test(e.message));
  await assert.rejects(()=>flujoLegado.anularTransaccion(usuarioId,String(asiento._id)),
   e=>e.statusCode===409&&/ledger compensatorio/.test(e.message));
  assert.equal((await Movimiento.findById(asiento._id).lean()).montoMinor,25000);
  assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,103000);
  assert.equal(await Outbox.countDocuments({usuarioId}),1);
  // Un nombre copiado no puede redirigir correcciones ni reversos a una
  // cuenta distinta del ID asociado al asiento original.
  const [cuentaAjenaDestino]=await Cuenta.create([{
   usuarioId,nombre:"NO-ES-LA-CUENTA-DEL-ASIENTO",tipo:"AHORROS",
   saldoMinor:250000,moneda:"COP",activa:true,requiereReconciliacion:false
  }]);
  const [asientoDesvinculado]=await Movimiento.create([{
   usuarioId,cuentaId:cuenta._id,cuenta:cuentaAjenaDestino.nombre,
   tipo:"GASTO",montoMinor:10000,concepto:"Cuenta alterada",
   categoria:"Pruebas",fecha:new Date("2026-10-20T12:25:00.000Z"),
   estado:"ACTIVA",impactoCaja:true
  }]);
  const antesCuentaCorrecta=(await Cuenta.findById(cuenta._id).lean()).saldoMinor;
  const antesCuentaDestino=(await Cuenta.findById(cuentaAjenaDestino._id).lean()).saldoMinor;
  await assert.rejects(()=>flujoLegado.corregirTransaccion(usuarioId,
   String(asientoDesvinculado._id),{montoMinor:9000}),
   e=>e.statusCode===409);
  await assert.rejects(()=>flujoLegado.anularTransaccion(usuarioId,
   String(asientoDesvinculado._id)),e=>e.statusCode===409);
  assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,antesCuentaCorrecta);
  assert.equal((await Cuenta.findById(cuentaAjenaDestino._id).lean()).saldoMinor,
   antesCuentaDestino);
  assert.equal((await Movimiento.findById(asientoDesvinculado._id).lean()).montoMinor,10000);
  assert.equal((await Movimiento.findById(asientoDesvinculado._id).lean()).estado,"ACTIVA");
  // No debe contaminar otros escenarios del test (que miden totales exactos).
  await Movimiento.deleteOne({_id:asientoDesvinculado._id});
  await Cuenta.deleteOne({_id:cuentaAjenaDestino._id});
  const segundoOriginal={...original,montoMinor:22000};
  const registrarFalla=crearRegistradorFinancieroPersonal({
   crearAplicador:()=>async contexto=>{
    await aplicar(contexto);
    throw Error("FALLO_SIMULADO_DESPUES_DE_OUTBOX");
   }
  });
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
  // Ejercitar la consulta REAL: movimientos, eventos y cursor bajo snapshot.
  const {crearConsultaFlujoCompensado}=require(
   "../../modules/finanzas-personales/services/consultaFlujoCompensadoPersonal.service");
  const consultar=crearConsultaFlujoCompensado();
  const intervalo={desde:"2026-10-01T00:00:00.000Z",hasta:"2026-11-01T00:00:00.000Z"};
  const compensado=await consultar(String(usuarioId),intervalo);
  // Dos gastos originales: 25.000 + 30.000; el ajuste inicial devuelve 3.000.
  // Solo las operaciones concurrentes confirmadas afectan el total final.
  assert.equal(compensado.flujoNetoMinor,Number(-52000n+deltas));
  assert.equal(compensado.gastosMinor,Number(52000n-deltas));
  assert.equal(compensado.fuente,"EVENTOS_COMPENSATORIOS_VERIFICADOS");
  const usuarioAjeno=new mongoose.Types.ObjectId();
  const ajeno=await consultar(String(usuarioAjeno),intervalo);
  assert.equal(ajeno.flujoNetoMinor,0);
  // Carrera de escritura REAL: corrección LEGADA de solo concepto (sin delta)
  // contra el ledger compensatorio. Deben disputar el MISMO cursor/fence.
  const [asientoCarrera]=await Movimiento.create([{
   usuarioId,cuentaId:cuenta._id,cuenta:cuenta.nombre,tipo:"GASTO",
   montoMinor:12000,concepto:"Compra original",categoria:"Hogar",
   fecha:new Date("2026-10-20T14:00:00.000Z"),estado:"ACTIVA",
   impactoCaja:true,recurrente:false
  }]);
  const descriptorCarrera={
   usuarioId:String(usuarioId),movimientoId:String(asientoCarrera._id),
   tipo:"GASTO",montoMinor:12000,concepto:"Compra original",categoria:"Hogar"
  };
  const totalAntes=await Evento.countDocuments({usuarioId:String(usuarioId),
   movimientoId:String(asientoCarrera._id)});
  assert.equal(totalAntes,0);
  const saldoAntesCarrera=(await Cuenta.findById(cuenta._id).lean()).saldoMinor;
  const choque=await Promise.allSettled([
   flujoLegado.corregirTransaccion(usuarioId,String(asientoCarrera._id),
    {concepto:"Compra rectificada legacy"}),
   registrar({original:descriptorCarrera,tipo:"CORRECCION",
    cambios:{montoMinor:11000},idempotencyKey:"carrera_legacy_vs_compensacion",
    fechaISO:"2026-10-20T18:00:00.000Z"})
  ]);
  const exitos=choque.filter(r=>r.status==="fulfilled").length;
  assert.equal(exitos,1,
   "Legacy y ledger no pueden confirmar a la vez sobre el mismo asiento");
  const carreraOriginal=await Movimiento.findById(asientoCarrera._id).lean();
  const carreraEventos=await Evento.find({usuarioId:String(usuarioId),
   movimientoId:String(asientoCarrera._id)}).lean();
  const legacyGano=carreraOriginal.concepto==="Compra rectificada legacy";
  assert.equal(carreraEventos.length,legacyGano?0:1);
  assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,
   saldoAntesCarrera+(legacyGano?0:1000));
  assert.equal(await Outbox.countDocuments({usuarioId}),
   1+confirmados.length+1);
  for(const r of choque.filter(r=>r.status==="rejected"))
   assert.ok(r.reason.statusCode===409||[112,251].includes(r.reason.code)||
    r.reason.hasErrorLabel?.("TransientTransactionError")===true,
    "Error inesperado en carrera legada: "+String(r.reason));
  // La entrada HTTP real debe registrar evento+saldo+outbox sin aceptar
  // usuario ni movimiento desde el body (solamente auth + URL).
  const {crearCompensacionPersonalHandler}=require(
   "../../modules/finanzas-personales/services/compensacionPersonal.handler");
  const [asientoHttp]=await Movimiento.create([{
   usuarioId,cuentaId:cuenta._id,cuenta:cuenta.nombre,
   tipo:"GASTO",montoMinor:5000,concepto:"Prueba API",categoria:"Pruebas",
   fecha:new Date("2026-10-20T14:30:00.000Z"),estado:"ACTIVA",impactoCaja:true
  }]);
  const http=crearCompensacionPersonalHandler();
  const salida={status:200,body:null};
  const response={status(code){salida.status=code;return response;},
   json(body){salida.body=body;return response;}};
  const saldoPrevioHttp=(await Cuenta.findById(cuenta._id).lean()).saldoMinor;
  const previoOutbox=await Outbox.countDocuments({usuarioId});
  await http({personalAuth:{userId:String(usuarioId)},
   params:{id:String(asientoHttp._id)},
   validated:{idempotencyKey:"compensacion_desde_http",tipo:"CORRECCION",
    original:{tipo:"GASTO",montoMinor:5000,concepto:"Prueba API",categoria:"Pruebas"},
    cambios:{montoMinor:4500},usuarioId:"identidad_falsa"}},response);
  assert.equal(salida.status,201);
  assert.equal(salida.body.compensacion.deltaCajaMinor,"500");
  assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,saldoPrevioHttp+500);
  assert.equal(await Outbox.countDocuments({usuarioId}),previoOutbox+1);
  assert.equal((await Movimiento.findById(asientoHttp._id).lean()).montoMinor,5000);
  assert.equal(await Evento.countDocuments({usuarioId:String(usuarioId),
   movimientoId:String(asientoHttp._id)}),1);
  // El segundo intento con idéntica clave nunca crea un evento ni carga doble.
  await http({personalAuth:{userId:String(usuarioId)},
   params:{id:String(asientoHttp._id)},
   validated:{idempotencyKey:"compensacion_desde_http",tipo:"CORRECCION",
    original:{tipo:"GASTO",montoMinor:5000,concepto:"Prueba API",categoria:"Pruebas"},
    cambios:{montoMinor:4500}}},response);
  assert.equal(salida.status,409);
  assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,saldoPrevioHttp+500);
  assert.equal(await Outbox.countDocuments({usuarioId}),previoOutbox+1);
  // Regresión: dos correcciones adicionales de metadatos no pueden
  // olvidar el nuevo importe ni un concepto corregido previamente.
  const descriptorUno={usuarioId:String(usuarioId),
   movimientoId:String(asientoHttp._id),tipo:"GASTO",montoMinor:4500,
   concepto:"Prueba API",categoria:"Pruebas"};
  await registrar({original:descriptorUno,tipo:"CORRECCION",
   cambios:{concepto:"Prueba API rectificada"},
   idempotencyKey:"http_concepto_v2",fechaISO:"2026-10-20T19:00:00.000Z"});
  const descriptorDos={...descriptorUno,concepto:"Prueba API rectificada"};
  await assert.rejects(()=>registrar({original:descriptorUno,tipo:"CORRECCION",
   cambios:{categoria:"Otros"},idempotencyKey:"http_obsoleto",
   fechaISO:"2026-10-20T19:01:00.000Z"}),/Movimiento desactualizado/);
  await registrar({original:descriptorDos,tipo:"CORRECCION",
   cambios:{categoria:"Otros"},idempotencyKey:"http_categoria_v3",
   fechaISO:"2026-10-20T19:02:00.000Z"});
  assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,saldoPrevioHttp+500);
  assert.equal(await Outbox.countDocuments({usuarioId}),previoOutbox+3);
  assert.equal((await Movimiento.findById(asientoHttp._id).lean()).montoMinor,5000);
  // El cliente obtiene su estado vigente real antes de la próxima operación.
  const {crearConsultaMovimientoCompensado}=require(
   "../../modules/finanzas-personales/services/consultaMovimientoCompensadoPersonal.service");
  const leerEstado=crearConsultaMovimientoCompensado();
  const vigenteHttp=await leerEstado(String(usuarioId),String(asientoHttp._id));
  assert.equal(vigenteHttp.original.montoMinor,4500);
  assert.equal(vigenteHttp.original.concepto,"Prueba API rectificada");
  assert.equal(vigenteHttp.original.categoria,"Otros");
  assert.equal(vigenteHttp.elegibleParaCompensar,true);
  // La consulta de estado no debe recomendar operaciones financieras
  // cuando la cuenta requiere conciliación, aunque la cadena sea válida.
  await Cuenta.updateOne({_id:cuenta._id},{$set:{requiereReconciliacion:true}});
  const noConciliado=await leerEstado(String(usuarioId),String(asientoHttp._id));
  assert.equal(noConciliado.elegibleParaCompensar,false);
  await Cuenta.updateOne({_id:cuenta._id},{$set:{requiereReconciliacion:false}});
  assert.equal((await leerEstado(String(usuarioId),String(asientoHttp._id)))
   .elegibleParaCompensar,true);
  const ajenoEstado=await assert.rejects(
   leerEstado(String(new mongoose.Types.ObjectId()),String(asientoHttp._id)),
   error=>error.statusCode===404
  );
  const pruebaUltimo=await Evento.find({usuarioId:String(usuarioId)})
   .sort({secuencia:1}).lean();
  assert.equal(vigenteHttp.hashCadena,pruebaUltimo.at(-1).hashActual);
  // Una operación patrimonial se puede consultar, pero jamás ofrecer
  // como compensación ordinaria (no ha de tocar préstamos/deudas).
  const [patrimonial]=await Movimiento.create([{
   usuarioId,cuentaId:cuenta._id,cuenta:cuenta.nombre,
   tipo:"AJUSTE_SALDO",montoMinor:1000,concepto:"Conciliación",
   categoria:"Ajustes",fecha:new Date("2026-10-20T14:35:00.000Z"),
   estado:"ACTIVA",impactoCaja:false
  }]);
  const noAdmitido=await leerEstado(String(usuarioId),String(patrimonial._id));
  assert.equal(noAdmitido.original,null);
  assert.equal(noAdmitido.elegibleParaCompensar,false);
  assert.equal(noAdmitido.motivo,"TIPO_NO_ADMITIDO_POR_LEDGER_COMPENSATORIO");
  // Una cuota recurrente prevista no es gasto de caja realizado.
  const flujoLegacyAntesPendiente=await flujoLegado.flujoPeriodo(String(usuarioId),intervalo);
  const flujoAntesPendiente=await consultar(String(usuarioId),intervalo);
  const [obligacionPendiente]=await Movimiento.create([{
   usuarioId,cuentaId:cuenta._id,cuenta:cuenta.nombre,
   tipo:"GASTO",montoMinor:500000,concepto:"Arriendo previsto",
   categoria:"Vivienda",fecha:new Date("2026-10-20T14:40:00.000Z"),
   recurrente:true,frecuencia:"MENSUAL",impactoCaja:false,
   estado:"ACTIVA"
  }]);
  // Evitar que PATCH/DELETE heredados reviertan caja sobre un compromiso
  // que nunca descontó dinero. Debe permanecer intacto el asiento.
  const saldoAntesMutacionPendiente=(await Cuenta.findById(cuenta._id).lean()).saldoMinor;
  await assert.rejects(()=>flujoLegado.corregirTransaccion(usuarioId,
   String(obligacionPendiente._id),{montoMinor:400000}),
   e=>e.statusCode===409&&/sin impacto de caja/.test(e.message));
  await assert.rejects(()=>flujoLegado.anularTransaccion(usuarioId,
   String(obligacionPendiente._id)),
   e=>e.statusCode===409&&/sin impacto de caja/.test(e.message));
  assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,
   saldoAntesMutacionPendiente);
  const pendienteIntacto=await Movimiento.findById(obligacionPendiente._id).lean();
  assert.equal(pendienteIntacto.montoMinor,500000);
  assert.equal(pendienteIntacto.estado,"ACTIVA");
  const flujoLegacyDespuesPendiente=await flujoLegado.flujoPeriodo(String(usuarioId),intervalo);
  assert.equal(flujoLegacyDespuesPendiente.gastosMinor,
   flujoLegacyAntesPendiente.gastosMinor,
   "El agregado heredado de caja realizada no debe imputar el arriendo pendiente");
  assert.equal(flujoLegacyDespuesPendiente.flujoNetoMinor,
   flujoLegacyAntesPendiente.flujoNetoMinor);
  const flujoDespuesPendiente=await consultar(String(usuarioId),intervalo);
  assert.equal(flujoDespuesPendiente.gastosMinor,flujoAntesPendiente.gastosMinor,
   "Compromiso futuro no debe sumarse como egreso de caja ya realizado");
  assert.equal(flujoDespuesPendiente.flujoNetoMinor,flujoAntesPendiente.flujoNetoMinor);
  assert.equal((await Movimiento.findById(obligacionPendiente._id).lean()).impactoCaja,false);
  // Diagnóstico de migración: ambos agregados proceden del MISMO snapshot.
  const comparacion=await consultar(String(usuarioId),{
   ...intervalo,diagnostico:true
  });
  assert.equal(comparacion.verificado.flujoNetoMinor,
   flujoDespuesPendiente.flujoNetoMinor);
  assert.equal(comparacion.obligacionesNoCajaIncluidasPorLegado,1);
  assert.equal(comparacion.importeObligacionesNoCajaMinor,500000);
  assert.equal(comparacion.diferenciaExplicadaPorNoCajaMinor,500000);
  assert.equal(comparacion.diferenciaResidualMinor,
   Number(3500n+deltas+(legacyGano?0n:1000n)));
  assert.equal(comparacion.coincide,false);
  assert.equal(comparacion.totalesCoinciden,false);
  assert.equal(comparacion.diferenciaVerificadoMenosLegado.flujoNetoMinor,
   Number(503500n+deltas+(legacyGano?0n:1000n)));
  assert.equal(comparacion.estado,"DIAGNOSTICO_NO_APTO_COMO_SALDO_BANCARIO");
  assert.equal((await consultar(String(usuarioId),intervalo)).fuente,
   "EVENTOS_COMPENSATORIOS_VERIFICADOS");
  // Prueba forense en base EFÍMERA: un movimiento de OTRO período
  // corrompido no puede pasar inadvertido en un resumen mensual válido.
  const [fueraDePeriodo]=await Movimiento.create([{
   usuarioId,cuentaId:cuenta._id,cuenta:cuenta.nombre,
   tipo:"GASTO",montoMinor:777,concepto:"Fuera de ventana",
   categoria:"Pruebas",fecha:new Date("2026-12-05T12:00:00.000Z"),
   estado:"ACTIVA",impactoCaja:true
  }]);
  await Movimiento.collection.updateOne({_id:fueraDePeriodo._id},
   {$set:{montoMinor:0}});
  await assert.rejects(()=>consultar(String(usuarioId),intervalo),
   e=>e.statusCode===409&&/importe histórico inválido/.test(e.message));
  await Movimiento.collection.updateOne({_id:fueraDePeriodo._id},
   {$set:{montoMinor:777}});
  assert.equal((await consultar(String(usuarioId),intervalo)).flujoNetoMinor,
   Number(-68500n+deltas+(legacyGano?0n:1000n)));
  // Suprimir un evento del extremo deja una cadena con hashes válidos, pero
  // el cursor revela el borrado: nunca devolver un flujo parcial.
  await Evento.collection.deleteOne({_id:eventos.at(-1)._id});
  await assert.rejects(()=>consultar(String(usuarioId),intervalo),
   e=>e.statusCode===409&&/cursor y eventos desincronizados/.test(e.message));
  assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,saldoPrevioHttp+500);

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
