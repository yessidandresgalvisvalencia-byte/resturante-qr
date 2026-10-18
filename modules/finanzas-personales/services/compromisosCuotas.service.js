"use strict";
const mongoose=require("mongoose");
const crypto=require("crypto");
const Padre=require("../models/compromisoCuotas.model");
const Cuota=require("../models/cuotaHija.model");
const Tx=require("../models/TransaccionPersonal");
const Cuenta=require("../models/cuentaFinanciera.model");
const Outbox=require("../models/outboxPersonal.model");
const problema=(mensaje,statusCode=409)=>Object.assign(new Error(mensaje),{statusCode});
const txConfig={readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"};
function importes(monto,n){
 if(!Number.isSafeInteger(monto)||monto<1||!Number.isInteger(n)||n<1||n>360||monto<n)throw problema("Monto y número de cuotas inválidos",422);
 const base=Math.floor(monto/n),resto=monto%n;
 return Array.from({length:n},(_,i)=>base+(i<resto?1:0));
}
async function crear(usuarioId,{concepto,categoria,montoTotalMinor,numeroCuotas}){
 const valores=importes(montoTotalMinor,numeroCuotas),session=await mongoose.startSession();
 try{let padre;await session.withTransaction(async()=>{
  [padre]=await Padre.create([{usuarioId,concepto,categoria,montoTotalMinor,saldoMinor:montoTotalMinor,numeroCuotas,cuotasPagadas:0,estado:"ACTIVA"}],{session});
  await Cuota.insertMany(valores.map((montoMinor,i)=>({usuarioId,compromisoId:padre._id,numero:i+1,montoMinor,estado:"PENDIENTE"})),{session,ordered:true});
  await Outbox.create([{usuarioId,eventId:crypto.randomUUID(),eventName:"COMPROMISO_CUOTAS_CREADO",aggregateType:"COMPROMISO_CUOTAS_PERSONAL",aggregateId:padre._id,payload:{numeroCuotas,montoTotalMinor}}],{session});
 },txConfig);return padre;}finally{await session.endSession();}
}
async function listar(usuarioId){const compromisos=await Padre.find({usuarioId}).sort({createdAt:-1}).lean();const ids=compromisos.map(p=>p._id);const cuotas=await Cuota.find({usuarioId,compromisoId:{$in:ids}}).sort({numero:1}).lean();return compromisos.map(p=>({...p,cuotas:cuotas.filter(c=>String(c.compromisoId)===String(p._id))}));}
async function pagar(usuarioId,{compromisoId,numero,cuentaId=null,modo="HISTORICO",externalId}){
 if(!Number.isInteger(numero)||numero<1||numero>360)throw problema("Cuota inválida",422);
 if(!["CUENTA","HISTORICO"].includes(modo)||modo==="CUENTA"&&!cuentaId||modo==="HISTORICO"&&cuentaId)throw problema("Modo de pago inválido",422);
 if(!/^[0-9a-f-]{36}$/i.test(externalId||""))throw problema("Referencia inválida",422);
 const secret=process.env.PERSONAL_IDEMPOTENCY_SECRET;if(!secret)throw Error("PERSONAL_IDEMPOTENCY_SECRET requerido");
 const externalIdHash=crypto.createHmac("sha256",secret).update(String(usuarioId)+":COMPROMISO:"+externalId).digest("hex");
 const session=await mongoose.startSession();
 try{let resultado;await session.withTransaction(async()=>{
  const ya=await Tx.findOne({usuarioId,externalIdHash}).session(session);
  if(ya){if(ya.descripcion!=="Compromiso "+compromisoId+" cuota "+numero||ya.estado!=="ACTIVA")throw problema("Referencia ya utilizada");resultado={duplicado:true,transaccion:ya};return;}
  const padre=await Padre.findOne({_id:compromisoId,usuarioId,estado:"ACTIVA"}).session(session);
  if(!padre)throw problema("Compromiso no activo");
  const cuota=await Cuota.findOne({usuarioId,compromisoId,numero}).session(session);
  if(!cuota||cuota.estado!=="PENDIENTE"||numero!==padre.cuotasPagadas+1)throw problema("Esta cuota ya fue pagada o hay una anterior pendiente");
  const importe=cuota.montoMinor;
  let cuenta=null;
  if(modo==="CUENTA"){cuenta=await Cuenta.findOneAndUpdate({_id:cuentaId,usuarioId,activa:true,saldoMinor:{$gte:importe}},{$inc:{saldoMinor:-importe}},{new:true,session});
   if(!cuenta)throw problema("Saldo insuficiente o cuenta inválida");}
  const [t]=await Tx.create([{usuarioId,tipo:"PAGO_DEUDA",montoMinor:importe,concepto:("Cuota "+numero+" de "+padre.concepto).slice(0,140),categoria:"Pago de compra financiada",subcategoria:padre.categoria,cuenta:cuenta?cuenta.nombre:"PAGO HISTÓRICO NO CONCILIADO",cuentaId:cuenta?cuenta._id:null,impactoCaja:modo==="CUENTA",descripcion:"Compromiso "+compromisoId+" cuota "+numero,medioPago:cuenta?(cuenta.tipo==="EFECTIVO"?"EFECTIVO":"TRANSFERENCIA"):"OTRO",fecha:new Date(),origen:"MANUAL",externalIdHash}],{session});
  cuota.estado="PAGADA";cuota.pagadaEn=t.fecha;cuota.transaccionId=t._id;await cuota.save({session});
  padre.saldoMinor-=importe;padre.cuotasPagadas++;
  if(padre.cuotasPagadas===padre.numeroCuotas){if(padre.saldoMinor!==0)throw problema("Saldo inconsistente");padre.estado="FINALIZADA";}
  await padre.save({session});
  await Outbox.create([{usuarioId,eventId:crypto.randomUUID(),eventName:"COMPROMISO_CUOTA_PAGADA",aggregateType:"COMPROMISO_CUOTAS_PERSONAL",aggregateId:padre._id,payload:{cuotaId:String(cuota._id),transaccionId:String(t._id),numero,montoMinor:importe,impactoCaja:modo==="CUENTA"}}],{session});
  resultado={duplicado:false,cuota:cuota.toObject(),compromiso:padre.toObject(),transaccion:t.toObject()};
 },txConfig);return resultado;}finally{await session.endSession();}
}
async function deshacer(usuarioId,{compromisoId,numero}){
 const session=await mongoose.startSession();
 try{let resultado;await session.withTransaction(async()=>{
  const padre=await Padre.findOne({_id:compromisoId,usuarioId}).session(session);
  if(!padre||numero!==padre.cuotasPagadas)throw problema("Solo se puede deshacer la última cuota pagada");
  const cuota=await Cuota.findOne({usuarioId,compromisoId,numero,estado:"PAGADA"}).session(session);
  if(!cuota||!cuota.transaccionId)throw problema("Cuota no conciliable");
  const tx=await Tx.findOne({_id:cuota.transaccionId,usuarioId,tipo:"PAGO_DEUDA",estado:"ACTIVA"}).session(session);
  if(!tx||tx.descripcion!=="Compromiso "+compromisoId+" cuota "+numero)throw problema("Movimiento no conciliable");
  if(tx.impactoCaja!==false){
   const cuenta=await Cuenta.findOneAndUpdate({_id:tx.cuentaId,usuarioId,activa:true},{$inc:{saldoMinor:tx.montoMinor}},{new:true,session});
   if(!cuenta||!Number.isSafeInteger(cuenta.saldoMinor))throw problema("No se puede restaurar la cuenta");
  }
  tx.estado="ANULADA";tx.anuladaEn=new Date();tx.motivoAnulacion="REVERSIÓN_CUOTA_COMPROMISO";await tx.save({session});
  cuota.estado="PENDIENTE";cuota.pagadaEn=null;cuota.transaccionId=null;await cuota.save({session});
  padre.saldoMinor+=cuota.montoMinor;padre.cuotasPagadas--;padre.estado="ACTIVA";await padre.save({session});
  await Outbox.create([{usuarioId,eventId:crypto.randomUUID(),eventName:"COMPROMISO_CUOTA_REVERTIDA",aggregateType:"COMPROMISO_CUOTAS_PERSONAL",aggregateId:padre._id,payload:{numero,montoMinor:cuota.montoMinor,transaccionId:String(tx._id)}}],{session});
  resultado={cuota:cuota.toObject(),compromiso:padre.toObject()};
 },txConfig);return resultado;}finally{await session.endSession();}
}
module.exports={importes,crear,listar,pagar,deshacer};