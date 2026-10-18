"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const crypto=require("node:crypto");
const Movimiento=require("../../modules/finanzas-personales/models/TransaccionPersonal");
const Cuenta=require("../../modules/finanzas-personales/models/cuentaFinanciera.model");
const Vinculo=require("../../modules/finanzas-personales/models/vinculoHistoricoV81.model");
const {confirmarVinculoHistoricoV81}=require("../../modules/finanzas-personales/services/confirmarVinculoHistoricoV81.service");
const {diagnosticarVinculosHistoricosV81}=require("../../modules/finanzas-personales/services/diagnosticoVinculosHistoricosV81.service");
const {conciliarHistoricoCuentaV81}=require("../../modules/finanzas-personales/services/conciliacionHistoricoCuentaV81.service");

function exigirMongoAislado(uri,confirmacion){
 if(confirmacion!=="SOLO_PRUEBAS_LOCALES")throw new Error("CONFIRMACION_DB_PRUEBAS_REQUERIDA");
 let u;
 try{u=new URL(uri);}catch{throw new Error("TEST_MONGO_URI_INVALIDA");}
 if(u.protocol!=="mongodb:"||!["127.0.0.1","[::1]"].includes(u.hostname)||
  !u.port||u.host.includes(",")||u.searchParams.get("directConnection")!=="true")
  throw new Error("MONGO_PRUEBAS_NO_LOCAL");
 return true;
}
const uri=process.env.TEST_MONGO_URI;
test("Mongo local: dos confirmaciones idénticas crean exactamente un vínculo",{
 skip:!uri,timeout:60000
},async()=>{
 exigirMongoAislado(uri,process.env.GRUK_TEST_DB_CONFIRM);
 const secretAnterior=process.env.PERSONAL_IDEMPOTENCY_SECRET;
 // Base exclusiva por ejecución; nunca reutilizar colecciones anteriores.
 const baseTemporal="gruk_v81_test_"+crypto.randomUUID().replace(/-/g,"");
 process.env.PERSONAL_IDEMPOTENCY_SECRET="SOLO_PRUEBAS_INTEGRACION_"+crypto.randomUUID();
 try{
  await mongoose.connect(uri,{dbName:baseTemporal,serverSelectionTimeoutMS:5000});
  // createIndexes jamás borra índices existentes. Todos los documentos usan
  // identidades nuevas y no contienen información personal real.
  await Vinculo.createIndexes();
  await Movimiento.createIndexes();
  const indicesMovimientos=await Movimiento.collection.indexes();
  for(const [nombre,clave] of [
   ["fp_conciliacion_cuenta_periodo_v81",{usuarioId:1,cuentaId:1,fecha:1}],
   ["fp_conciliacion_huerfanos_periodo_v81",{usuarioId:1,cuentaId:1,cuenta:1,fecha:1}]
  ]){
   const indice=indicesMovimientos.find(x=>x.name===nombre);
   assert.ok(indice,"Índice Mongo de conciliación ausente: "+nombre);
   assert.deepEqual(indice.key,clave);
  }
  const usuarioId=new mongoose.Types.ObjectId();
  const [cuenta]=await Cuenta.create([{usuarioId,nombre:"PRUEBA_"+crypto.randomUUID(),tipo:"EFECTIVO",moneda:"COP",saldoMinor:0}]);
  const [movimiento]=await Movimiento.create([{usuarioId,cuentaId:null,tipo:"GASTO",
   concepto:"Evidencia controlada",categoria:"PRUEBA",cuenta:cuenta.nombre,medioPago:"EFECTIVO",
   montoMinor:100,moneda:"COP",fecha:new Date("2025-01-15T12:00:00Z")}]);
  const antes=await Cuenta.findById(cuenta._id).lean();
  const operacion={movimientoId:String(movimiento._id),cuentaId:String(cuenta._id),
   evidencia:"Extracto bancario de prueba certificado",idempotencyKey:crypto.randomUUID(),confirmacionExplicita:true};
  const promesas=await Promise.allSettled([
   confirmarVinculoHistoricoV81(String(usuarioId),operacion),
   confirmarVinculoHistoricoV81(String(usuarioId),operacion)
  ]);
  // Un conflicto transitorio de MongoDB no autoriza insertar por segunda vez.
  for(const resultado of promesas)if(resultado.status==="rejected")
   assert.ok([409,503].includes(resultado.reason.statusCode),String(resultado.reason));
  // Ambos procesos pueden recibir 503 por WriteConflict o commit incierto.
  // Reintentar la MISMA clave permite comprobar el resultado sin crear duplicados.
  if(!promesas.some(x=>x.status==="fulfilled")){
   let confirmado=false;
   for(let intento=0;intento<4&&!confirmado;intento++){
    try{
     const r=await confirmarVinculoHistoricoV81(String(usuarioId),operacion);
     confirmado=r.confirmado===true;
    }catch(e){
     if(e.statusCode!==503)throw e;
    }
   }
   assert.equal(confirmado,true,"No hubo confirmación tras reintentos 503");
  }
  assert.equal(await Vinculo.countDocuments({usuarioId,movimientoId:movimiento._id}),1);
  const repeticion=await confirmarVinculoHistoricoV81(String(usuarioId),operacion);
  assert.equal(repeticion.yaExistia,true);
  const repeticionMayusculas=await confirmarVinculoHistoricoV81(String(usuarioId),{
   ...operacion,idempotencyKey:operacion.idempotencyKey.toUpperCase()
  });
  assert.equal(repeticionMayusculas.yaExistia,true);
  const contrario=await Promise.allSettled([
   confirmarVinculoHistoricoV81(String(usuarioId),{...operacion,idempotencyKey:crypto.randomUUID()}),
   confirmarVinculoHistoricoV81(String(usuarioId),{...operacion,evidencia:"Otra evidencia controlada",idempotencyKey:crypto.randomUUID()})
  ]);
  assert.ok(contrario.every(x=>x.status==="rejected"&&x.reason.statusCode===409));
  assert.equal(await Vinculo.countDocuments({usuarioId,movimientoId:movimiento._id}),1);
  const despues=await Cuenta.findById(cuenta._id).lean();
  const txDespues=await Movimiento.findById(movimiento._id).lean();
  assert.equal(despues.saldoMinor,antes.saldoMinor);
  assert.equal(txDespues.montoMinor,100);
  assert.equal(txDespues.cuentaId,null);
  // Dos cuentas del mismo usuario reclaman a la vez otro asiento heredado.
  const cuentaAlterna=await Cuenta.create({usuarioId,nombre:"PRUEBA_ALTERNA_"+crypto.randomUUID(),
   tipo:"EFECTIVO",moneda:"COP",saldoMinor:0});
  const segundo=await Movimiento.create({usuarioId,cuentaId:null,tipo:"GASTO",
   concepto:"Movimiento de concurrencia",categoria:"PRUEBA",cuenta:cuenta.nombre,
   medioPago:"EFECTIVO",montoMinor:250,moneda:"COP",fecha:new Date("2025-01-16T12:00:00Z")});
  const solicitud={...operacion,movimientoId:String(segundo._id),
   idempotencyKey:crypto.randomUUID()};
  const disputa=await Promise.allSettled([
   confirmarVinculoHistoricoV81(String(usuarioId),solicitud),
   confirmarVinculoHistoricoV81(String(usuarioId),{
    ...solicitud,cuentaId:String(cuentaAlterna._id),idempotencyKey:crypto.randomUUID()
   })
  ]);
  assert.ok(disputa.filter(x=>x.status==="fulfilled").length<=1,
   "Dos cuentas confirmaron simultáneamente el mismo movimiento");
  for(const r of disputa)if(r.status==="rejected")
   assert.ok([409,503].includes(r.reason.statusCode),String(r.reason));
  if(await Vinculo.countDocuments({usuarioId,movimientoId:segundo._id})===0){
   let confirmado=false;
   for(let intento=0;intento<4&&!confirmado;intento++){
    try{
     const r=await confirmarVinculoHistoricoV81(String(usuarioId),solicitud);
     confirmado=r.confirmado===true;
    }catch(e){
     if(e.statusCode!==503)throw e;
    }
   }
   assert.equal(confirmado,true,"Ninguna cuenta obtuvo confirmación tras reintentos 503");
  }
  assert.equal(await Vinculo.countDocuments({usuarioId,movimientoId:segundo._id}),1);
  const evidencia=await Vinculo.findOne({usuarioId,movimientoId:segundo._id}).lean();
  assert.ok([String(cuenta._id),String(cuentaAlterna._id)].includes(String(evidencia.cuentaId)));
  assert.equal((await Movimiento.findById(segundo._id).lean()).cuentaId,null);
  assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,antes.saldoMinor);
  assert.equal((await Cuenta.findById(cuentaAlterna._id).lean()).saldoMinor,0);
  // El diagnóstico debe reconocer ambos vínculos inmutables, no sugerir otro.
  const diagnostico=await diagnosticarVinculosHistoricosV81(String(usuarioId));
  for(const id of [movimiento._id,segundo._id]){
   const item=diagnostico.movimientos.find(m=>m.movimientoId===String(id));
   assert.equal(item?.estado,"CONFIRMADO");
  }
  // El mismo nombre histórico NO puede bloquear la cuenta a la que un
  // movimiento se vinculó expresamente, ni contaminar la cuenta original.
  const periodo={usuarioId:String(usuarioId),desde:"2025-01-01",
   hastaExclusivo:"2025-02-01",saldoInicialCentavos:0n};
  const segundoEnOriginal=String(evidencia.cuentaId)===String(cuenta._id);
  const original=await conciliarHistoricoCuentaV81({...periodo,cuentaId:String(cuenta._id),
   saldoObservadoCentavos:segundoEnOriginal?-35000n:-10000n});
  assert.equal(original.estado,"CONCILIADA");
  assert.equal(original.movimientosEvaluados,segundoEnOriginal?2:1);
  const alterna=await conciliarHistoricoCuentaV81({...periodo,cuentaId:String(cuentaAlterna._id),
   saldoObservadoCentavos:segundoEnOriginal?0n:-25000n});
  assert.equal(alterna.estado,"CONCILIADA");
  assert.equal(alterna.movimientosEvaluados,segundoEnOriginal?0:1);
  // Sin prueba individual de vínculo, un tercer movimiento debe bloquear.
  const pendiente=await Movimiento.create({usuarioId,cuentaId:null,tipo:"GASTO",
   concepto:"Pendiente intencional",categoria:"PRUEBA",cuenta:cuenta.nombre,
   medioPago:"EFECTIVO",montoMinor:75,moneda:"COP",fecha:new Date("2025-01-17T12:00:00Z")});
  await assert.rejects(()=>conciliarHistoricoCuentaV81({...periodo,
   cuentaId:String(cuenta._id),saldoObservadoCentavos:-999999n}),
   error=>error.statusCode===409);
  const diagnosticoPendiente=await diagnosticarVinculosHistoricosV81(String(usuarioId));
  assert.equal(diagnosticoPendiente.movimientos.find(x=>x.movimientoId===String(pendiente._id))?.estado,
   "REQUIERE_CONFIRMACION");
  const pagina1=await diagnosticarVinculosHistoricosV81(String(usuarioId),{limite:2});
  assert.equal(pagina1.movimientos.length,2);
  assert.equal(pagina1.truncado,true);
  assert.ok(pagina1.siguienteCursor);
  const pagina2=await diagnosticarVinculosHistoricosV81(String(usuarioId),{
   limite:2,cursor:pagina1.siguienteCursor
  });
  assert.equal(pagina2.movimientos.length,1);
  assert.equal(pagina2.truncado,false);
  assert.equal(pagina2.siguienteCursor,null);
  assert.deepEqual(
   [...pagina1.movimientos,...pagina2.movimientos].map(x=>x.movimientoId),
   diagnosticoPendiente.movimientos.map(x=>x.movimientoId)
  );
  // Multitenencia: una segunda identidad con el mismo nombre de cuenta no
  // hereda ni puede confirmar los movimientos del usuario anterior.
  const otroUsuarioId=new mongoose.Types.ObjectId();
  const otraCuenta=await Cuenta.create({usuarioId:otroUsuarioId,nombre:cuenta.nombre,
   tipo:"EFECTIVO",moneda:"COP",saldoMinor:0});
  const diagnosticoAjeno=await diagnosticarVinculosHistoricosV81(String(otroUsuarioId));
  assert.deepEqual(diagnosticoAjeno.movimientos,[]);
  assert.equal(diagnosticoAjeno.siguienteCursor,null);
  const paginaAjenaConCursor=await diagnosticarVinculosHistoricosV81(String(otroUsuarioId),{
   limite:1,cursor:pagina1.siguienteCursor
  });
  assert.deepEqual(paginaAjenaConCursor.movimientos,[]);
  await assert.rejects(()=>conciliarHistoricoCuentaV81({
   ...periodo,usuarioId:String(otroUsuarioId),cuentaId:String(cuenta._id),
   saldoObservadoCentavos:0n
  }),e=>e.statusCode===404);
  await assert.rejects(()=>confirmarVinculoHistoricoV81(String(otroUsuarioId),{
   ...operacion,cuentaId:String(otraCuenta._id),idempotencyKey:crypto.randomUUID()
  }),e=>e.statusCode===404);
  await assert.rejects(()=>confirmarVinculoHistoricoV81(String(usuarioId),{
   ...operacion,movimientoId:String(pendiente._id),cuentaId:String(otraCuenta._id),
   idempotencyKey:crypto.randomUUID()
  }),e=>e.statusCode===404);
  assert.equal(await Vinculo.countDocuments({usuarioId:otroUsuarioId}),0);
  assert.equal((await Cuenta.findById(otraCuenta._id).lean()).saldoMinor,0);
  // Compatibilidad: vínculo escrito por la versión anterior con UUID en
  // mayúsculas debe responder como reintento, jamás producir otro INSERT.
  const legado=await Movimiento.create({usuarioId,cuentaId:null,tipo:"GASTO",
   concepto:"Vínculo previo mayúsculas",categoria:"PRUEBA",cuenta:cuenta.nombre,
   medioPago:"EFECTIVO",montoMinor:90,moneda:"COP",fecha:new Date("2025-01-18T12:00:00Z")});
  const claveLegada=crypto.randomUUID().toUpperCase();
  const evidenciaLegada="Documento bancario histórico controlado";
  const hashLegado=crypto.createHmac("sha256",process.env.PERSONAL_IDEMPOTENCY_SECRET)
   .update(String(usuarioId)+":"+claveLegada).digest("hex");
  await Vinculo.create({usuarioId,movimientoId:legado._id,cuentaId:cuenta._id,
   evidencia:evidenciaLegada,idempotencyKeyHash:hashLegado});
  const reintentoLegado=await confirmarVinculoHistoricoV81(String(usuarioId),{
   movimientoId:String(legado._id),cuentaId:String(cuenta._id),
   evidencia:evidenciaLegada,idempotencyKey:claveLegada.toLowerCase(),
   confirmacionExplicita:true
  });
  assert.equal(reintentoLegado.yaExistia,true);
  assert.equal(await Vinculo.countDocuments({usuarioId,movimientoId:legado._id}),1);
  assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,antes.saldoMinor);
  // Regresión del JOIN temporal: vinculaciones válidas fuera de enero
  // no deben aparecer ni alterar el saldo conciliado de enero.
  for(const fechaFuera of ["2024-12-15T12:00:00Z","2025-02-15T12:00:00Z"]){
   const fuera=await Movimiento.create({usuarioId,cuentaId:null,tipo:"GASTO",
    concepto:"Fuera del corte de conciliación",categoria:"PRUEBA",
    cuenta:cuentaAlterna.nombre,medioPago:"EFECTIVO",montoMinor:125,
    moneda:"COP",fecha:new Date(fechaFuera)});
   const clave=crypto.randomUUID();
   const hash=crypto.createHmac("sha256",process.env.PERSONAL_IDEMPOTENCY_SECRET)
    .update(String(usuarioId)+":"+clave).digest("hex");
   await Vinculo.create({usuarioId,movimientoId:fuera._id,cuentaId:cuentaAlterna._id,
    evidencia:"Vínculo fuera del período de prueba",idempotencyKeyHash:hash});
  }
  const eneroAlEnlazarOtrosMeses=await conciliarHistoricoCuentaV81({
   ...periodo,cuentaId:String(cuentaAlterna._id),
   saldoObservadoCentavos:segundoEnOriginal?0n:-25000n
  });
  assert.equal(eneroAlEnlazarOtrosMeses.estado,"CONCILIADA");
  assert.equal(eneroAlEnlazarOtrosMeses.movimientosEvaluados,segundoEnOriginal?0:1);
  assert.equal((await Cuenta.findById(cuentaAlterna._id).lean()).saldoMinor,0);
  console.log("[GRUK_V81_MONGO_INTEGRACION] VINCULOS_OK");
 }finally{
  try{
   // Destruir SOLAMENTE la base efímera cuyo nombre generó esta prueba.
   // Nunca se ejecuta sobre el URI de producción o una base preexistente.
   if(mongoose.connection.readyState===1&&
      mongoose.connection.db?.databaseName===baseTemporal)
    await mongoose.connection.dropDatabase();
  }finally{
   await mongoose.disconnect();
   if(secretAnterior===undefined)delete process.env.PERSONAL_IDEMPOTENCY_SECRET;
   else process.env.PERSONAL_IDEMPOTENCY_SECRET=secretAnterior;
  }
 }
});
test("las pruebas integradas requieren destino Mongo local explícito",()=>{
 assert.throws(()=>exigirMongoAislado("mongodb+srv://example.org/db","SOLO_PRUEBAS_LOCALES"));
 assert.throws(()=>exigirMongoAislado("mongodb://127.0.0.1:27017/?directConnection=true","SIN_CONFIRMACION"));
 assert.doesNotThrow(()=>exigirMongoAislado("mongodb://127.0.0.1:27017/?directConnection=true","SOLO_PRUEBAS_LOCALES"));
});
