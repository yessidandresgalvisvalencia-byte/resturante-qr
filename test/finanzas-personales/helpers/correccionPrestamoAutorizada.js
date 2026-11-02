"use strict";
const assert=require("node:assert/strict"),mongoose=require("mongoose"),crypto=require("node:crypto");
const patrimonio=require("../../../modules/finanzas-personales/services/patrimonioPersonal.service"),historial=require("../../../modules/finanzas-personales/services/correccionPrestamoPersonal.service");
const P=require("../../../modules/finanzas-personales/models/prestamoPersonal.model"),E=require("../../../modules/finanzas-personales/models/correccionPrestamoPersonal.model");
const C=require("../../../modules/finanzas-personales/models/cuentaFinanciera.model"),Tx=require("../../../modules/finanzas-personales/models/TransaccionPersonal"),O=require("../../../modules/finanzas-personales/models/outboxPersonal.model"),Comp=require("../../../modules/finanzas-personales/models/EventoCompensatorioPersonal"),Cursor=require("../../../modules/finanzas-personales/models/CursorCompensacionPersonal");
const {provisionarMongoPersonal}=require("../../../modules/finanzas-personales/security/provisionMongoPersonal.service");
const solicitud=()=>({confirmacion:true,solicitudId:crypto.randomUUID()});
async function preparar(direccion="POR_PAGAR"){
 const usuarioId=new mongoose.Types.ObjectId(),fecha=new Date(Date.now()-3600000),p=await P.create({usuarioId,direccion,contraparte:"Ensayo",concepto:"Préstamo ficticio",principalMinor:1000,saldoMinor:1000,cuotaMinor:400,numeroCuotas:3,periodicidad:"MENSUAL",periodicidadConfirmada:true,fechaInicio:fecha,fechaVencimiento:new Date(Date.now()+86400000)});
 const c=await C.create({usuarioId,nombre:"Caja de ensayo",tipo:"EFECTIVO",saldoMinor:10000,saldoAnclaMinor:10000,saldoAnclaEn:fecha,saldoVerificadoEn:fecha,requiereReconciliacion:false});
 const foto=async()=>({p:await P.findById(p._id).lean(),c:await C.findById(c._id).lean(),tx:await Tx.find({usuarioId}).sort({_id:1}).lean(),e:await E.find({usuarioId}).sort({secuencia:1}).lean(),comp:await Comp.find({usuarioId:String(usuarioId)}).sort({secuencia:1}).lean(),cursor:await Cursor.findById(String(usuarioId)).lean(),o:await O.find({usuarioId}).sort({_id:1}).lean()});
 return{usuarioId,p,c,foto,corregir:(c,s)=>patrimonio.corregirPrestamo(usuarioId,p._id,c,s)};
}
async function probarCorreccionPrestamoAutorizada(db){
 const f=await preparar(),original=await f.foto(),s=solicitud(),cambios={principalMinor:1200,cuotaMinor:200};
 await assert.rejects(f.corregir(cambios,{...s,confirmacion:false}),e=>e.statusCode===400);
 await assert.rejects(patrimonio.corregirPrestamo(new mongoose.Types.ObjectId(),f.p._id,cambios,s),e=>e.statusCode===404);
 for(const c of [{principalMinor:1.5},{principalMinor:0},{cuotaMinor:-1},{saldoMinor:1}])await assert.rejects(f.corregir(c,s),e=>e.statusCode===422);assert.deepEqual(await f.foto(),original);
 const intentos=await Promise.allSettled([f.corregir(cambios,s),f.corregir(cambios,s)]);assert.ok(intentos.some(x=>x.status==="fulfilled"));
 const replay=await f.corregir(cambios,s),foto=await f.foto();assert.equal(replay.correccion.duplicado,true);assert.equal(replay.correccion.vigente,true);assert.equal(foto.e.length,1);
 assert.equal(foto.p.principalMinor,1200);assert.equal(foto.p.saldoMinor,1200);assert.deepEqual(foto.e[0].anterior,historial.foto(original.p));assert.deepEqual(foto.e[0].posterior,historial.foto(foto.p));assert.deepEqual(foto.c,original.c);assert.deepEqual(foto.tx,original.tx);
 await assert.rejects(f.corregir({principalMinor:1300},s),e=>e.statusCode===409);assert.deepEqual(await f.foto(),foto);
 await f.corregir({concepto:"Concepto aclarado"},solicitud());const segunda=await f.foto();assert.deepEqual(segunda.e[0],foto.e[0]);assert.equal((await f.corregir(cambios,s)).correccion.vigente,false);assert.deepEqual(await f.foto(),segunda);
 const historia=await historial.historial(f.usuarioId,f.p._id);assert.equal(historia.eventos.length,2);assert.equal(historia.certificaHistoriaCompleta,false);await assert.rejects(historial.historial(new mongoose.Types.ObjectId(),f.p._id),e=>e.statusCode===404);
 const rollback=await preparar(),antes=await rollback.foto(),crear=O.create;O.create=async()=>{throw Error("Auditoría interrumpida");};
 try{await assert.rejects(rollback.corregir({principalMinor:2000},solicitud()),/Auditoría interrumpida/);}finally{O.create=crear;}assert.deepEqual(await rollback.foto(),antes);
 const reclass=await preparar("POR_COBRAR");await patrimonio.cobrarCuentaPorCobrar(reclass.usuarioId,{prestamoId:reclass.p._id,montoMinor:400,cuentaId:reclass.c._id,externalId:crypto.randomUUID()});
 const rAntes=await reclass.foto();O.create=async()=>{throw Error("Auditoría interrumpida");};
 try{await assert.rejects(reclass.corregir({origenCuentaPorCobrar:"TRABAJO"},solicitud()),/Auditoría interrumpida/);}finally{O.create=crear;}assert.deepEqual(await reclass.foto(),rAntes);
 const origen=solicitud();await reclass.corregir({origenCuentaPorCobrar:"TRABAJO"},origen);const rDespues=await reclass.foto();assert.deepEqual(rDespues.tx,rAntes.tx);assert.deepEqual(rDespues.c,rAntes.c);assert.equal(rDespues.p.saldoMinor,600);assert.equal(rDespues.e.length,1);assert.equal(rDespues.comp.length,1);
 await reclass.corregir({origenCuentaPorCobrar:"TRABAJO"},origen);assert.deepEqual(await reclass.foto(),rDespues);
 const indice=await preparar(),iAntes=await indice.foto();await db.collection(E.collection.collectionName).dropIndex("fp_correccion_prestamo_solicitud_v1");await assert.rejects(indice.corregir({concepto:"Otro"},solicitud()),e=>e.statusCode===503);assert.deepEqual(await indice.foto(),iAntes);await provisionarMongoPersonal(db);
 await db.collection(E.collection.collectionName).updateOne({usuarioId:f.usuarioId,secuencia:1},{$set:{"anterior.principalMinor":1}});const corrupta=await f.foto();await assert.rejects(f.corregir(cambios,s),e=>e.statusCode===409);await assert.rejects(f.corregir({concepto:"Más"},solicitud()),e=>e.statusCode===409);await assert.rejects(historial.historial(f.usuarioId,f.p._id),e=>e.statusCode===409);assert.deepEqual(await f.foto(),corrupta);
 const carrera=await preparar(),sol=solicitud(),pago={prestamoId:carrera.p._id,cuentaId:carrera.c._id,numeroCuota:1,montoPagadoRealMinor:400,modo:"CUENTA",externalId:crypto.randomUUID()};
 await Promise.allSettled([carrera.corregir({principalMinor:1200},sol),patrimonio.pagarCuotaCredito(carrera.usuarioId,pago)]);
 await carrera.corregir({principalMinor:1200},sol);await patrimonio.pagarCuotaCredito(carrera.usuarioId,pago);const final=await carrera.foto();assert.equal(final.p.principalMinor,1200);assert.equal(final.p.saldoMinor,800);assert.equal(final.c.saldoMinor,9600);assert.equal(final.tx.length,1);assert.equal(final.e.length,1);
 // Un importe histórico textual no se normaliza ni se reescribe al corregir otro campo.
 const tipado=await preparar();await db.collection(P.collection.collectionName).updateOne({_id:tipado.p._id},{$set:{principalMinor:"1000"}});const tAntes=await tipado.foto();await assert.rejects(tipado.corregir({concepto:"Aclarado"},solicitud()),e=>e.statusCode===422);assert.deepEqual(await tipado.foto(),tAntes);
}
module.exports={probarCorreccionPrestamoAutorizada};
