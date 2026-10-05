"use strict";
const mongoose=require("mongoose");
const PersonalObligation=require("../models/PersonalObligation");
const PersonalReceivable=require("../models/PersonalReceivable");
const PersonalFinancialProfile=require("../models/PersonalFinancialProfile");
const PersonalFinanceEvent=require("../models/PersonalFinanceEvent");
const brain=require("./personalEconomicBrain.service");

async function transact(work){
 const session=await mongoose.startSession();
 try { let result; await session.withTransaction(async()=>{result=await work(session)}); return result; }
 finally { await session.endSession(); }
}
async function payObligation(ownerKey,id,amount,idempotencyKey){
 return transact(async session=>{
  const existing=await PersonalFinanceEvent.findOne({ownerKey,idempotencyKey,type:"OBLIGATION_PAYMENT"}).session(session).lean();
  if(existing)return brain.analyze(ownerKey,{session});
  const obligation=await PersonalObligation.findOne({_id:id,ownerKey,status:{$in:["ACTIVE","RENEGOTIATING"]}}).session(session);
  if(!obligation)throw Object.assign(new Error("Obligación activa no encontrada"),{status:404});
  const value=Number(amount);
  if(!Number.isFinite(value)||value<=0||value>obligation.outstandingAmount)throw Object.assign(new Error("Pago inválido"),{status:400});
  const profile=await PersonalFinancialProfile.findOne({ownerKey}).session(session);
  if(!profile||profile.cashAvailable<value)throw Object.assign(new Error("Efectivo disponible insuficiente"),{status:409});
  profile.cashAvailable-=value; await profile.save({session});
  obligation.outstandingAmount-=value;
  if(obligation.outstandingAmount===0)obligation.status="PAID";
  await obligation.save({session});
  await PersonalFinanceEvent.create([{ownerKey,type:"OBLIGATION_PAYMENT",aggregateType:"PersonalObligation",aggregateId:obligation._id,idempotencyKey,payload:{amount:value}}],{session});
  return brain.analyze(ownerKey,{session});
 });
}
async function collectReceivable(ownerKey,id,amount,idempotencyKey){
 return transact(async session=>{
  const existing=await PersonalFinanceEvent.findOne({ownerKey,idempotencyKey,type:"RECEIVABLE_COLLECTION"}).session(session).lean();
  if(existing)return brain.analyze(ownerKey,{session});
  const item=await PersonalReceivable.findOne({_id:id,ownerKey,status:{$in:["PENDING","PARTIAL","UNCERTAIN"]}}).session(session);
  if(!item)throw Object.assign(new Error("Cuenta por cobrar no encontrada"),{status:404});
  const value=Number(amount);
  if(!Number.isFinite(value)||value<=0||value>item.outstandingAmount)throw Object.assign(new Error("Recaudo inválido"),{status:400});
  let profile=await PersonalFinancialProfile.findOne({ownerKey}).session(session);
  if(!profile){[profile]=await PersonalFinancialProfile.create([{ownerKey}],{session});}
  profile.cashAvailable+=value; await profile.save({session});
  item.outstandingAmount-=value;
  item.status=item.outstandingAmount===0?"COLLECTED":"PARTIAL";
  await item.save({session});
  await PersonalFinanceEvent.create([{ownerKey,type:"RECEIVABLE_COLLECTION",aggregateType:"PersonalReceivable",aggregateId:item._id,idempotencyKey,payload:{amount:value}}],{session});
  return brain.analyze(ownerKey,{session});
 });
}
module.exports={payObligation,collectReceivable};
