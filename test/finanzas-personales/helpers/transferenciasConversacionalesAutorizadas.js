"use strict";
const assert=require("node:assert/strict"),mongoose=require("mongoose");
const Borrador=require("../../../modules/finanzas-personales/models/borradorFinanciero.model");
const Cuenta=require("../../../modules/finanzas-personales/models/cuentaFinanciera.model");
const Tx=require("../../../modules/finanzas-personales/models/TransaccionPersonal");
const Outbox=require("../../../modules/finanzas-personales/models/outboxPersonal.model");
const {aprobar}=require("../../../modules/finanzas-personales/services/aprobacionConversacional.service");
const {reconciliarCuenta}=require("../../../modules/finanzas-personales/services/patrimonioPersonal.service");
async function probarTransferenciasConversacionalesAutorizadas(){
 const fecha=new Date(Date.now()-3600000);
 async function fixture(){
  const usuarioId=new mongoose.Types.ObjectId();
  const crear=(nombre,saldoMinor)=>Cuenta.create({usuarioId,nombre,tipo:"EFECTIVO",saldoMinor,
   saldoAnclaMinor:saldoMinor,saldoAnclaEn:fecha,saldoVerificadoEn:fecha,origenSaldo:"USUARIO",requiereReconciliacion:false});
  return {usuarioId,origen:await crear("EFECTIVO",10000),destino:await crear("NEQUI",2000)};
 }
 const draft=(f,montoMinor=3000,tipo="TRANSFERENCIA_PROPIA",cuentaDestino="NEQUI")=>Borrador.create({
  usuarioId:f.usuarioId,canal:"TEXTO",textoOriginal:"Transferencia local",
  items:[{tipo,montoMinor,cuentaOrigen:"EFECTIVO",cuentaDestino,concepto:"Traspaso",categoria:"Ahorro",fecha,confianza:100,estado:"LISTO"}]});
 const estado=async f=>({cuentas:await Cuenta.find({usuarioId:f.usuarioId}).sort({_id:1}).lean(),
  tx:await Tx.find({usuarioId:f.usuarioId}).sort({_id:1}).lean(),
  outbox:await Outbox.find({usuarioId:f.usuarioId}).sort({_id:1}).lean(),
  borradores:await Borrador.find({usuarioId:f.usuarioId}).sort({_id:1}).lean()});
 const f=await fixture(),b=await draft(f);await aprobar(f.usuarioId,b._id);
 assert.equal((await Cuenta.findById(f.origen._id).lean()).saldoMinor,7000);
 assert.equal((await Cuenta.findById(f.destino._id).lean()).saldoMinor,5000);
 const cuentas=(await estado(f)).cuentas;
 assert.equal(cuentas.reduce((n,c)=>n+BigInt(c.saldoMinor),0n),12000n);
 assert.ok(cuentas.every(c=>c.requiereReconciliacion));
 assert.equal(await Tx.countDocuments({usuarioId:f.usuarioId}),0,"Un traspaso no se presenta como ingreso o gasto");
 const evento=await Outbox.findOne({usuarioId:f.usuarioId}).lean();
 assert.equal(evento.aggregateType,"TRANSFERENCIA_PROPIA");
 assert.equal(evento.payload.origenId,String(f.origen._id));assert.equal(evento.payload.destinoId,String(f.destino._id));
 const antesReplay=await estado(f);
 await assert.rejects(aprobar(f.usuarioId,b._id),e=>e.statusCode===404);
 for(const cuentaId of [f.origen._id,f.destino._id]){
  await assert.rejects(reconciliarCuenta(f.usuarioId,{cuentaId,saldoMinor:1,fecha:new Date(+evento.createdAt-1)}),e=>e.statusCode===409);
 }
 assert.deepEqual(await estado(f),antesReplay);
 const ahorro=await draft(f,2000,"AHORRO_ACTIVO","");await aprobar(f.usuarioId,ahorro._id);
 assert.equal((await Cuenta.findOne({usuarioId:f.usuarioId,nombre:"AHORRO"}).lean()).saldoMinor,2000);
 assert.equal((await Cuenta.findById(f.origen._id).lean()).saldoMinor,5000);
 assert.equal((await estado(f)).cuentas.reduce((n,c)=>n+BigInt(c.saldoMinor),0n),12000n);
 for(const caso of ["insuficiente","overflow","fraccion","moneda","misma","outbox","crear-destino"]){
  const x=await fixture();
  if(caso==="overflow")await Cuenta.updateOne({_id:x.destino._id},{$set:{saldoMinor:Number.MAX_SAFE_INTEGER}});
  if(caso==="fraccion")await Cuenta.collection.updateOne({_id:x.destino._id},{$set:{saldoMinor:1.5}});
  if(caso==="moneda")await Cuenta.collection.updateOne({_id:x.destino._id},{$set:{moneda:"USD"}});
  const d=await draft(x,caso==="insuficiente"?10001:100,
   "TRANSFERENCIA_PROPIA",caso==="misma"?"EFECTIVO":caso==="crear-destino"?"NUEVA":"NEQUI");
  const antes=await estado(x),crear=Outbox.create;
  if(["outbox","crear-destino"].includes(caso))Outbox.create=async()=>{throw Error("OUTBOX_TRANSFER_FALLIDO");};
  try{await assert.rejects(aprobar(x.usuarioId,d._id),e=>["outbox","crear-destino"].includes(caso)?e.message==="OUTBOX_TRANSFER_FALLIDO":e.statusCode===409);}
  finally{Outbox.create=crear;}
  assert.deepEqual(await estado(x),antes);
 }
 const carrera=await fixture(),drafts=await Promise.all([draft(carrera,7000),draft(carrera,7000)]);
 const resultados=await Promise.allSettled(drafts.map(d=>aprobar(carrera.usuarioId,d._id)));
 assert.equal(resultados.filter(r=>r.status==="fulfilled").length,1);
 const fin=await estado(carrera);
 assert.equal(fin.cuentas.reduce((n,c)=>n+BigInt(c.saldoMinor),0n),12000n);
 assert.equal((await Cuenta.findById(carrera.origen._id).lean()).saldoMinor,3000);
 assert.equal(fin.outbox.length,1);
}
module.exports={probarTransferenciasConversacionalesAutorizadas};
