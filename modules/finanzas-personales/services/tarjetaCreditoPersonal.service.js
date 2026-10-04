"use strict";
const crypto=require("crypto");
const mongoose=require("mongoose");
const Deuda=require("../models/DeudaPersonal");
const Cuenta=require("../models/cuentaFinanciera.model");
const Transaccion=require("../models/TransaccionPersonal");
const Outbox=require("../models/outboxPersonal.model");

function validarMonto(n){if(!Number.isSafeInteger(n)||n<=0)throw Object.assign(new Error("montoMinor debe ser entero positivo exacto"),{statusCode:400});}
async function comprar(usuarioId,{deudaId,montoMinor,concepto,categoria="Gastos variables",fecha=new Date()}){
 validarMonto(montoMinor);if(!mongoose.isValidObjectId(deudaId))throw Object.assign(new Error("Tarjeta inválida"),{statusCode:400});
 const session=await mongoose.startSession();let tx;
 try{await session.withTransaction(async()=>{
  const tarjeta=await Deuda.findOne({_id:deudaId,usuarioId,tipo:"TARJETA_CREDITO",activa:true}).session(session);
  if(!tarjeta)throw Object.assign(new Error("Tarjeta no encontrada"),{statusCode:404});
  if(tarjeta.cupoDisponibleMinor<montoMinor)throw Object.assign(new Error("Cupo insuficiente"),{statusCode:409});
  tarjeta.saldoMinor+=montoMinor;tarjeta.cupoDisponibleMinor-=montoMinor;await tarjeta.save({session});
  [tx]=await Transaccion.create([{usuarioId,tipo:"GASTO",montoMinor,concepto,categoria,cuenta:"TARJETA:"+tarjeta._id,medioPago:"CREDITO",fecha,origen:"SISTEMA",descripcion:"Compra a crédito; aumenta pasivo y no reduce caja"}],{session});
  await Outbox.create([{usuarioId,eventId:crypto.randomUUID(),eventName:"GASTO_REGISTRADO",aggregateId:tx._id,payload:{transaccionId:String(tx._id),deudaId:String(tarjeta._id),tipo:"GASTO",medioPago:"CREDITO",montoMinor,fecha:tx.fecha}}],{session});
 },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});return tx;}finally{await session.endSession();}
}
async function pagar(usuarioId,{deudaId,montoMinor,cuenta="EFECTIVO",concepto="Pago tarjeta de crédito",fecha=new Date()}){
 validarMonto(montoMinor);if(!mongoose.isValidObjectId(deudaId))throw Object.assign(new Error("Tarjeta inválida"),{statusCode:400});
 const session=await mongoose.startSession();let tx;
 try{await session.withTransaction(async()=>{
  const tarjeta=await Deuda.findOne({_id:deudaId,usuarioId,tipo:"TARJETA_CREDITO",activa:true,saldoMinor:{$gt:0}}).session(session);
  if(!tarjeta)throw Object.assign(new Error("Tarjeta no encontrada o sin saldo"),{statusCode:404});
  if(montoMinor>tarjeta.saldoMinor)throw Object.assign(new Error("El pago supera el saldo de la tarjeta"),{statusCode:409});
  const caja=await Cuenta.findOneAndUpdate({usuarioId,nombre:cuenta,activa:true,saldoMinor:{$gte:montoMinor}},{$inc:{saldoMinor:-montoMinor}},{new:true,session});
  if(!caja)throw Object.assign(new Error("Saldo insuficiente en "+cuenta),{statusCode:409});
  tarjeta.saldoMinor-=montoMinor;tarjeta.cupoDisponibleMinor=Math.min(tarjeta.cupoTotalMinor,tarjeta.cupoDisponibleMinor+montoMinor);await tarjeta.save({session});
  [tx]=await Transaccion.create([{usuarioId,tipo:"PAGO_DEUDA",montoMinor,concepto,categoria:"Deuda",cuenta,medioPago:"DEBITO",fecha,origen:"SISTEMA",descripcion:"Pago de tarjeta; reduce caja y pasivo"}],{session});
  await Outbox.create([{usuarioId,eventId:crypto.randomUUID(),eventName:"PAGO_DEUDA",aggregateId:tx._id,payload:{transaccionId:String(tx._id),deudaId:String(tarjeta._id),tipo:"PAGO_DEUDA",montoMinor,fecha:tx.fecha}}],{session});
 },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});return tx;}finally{await session.endSession();}
}
function pagoExigible(tarjeta){if(!tarjeta||tarjeta.tipo!=="TARJETA_CREDITO"||!tarjeta.activa||tarjeta.saldoMinor<=0)return 0;const minimo=Number(tarjeta.pagoMinimoMinor||0);return Math.min(tarjeta.saldoMinor,minimo>0?minimo:tarjeta.saldoMinor);}
module.exports={comprar,pagar,pagoExigible};
