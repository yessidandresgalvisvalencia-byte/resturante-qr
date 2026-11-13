"use strict";
const assert=require("node:assert/strict"),mongoose=require("mongoose"),crypto=require("node:crypto");
const retiro=require("../../../modules/finanzas-personales/services/retiroDeudaPersonal.service");
const patrimonio=require("../../../modules/finanzas-personales/services/patrimonioPersonal.service");
const P=require("../../../modules/finanzas-personales/models/prestamoPersonal.model"),E=require("../../../modules/finanzas-personales/models/retiroDeudaPersonal.model");
const C=require("../../../modules/finanzas-personales/models/cuentaFinanciera.model"),T=require("../../../modules/finanzas-personales/models/TransaccionPersonal"),O=require("../../../modules/finanzas-personales/models/outboxPersonal.model");
const {provisionarMongoPersonal}=require("../../../modules/finanzas-personales/security/provisionMongoPersonal.service");
const solicitud=()=>({confirmacion:true,solicitudId:crypto.randomUUID()});
async function preparar(estado="ACTIVO"){
 const usuarioId=new mongoose.Types.ObjectId(),fecha=new Date(Date.now()-3600000);
 const p=await P.create({usuarioId,direccion:"POR_PAGAR",contraparte:"Ensayo",concepto:"Retiro ficticio",principalMinor:1000,saldoMinor:1000,cuotaMinor:400,numeroCuotas:3,periodicidad:"MENSUAL",periodicidadConfirmada:true,diaPago:31,estado,fechaInicio:fecha,fechaVencimiento:new Date(Date.now()+86400000)});
 const c=await C.create({usuarioId,nombre:"Caja de ensayo",tipo:"EFECTIVO",saldoMinor:10000,saldoAnclaMinor:10000,saldoAnclaEn:fecha,saldoVerificadoEn:fecha,requiereReconciliacion:false});
 const foto=async()=>({p:await P.findById(p._id).lean(),c:await C.findById(c._id).lean(),t:await T.find({usuarioId}).lean(),e:await E.find({usuarioId}).sort({secuencia:1}).lean(),o:await O.find({usuarioId}).sort({_id:1}).lean()});
 return{usuarioId,p,c,foto,retirar:s=>patrimonio.retirarDeudaVisible(usuarioId,p._id,s),restaurar:s=>retiro.restaurar(usuarioId,p._id,s)};
}
async function probarRetiroDeudaAutorizado(db){
 for(const estado of ["ACTIVO","VENCIDO"]){
  const f=await preparar(estado),original=await f.foto(),s=solicitud();
  await assert.rejects(f.retirar({...s,confirmacion:false}),e=>e.statusCode===400);
  await assert.rejects(retiro.retirar(new mongoose.Types.ObjectId(),f.p._id,s),e=>e.statusCode===404);
  assert.deepEqual(await f.foto(),original);
  const carrera=await Promise.allSettled([f.retirar(s),f.retirar(s)]);assert.ok(carrera.some(x=>x.status==="fulfilled"));
  const r=await f.retirar(s),retirada=await f.foto();
  assert.equal(r.duplicado,true);assert.equal(r.vigente,true);assert.equal(retirada.e.length,1);
  assert.equal(retirada.p.estado,"CANCELADO");assert.equal(retirada.p.periodicidadConfirmada,false);
  assert.deepEqual(retirada.e[0].anterior,retiro.foto(original.p));assert.equal((await patrimonio.snapshot(f.usuarioId)).pasivosMinor,0);
  assert.deepEqual(retirada.c,original.c);assert.deepEqual(retirada.t,original.t);
  const restauracion={...solicitud(),retiroHash:r.hash};
  await assert.rejects(f.restaurar({...restauracion,retiroHash:"f".repeat(64)}),e=>e.statusCode===409);
  assert.deepEqual(await f.foto(),retirada);
  const intentos=await Promise.allSettled([f.restaurar(restauracion),f.restaurar(restauracion)]);assert.ok(intentos.some(x=>x.status==="fulfilled"));
  const restaurada=await f.foto();assert.deepEqual(retiro.foto(restaurada.p),retiro.foto(original.p));
  assert.deepEqual(restaurada.c,original.c);assert.deepEqual(restaurada.t,original.t);assert.equal(restaurada.e.length,2);
  assert.equal((await patrimonio.snapshot(f.usuarioId)).pasivosMinor,1000);
  assert.deepEqual(restaurada.e[0],retirada.e[0]);
  assert.equal((await f.restaurar(restauracion)).duplicado,true);assert.deepEqual(await f.foto(),restaurada);
  await patrimonio.corregirPrestamo(f.usuarioId,f.p._id,{diaPago:15,cuotaMinor:500},{confirmacion:true,solicitudId:crypto.randomUUID()});
  const segunda=await f.retirar(solicitud()),pendiente=await f.foto();
  assert.equal((await f.retirar(s)).vigente,false);assert.deepEqual(await f.foto(),pendiente);
  await assert.rejects(f.restaurar({...solicitud(),retiroHash:r.hash}),e=>e.statusCode===409);
  await f.restaurar({...solicitud(),retiroHash:segunda.hash});assert.equal((await P.findById(f.p._id)).diaPago,15);
  assert.equal((await P.findById(f.p._id)).cuotaMinor,500);
 }
 const legacy=await preparar("CANCELADO"),antesLegacy=await legacy.foto();
 await assert.rejects(legacy.restaurar({...solicitud(),retiroHash:"a".repeat(64)}),e=>e.statusCode===409);assert.deepEqual(await legacy.foto(),antesLegacy);
 const rollback=await preparar(),antes=await rollback.foto(),crear=O.create;O.create=async()=>{throw Error("Auditoría indisponible");};
 try{await assert.rejects(rollback.retirar(solicitud()),/Auditoría indisponible/);}finally{O.create=crear;}
 assert.deepEqual(await rollback.foto(),antes);
 const r=await rollback.retirar(solicitud()),cancelada=await rollback.foto();O.create=async()=>{throw Error("Auditoría indisponible");};
 try{await assert.rejects(rollback.restaurar({...solicitud(),retiroHash:r.hash}),/Auditoría indisponible/);}finally{O.create=crear;}
 assert.deepEqual(await rollback.foto(),cancelada);
 // Una modificación administrativa del registro cancelado no se sobreescribe.
 await db.collection(P.collection.collectionName).updateOne({_id:rollback.p._id},{$set:{diaPago:2}});
 const alterada=await rollback.foto();await assert.rejects(rollback.restaurar({...solicitud(),retiroHash:r.hash}),e=>e.statusCode===409);assert.deepEqual(await rollback.foto(),alterada);
 const indices=await preparar(),iAntes=await indices.foto();await db.collection(E.collection.collectionName).dropIndex("fp_retiro_solicitud_v1");
 await assert.rejects(indices.retirar(solicitud()),e=>e.statusCode===503);assert.deepEqual(await indices.foto(),iAntes);await provisionarMongoPersonal(db);
 const corrupcion=await preparar(),rc=await corrupcion.retirar(solicitud());
 await db.collection(E.collection.collectionName).updateOne({usuarioId:corrupcion.usuarioId},{$set:{"anterior.diaPago":2}});
 const corrompida=await corrupcion.foto();await assert.rejects(corrupcion.restaurar({...solicitud(),retiroHash:rc.hash}),e=>e.statusCode===409);assert.deepEqual(await corrupcion.foto(),corrompida);
 const vinculada=await preparar();await T.create({usuarioId:vinculada.usuarioId,prestamoId:vinculada.p._id,tipo:"PAGO_DEUDA",montoMinor:1,concepto:"Fuente ficticia",categoria:"Ensayo",fecha:new Date(),impactoCaja:false,estado:"ANULADA"});const vinculadaAntes=await vinculada.foto();
 await assert.rejects(vinculada.retirar(solicitud()),e=>e.statusCode===409);assert.deepEqual(await vinculada.foto(),vinculadaAntes);
 const pago=await preparar();const resultados=await Promise.allSettled([pago.retirar(solicitud()),patrimonio.pagarCuotaCredito(pago.usuarioId,{prestamoId:pago.p._id,cuentaId:pago.c._id,numeroCuota:1,montoPagadoRealMinor:400,modo:"CUENTA",externalId:crypto.randomUUID()})]);
 assert.equal(resultados.filter(x=>x.status==="fulfilled").length,1);const alFinal=await pago.foto();
 assert.equal(alFinal.c.saldoMinor,alFinal.p.estado==="CANCELADO"?10000:9600);assert.equal(alFinal.p.saldoMinor,alFinal.p.estado==="CANCELADO"?1000:600);
}
module.exports={probarRetiroDeudaAutorizado};
