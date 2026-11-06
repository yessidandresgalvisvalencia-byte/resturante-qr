"use strict";
const assert=require("node:assert/strict"),mongoose=require("mongoose"),crypto=require("node:crypto");
const service=require("../../../modules/finanzas-personales/services/creditoLegacyRecuperablePersonal.service");
const C=require("../../../modules/finanzas-personales/models/credito.model"),E=require("../../../modules/finanzas-personales/models/retiroCreditoLegacyPersonal.model");
const P=require("../../../modules/finanzas-personales/models/prestamoPersonal.model"),Cuenta=require("../../../modules/finanzas-personales/models/cuentaFinanciera.model");
const Tx=require("../../../modules/finanzas-personales/models/TransaccionPersonal"),O=require("../../../modules/finanzas-personales/models/outboxPersonal.model");
const {provisionarMongoPersonal}=require("../../../modules/finanzas-personales/security/provisionMongoPersonal.service");
const solicitud=()=>({confirmacion:true,solicitudId:crypto.randomUUID()});
async function preparar(activo=true){
 const userId=new mongoose.Types.ObjectId();const c=await C.create({userId,nombre:"Crédito ficticio",saldo:1200,tasaMensualPct:1.5,cuotaMensual:300,mesesRestantes:4,activo});
 await Cuenta.create({usuarioId:userId,nombre:"Caja ficticia",tipo:"EFECTIVO",saldoMinor:5000});
 const foto=async()=>({credito:await C.findById(c._id).lean(),cuentas:await Cuenta.find({usuarioId:userId}).lean(),prestamos:await P.find({usuarioId:userId}).sort({_id:1}).lean(),eventos:await E.find({usuarioId:userId}).sort({secuencia:1}).lean(),tx:await Tx.find({usuarioId:userId}).lean(),outbox:await O.find({usuarioId:userId}).sort({_id:1}).lean()});
 return{c,userId,foto,retirar:s=>service.retirar(userId,c._id,s),restaurar:s=>service.restaurar(userId,c._id,s),incorporar:s=>service.incorporar(userId,c._id,s)};
}
async function vincular(f,estado="ACTIVO",vinculo=true){return P.create({usuarioId:f.userId,legacyCreditoId:vinculo?f.c._id:null,direccion:"POR_PAGAR",contraparte:"Ensayo",concepto:f.c.nombre,principalMinor:1200,saldoMinor:estado==="PAGADO"?0:1200,cuotaMinor:300,fechaInicio:new Date(),estado});}
async function probarCreditoLegacyRecuperableAutorizado(db){
 const f=await preparar(),original=await f.foto(),retirar=solicitud();
 await assert.rejects(f.retirar({...retirar,confirmacion:false}),e=>e.statusCode===400);
 await assert.rejects(service.retirar(new mongoose.Types.ObjectId(),f.c._id,retirar),e=>e.statusCode===404);assert.deepEqual(await f.foto(),original);
 const intentos=await Promise.allSettled([f.retirar(retirar),f.retirar(retirar)]);assert.ok(intentos.some(x=>x.status==="fulfilled"));
 const r=await f.retirar(retirar),retirada=await f.foto();assert.equal(r.duplicado,true);assert.equal(retirada.credito.activo,false);assert.deepEqual(retirada.cuentas,original.cuentas);assert.deepEqual(retirada.tx,original.tx);assert.equal(retirada.eventos.length,1);
 const lista=await service.listar(f.userId);assert.equal(lista.creditos.length,0);assert.equal(lista.retirados[0].recuperacion.disponible,true);
 assert.equal((await service.listar(new mongoose.Types.ObjectId())).retirados.length,0);
 const restaurar={...solicitud(),retiroHash:r.hash};
 await assert.rejects(f.restaurar({...restaurar,retiroHash:"f".repeat(64)}),e=>e.statusCode===409);assert.deepEqual(await f.foto(),retirada);
 const recuperaciones=await Promise.allSettled([f.restaurar(restaurar),f.restaurar(restaurar)]);assert.ok(recuperaciones.some(x=>x.status==="fulfilled"));
 const restaurada=await f.foto();assert.deepEqual(service.foto(restaurada.credito),service.foto(original.credito));assert.deepEqual(restaurada.eventos[0],retirada.eventos[0]);
 assert.equal((await f.restaurar(restaurar)).duplicado,true);assert.deepEqual(await f.foto(),restaurada);
 const segundo=await f.retirar(solicitud()),segundafoto=await f.foto();assert.equal((await f.retirar(retirar)).vigente,false);assert.deepEqual(await f.foto(),segundafoto);
 await assert.rejects(f.restaurar({...solicitud(),retiroHash:r.hash}),e=>e.statusCode===409);await f.restaurar({...solicitud(),retiroHash:segundo.hash});
 const incorporar=solicitud();const inc=await Promise.allSettled([f.incorporar(incorporar),f.incorporar(incorporar)]);assert.ok(inc.some(x=>x.status==="fulfilled"));
 const recibo=await f.incorporar(incorporar),incorporada=await f.foto();assert.equal(incorporada.prestamos.length,1);assert.equal(String(incorporada.prestamos[0].legacyCreditoId),String(f.c._id));assert.equal(incorporada.prestamos[0].saldoMinor,1200);assert.equal(incorporada.prestamos[0].periodicidadConfirmada,false);assert.equal(incorporada.prestamos[0].fechaVencimiento,null);
 assert.deepEqual(incorporada.cuentas,original.cuentas);assert.deepEqual(incorporada.tx,original.tx);assert.equal(incorporada.eventos.at(-1).tipo,"INCORPORACION");assert.equal((await service.listar(f.userId)).retirados.length,0);
 await assert.rejects(f.restaurar({...solicitud(),retiroHash:recibo.hash}),e=>e.statusCode===409);await assert.rejects(f.incorporar(solicitud()),e=>e.statusCode===409);assert.deepEqual(await f.foto(),incorporada);
 await P.updateOne({_id:incorporada.prestamos[0]._id},{$set:{estado:"PAGADO",saldoMinor:0}});assert.equal((await f.incorporar(incorporar)).id,recibo.id);assert.equal(await P.countDocuments({usuarioId:f.userId}),1);
 await P.updateOne({_id:incorporada.prestamos[0]._id},{$set:{legacyCreditoId:null}});const vinculoCambiado=await f.foto();
 await assert.rejects(f.incorporar(incorporar),e=>e.statusCode===409);assert.deepEqual(await f.foto(),vinculoCambiado);
 assert.equal((await service.listar(f.userId)).retirados[0].recuperacion.disponible,false);
 for(const estado of ["ACTIVO","PAGADO","CANCELADO"]){
  const d=await preparar();await vincular(d,estado);const foto=await d.foto();await assert.rejects(d.incorporar(solicitud()),e=>e.statusCode===409);await assert.rejects(d.retirar(solicitud()),e=>e.statusCode===409);assert.deepEqual(await d.foto(),foto);
  const oculto=await preparar();const retiro=await oculto.retirar(solicitud());await vincular(oculto,estado);const antes=await oculto.foto();await assert.rejects(oculto.restaurar({...solicitud(),retiroHash:retiro.hash}),e=>e.statusCode===409);assert.deepEqual(await oculto.foto(),antes);
 }
 const similar=await preparar();await vincular(similar,"PAGADO",false);await assert.rejects(similar.incorporar(solicitud()),e=>e.statusCode===409);
 const viejo=await preparar(false),viejoAntes=await viejo.foto();assert.equal((await service.listar(viejo.userId)).retirados[0].recuperacion.disponible,false);await assert.rejects(viejo.restaurar({...solicitud(),retiroHash:"a".repeat(64)}),e=>e.statusCode===409);assert.deepEqual(await viejo.foto(),viejoAntes);
 const rollback=await preparar(),antes=await rollback.foto(),crear=O.create;O.create=async()=>{throw Error("Auditoría no disponible");};
 try{await assert.rejects(rollback.incorporar(solicitud()),/Auditoría no disponible/);}finally{O.create=crear;}assert.deepEqual(await rollback.foto(),antes);
 const rr=await rollback.retirar(solicitud()),cancelada=await rollback.foto();O.create=async()=>{throw Error("Auditoría no disponible");};
 try{await assert.rejects(rollback.restaurar({...solicitud(),retiroHash:rr.hash}),/Auditoría no disponible/);}finally{O.create=crear;}assert.deepEqual(await rollback.foto(),cancelada);
 await db.collection(C.collection.collectionName).updateOne({_id:rollback.c._id},{$set:{saldo:1300}});const modificada=await rollback.foto();await assert.rejects(rollback.restaurar({...solicitud(),retiroHash:rr.hash}),e=>e.statusCode===409);assert.deepEqual(await rollback.foto(),modificada);
 const corrupta=await preparar(),rc=await corrupta.retirar(solicitud());await db.collection(E.collection.collectionName).updateOne({usuarioId:corrupta.userId},{$set:{"anterior.saldo":1}});const fotoCorrupta=await corrupta.foto();assert.equal((await service.listar(corrupta.userId)).retirados[0].recuperacion.disponible,false);await assert.rejects(corrupta.restaurar({...solicitud(),retiroHash:rc.hash}),e=>e.statusCode===409);assert.deepEqual(await corrupta.foto(),fotoCorrupta);
 const indices=await preparar(),fotoIndices=await indices.foto();
 for(const [coleccion,nombre] of [[E.collection.collectionName,"fp_legacy_ciclo_solicitud_v1"],[P.collection.collectionName,"usuarioId_1_legacyCreditoId_1"]]){
  await db.collection(coleccion).dropIndex(nombre);await assert.rejects(indices.incorporar(solicitud()),e=>e.statusCode===503);assert.deepEqual(await indices.foto(),fotoIndices);await provisionarMongoPersonal(db);
 }
 const tipado=await preparar();await db.collection(C.collection.collectionName).updateOne({_id:tipado.c._id},{$set:{saldo:"1200"}});const tipoAntes=await tipado.foto();
 await assert.rejects(tipado.incorporar(solicitud()),e=>e.statusCode===422);assert.deepEqual(await tipado.foto(),tipoAntes);
 const rt=await tipado.retirar(solicitud());assert.equal((await tipado.foto()).eventos[0].anterior.saldo,"1200");await tipado.restaurar({...solicitud(),retiroHash:rt.hash});assert.equal((await tipado.foto()).credito.saldo,"1200");
 const carrera=await preparar();const resultados=await Promise.allSettled([carrera.retirar(solicitud()),carrera.incorporar(solicitud())]);assert.equal(resultados.filter(x=>x.status==="fulfilled").length,1);const final=await carrera.foto();assert.equal(final.eventos.length,1);assert.equal(final.prestamos.length,final.eventos[0].tipo==="INCORPORACION"?1:0);assert.equal(final.credito.activo,false);assert.equal(final.cuentas[0].saldoMinor,5000);assert.equal(final.tx.length,0);
}
module.exports={probarCreditoLegacyRecuperableAutorizado};
