"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Prestamo=require("../../modules/finanzas-personales/models/prestamoPersonal.model");
const Transaccion=require("../../modules/finanzas-personales/models/TransaccionPersonal");
const Cuenta=require("../../modules/finanzas-personales/models/cuentaFinanciera.model");
const patrimonio=require("../../modules/finanzas-personales/services/patrimonioPersonal.service");

test("cobro parcial es atomico, idempotente y aislado por usuario (MongoDB replica set)",async t=>{
 const uri=process.env.GRUK_TEST_MONGODB_URI;
 if(!uri){t.skip("Configurar GRUK_TEST_MONGODB_URI de replica set aislado");return;}
 const originalSecret=process.env.PERSONAL_IDEMPOTENCY_SECRET;
 process.env.PERSONAL_IDEMPOTENCY_SECRET=originalSecret||"test-only-secret-not-for-production";
 await mongoose.connect(uri,{serverSelectionTimeoutMS:8000});
 const usuarioId=new mongoose.Types.ObjectId(),otroUsuario=new mongoose.Types.ObjectId();
 const contraparte="test-cobro-"+new mongoose.Types.ObjectId().toString();
 try{
  await Promise.all([Prestamo.init(),Transaccion.init(),Cuenta.init()]);
  const prestamo=await Prestamo.create({usuarioId,direccion:"POR_COBRAR",origenCuentaPorCobrar:"TRABAJO",contraparte,concepto:"Servicio profesional",principalMinor:500000,saldoMinor:500000,fechaInicio:new Date()});
  const request={prestamoId:prestamo._id,montoMinor:200000,externalId:require("node:crypto").randomUUID()};
  const primer=await patrimonio.cobrarCuentaPorCobrar(usuarioId,request);
  assert.equal(primer.duplicado,false);
  const repetido=await patrimonio.cobrarCuentaPorCobrar(usuarioId,request);
  assert.equal(repetido.duplicado,true);
  await assert.rejects(()=>patrimonio.cobrarCuentaPorCobrar(otroUsuario,{...request,externalId:require("node:crypto").randomUUID()}));
  const concurrentKey=require("node:crypto").randomUUID();
  const concurrentRequests=await Promise.allSettled([
   patrimonio.cobrarCuentaPorCobrar(usuarioId,{prestamoId:prestamo._id,montoMinor:50000,externalId:concurrentKey}),
   patrimonio.cobrarCuentaPorCobrar(usuarioId,{prestamoId:prestamo._id,montoMinor:50000,externalId:concurrentKey})
  ]);
  assert.ok(concurrentRequests.some(x=>x.status==="fulfilled"),"Al menos un cobro concurrente debe completarse");
  for(const result of concurrentRequests){if(result.status==="rejected")assert.ok(result.reason?.code===11000||result.reason?.hasErrorLabel?.("TransientTransactionError")||result.reason?.statusCode===409,"Solo se admiten conflictos de concurrencia esperados");}
  const actualizado=await Prestamo.findById(prestamo._id);
  assert.equal(actualizado.saldoMinor,250000);
  assert.equal(await Transaccion.countDocuments({usuarioId,prestamoId:prestamo._id,tipo:"COBRO_PRESTAMO"}),2);
  const cuenta=await Cuenta.findOne({usuarioId,nombre:"EFECTIVO"});
  assert.equal(cuenta.saldoMinor,250000);
  const snap=await patrimonio.snapshot(usuarioId);
  assert.equal(snap.cuentasPorCobrarMinor,250000);
 }finally{
  await Promise.all([Prestamo.deleteMany({usuarioId,contraparte}),Transaccion.deleteMany({usuarioId,contraparte}),Cuenta.deleteMany({usuarioId,nombre:"EFECTIVO"})]);
  await mongoose.disconnect();
  if(originalSecret===undefined)delete process.env.PERSONAL_IDEMPOTENCY_SECRET;
 }
});
