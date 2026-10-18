"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const crypto=require("node:crypto");
const Movimiento=require("../../modules/finanzas-personales/models/TransaccionPersonal");
const Cuenta=require("../../modules/finanzas-personales/models/cuentaFinanciera.model");
const Vinculo=require("../../modules/finanzas-personales/models/vinculoHistoricoV81.model");
const {confirmarVinculoHistoricoV81}=require("../../modules/finanzas-personales/services/confirmarVinculoHistoricoV81.service");

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
 skip:!uri,timeout:20000
},async()=>{
 exigirMongoAislado(uri,process.env.GRUK_TEST_DB_CONFIRM);
 const secretAnterior=process.env.PERSONAL_IDEMPOTENCY_SECRET;
 process.env.PERSONAL_IDEMPOTENCY_SECRET="SOLO_PRUEBAS_INTEGRACION_"+crypto.randomUUID();
 try{
  await mongoose.connect(uri,{dbName:"gruk_v81_vinculos_concurrencia",serverSelectionTimeoutMS:5000});
  // createIndexes jamás borra índices existentes. Todos los documentos usan
  // identidades nuevas y no contienen información personal real.
  await Vinculo.createIndexes();
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
  assert.ok(promesas.some(x=>x.status==="fulfilled"));
  for(const resultado of promesas)if(resultado.status==="rejected")
   assert.ok([409,503].includes(resultado.reason.statusCode),String(resultado.reason));
  assert.equal(await Vinculo.countDocuments({usuarioId,movimientoId:movimiento._id}),1);
  const repeticion=await confirmarVinculoHistoricoV81(String(usuarioId),operacion);
  assert.equal(repeticion.yaExistia,true);
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
  assert.equal(disputa.filter(x=>x.status==="fulfilled").length,1);
  assert.equal(await Vinculo.countDocuments({usuarioId,movimientoId:segundo._id}),1);
  const evidencia=await Vinculo.findOne({usuarioId,movimientoId:segundo._id}).lean();
  assert.ok([String(cuenta._id),String(cuentaAlterna._id)].includes(String(evidencia.cuentaId)));
  assert.equal((await Movimiento.findById(segundo._id).lean()).cuentaId,null);
  assert.equal((await Cuenta.findById(cuenta._id).lean()).saldoMinor,antes.saldoMinor);
  assert.equal((await Cuenta.findById(cuentaAlterna._id).lean()).saldoMinor,0);
 }finally{
  await mongoose.disconnect();
  if(secretAnterior===undefined)delete process.env.PERSONAL_IDEMPOTENCY_SECRET;
  else process.env.PERSONAL_IDEMPOTENCY_SECRET=secretAnterior;
 }
});
test("las pruebas integradas requieren destino Mongo local explícito",()=>{
 assert.throws(()=>exigirMongoAislado("mongodb+srv://example.org/db","SOLO_PRUEBAS_LOCALES"));
 assert.throws(()=>exigirMongoAislado("mongodb://127.0.0.1:27017/?directConnection=true","SIN_CONFIRMACION"));
 assert.doesNotThrow(()=>exigirMongoAislado("mongodb://127.0.0.1:27017/?directConnection=true","SOLO_PRUEBAS_LOCALES"));
});
