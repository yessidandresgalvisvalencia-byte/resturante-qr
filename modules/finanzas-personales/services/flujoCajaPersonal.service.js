"use strict";
const crypto=require("crypto");
const mongoose=require("mongoose");
const Transaccion=require("../models/TransaccionPersonal");
const Outbox=require("../models/outboxPersonal.model");
const {personalEventBus,PERSONAL_EVENTS}=require("../events/eventBusPersonal");

function eventFor(tipo){if(tipo==="GASTO")return PERSONAL_EVENTS.GASTO_REGISTRADO;if(tipo==="INGRESO")return PERSONAL_EVENTS.INGRESO_DETECTADO;if(tipo==="PAGO_DEUDA")return PERSONAL_EVENTS.PAGO_DEUDA;throw new TypeError("Tipo de transacción no soportado");}
function hashExternalId(usuarioId,externalId){if(!externalId)return null;const secret=process.env.PERSONAL_IDEMPOTENCY_SECRET||process.env.JWT_SECRET;if(!secret)throw new Error("PERSONAL_IDEMPOTENCY_SECRET/JWT_SECRET requerido");return crypto.createHmac("sha256",secret).update(String(usuarioId)).update(":").update(String(externalId)).digest("hex");}
async function registrarTransaccion(usuarioId,input){
 const session=await mongoose.startSession();let tx,outbox;
 try{
  await session.withTransaction(async()=>{
   const externalIdHash=hashExternalId(usuarioId,input.externalId);
   [tx]=await Transaccion.create([{usuarioId,tipo:input.tipo,montoMinor:input.montoMinor,moneda:input.moneda||"COP",concepto:input.concepto,categoria:input.categoria,subcategoria:input.subcategoria||"",fecha:input.fecha,origen:input.origen||"MANUAL",externalIdHash}],{session});
   const eventId=crypto.randomUUID(),eventName=eventFor(input.tipo);
   [outbox]=await Outbox.create([{usuarioId,eventId,eventName,aggregateId:tx._id,payload:{transaccionId:tx._id.toString(),tipo:tx.tipo,montoMinor:tx.montoMinor,moneda:tx.moneda,categoria:tx.categoria,fecha:tx.fecha}}],{session});
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});
 }finally{await session.endSession();}
 await publicarEvento(outbox);
 return tx;
}
async function publicarEvento(outbox){
 try{personalEventBus.emitFinancial(outbox.eventName,{eventId:outbox.eventId,usuarioId:outbox.usuarioId.toString(),aggregateId:outbox.aggregateId.toString(),payload:outbox.payload});
  await Outbox.updateOne({_id:outbox._id,estado:{$ne:"PUBLICADO"}},{$set:{estado:"PUBLICADO",publicadoEn:new Date(),ultimoError:null},$inc:{intentos:1}});
 }catch(err){await Outbox.updateOne({_id:outbox._id},{$set:{estado:"ERROR",ultimoError:String(err.message||err).slice(0,500)},$inc:{intentos:1}});throw err;}
}
async function republicarPendientes(limite=100){const docs=await Outbox.find({estado:{$in:["PENDIENTE","ERROR"]}}).sort({createdAt:1}).limit(Math.min(limite,500));let publicados=0;for(const doc of docs){try{await publicarEvento(doc);publicados++;}catch(_){}}return publicados;}
async function flujoPeriodo(usuarioId,{desde,hasta}){
 const rows=await Transaccion.aggregate([{$match:{usuarioId:new mongoose.Types.ObjectId(usuarioId),fecha:{$gte:new Date(desde),$lte:new Date(hasta)}}},{$group:{_id:"$tipo",total:{$sum:"$montoMinor"}}}]);
 const totals=Object.fromEntries(rows.map(x=>[x._id,x.total]));const ingresos=totals.INGRESO||0,gastos=totals.GASTO||0,pagosDeuda=totals.PAGO_DEUDA||0;
 return{ingresosMinor:ingresos,gastosMinor:gastos,pagosDeudaMinor:pagosDeuda,flujoNetoMinor:ingresos-gastos-pagosDeuda,moneda:"COP"};
}
module.exports={registrarTransaccion,republicarPendientes,flujoPeriodo};