"use strict";
const crypto=require("crypto");
const mongoose=require("mongoose");
const Transaccion=require("../models/TransaccionPersonal");
const Outbox=require("../models/outboxPersonal.model");
const Cuenta=require("../models/cuentaFinanciera.model");
const Prestamo=require("../models/prestamoPersonal.model");
const {personalEventBus,PERSONAL_EVENTS}=require("../events/eventBusPersonal");
const {encryptObject}=require("../security/fieldEncryption.service");

function eventFor(tipo){if(tipo==="GASTO")return PERSONAL_EVENTS.GASTO_REGISTRADO;if(tipo==="INGRESO")return PERSONAL_EVENTS.INGRESO_DETECTADO;if(tipo==="PAGO_DEUDA")return PERSONAL_EVENTS.PAGO_DEUDA;if(["PRESTAMO_OTORGADO","PRESTAMO_RECIBIDO","COBRO_PRESTAMO"].includes(tipo))return PERSONAL_EVENTS.MOVIMIENTO_PATRIMONIAL;throw new TypeError("Tipo de transacción no soportado");}
function hashExternalId(usuarioId,externalId){if(!externalId)return null;const secret=process.env.PERSONAL_IDEMPOTENCY_SECRET;if(!secret)throw new Error("PERSONAL_IDEMPOTENCY_SECRET requerido");return crypto.createHmac("sha256",secret).update(String(usuarioId)).update(":").update(String(externalId)).digest("hex");}
async function registrarTransaccion(usuarioId,input){
 if(input.tipo==="GASTO"&&input.medioPago==="CREDITO")throw Object.assign(new Error("Un gasto con tarjeta de crédito debe registrar también la obligación de la tarjeta; GRUK no lo descontará de caja como si fuera débito."),{statusCode:422});const session=await mongoose.startSession();let tx,outbox;
 try{
  await session.withTransaction(async()=>{
   const externalIdHash=hashExternalId(usuarioId,input.externalId);let prestamoId=input.prestamoId||null;if(input.tipo==="PAGO_DEUDA"&&!prestamoId){const candidatas=await Prestamo.find({usuarioId,direccion:"POR_PAGAR",estado:{$in:["ACTIVO","VENCIDO"]},saldoMinor:{$gt:0}}).select("_id").session(session);if(candidatas.length!==1)throw Object.assign(new Error(candidatas.length?"Indica exactamente qué deuda estás pagando.":"No hay una deuda activa para aplicar este pago."),{statusCode:409});prestamoId=candidatas[0]._id;}const envelope=input.metadatosSensibles?encryptObject(input.metadatosSensibles,{aad:String(usuarioId)}):null;
   [tx]=await Transaccion.create([{usuarioId,prestamoId,tipo:input.tipo,montoMinor:input.montoMinor,moneda:input.moneda||"COP",concepto:input.concepto,categoria:input.categoria,subcategoria:input.subcategoria||"",cuenta:input.cuenta||"EFECTIVO",medioPago:input.medioPago||"EFECTIVO",contraparte:input.contraparte||"",descripcion:input.descripcion||"",recurrente:Boolean(input.recurrente),frecuencia:input.frecuencia||"NINGUNA",fecha:input.fecha,origen:input.origen||"MANUAL",externalIdHash,metadatosCifrados:envelope?{ciphertext:envelope.ciphertext,iv:envelope.iv,tag:envelope.tag}:undefined,keyVersion:envelope?.keyVersion||null}],{session});
   if(input.tipo==="PAGO_DEUDA"){const p=await Prestamo.findOne({_id:prestamoId,usuarioId,direccion:"POR_PAGAR",estado:{$in:["ACTIVO","VENCIDO"]}}).session(session);if(!p)throw Object.assign(new Error("Deuda no encontrada"),{statusCode:404});if(input.montoMinor>p.saldoMinor)throw Object.assign(new Error("El pago supera el saldo pendiente"),{statusCode:409});p.saldoMinor-=input.montoMinor;if(p.saldoMinor===0)p.estado="PAGADO";await p.save({session});}
   const eventId=crypto.randomUUID(),eventName=eventFor(input.tipo);
   [outbox]=await Outbox.create([{usuarioId,eventId,eventName,aggregateId:tx._id,payload:{transaccionId:tx._id.toString(),prestamoId:prestamoId?String(prestamoId):null,tipo:tx.tipo,montoMinor:tx.montoMinor,moneda:tx.moneda,categoria:tx.categoria,fecha:tx.fecha}}],{session});
   // El ledger y la liquidez deben cambiar en la misma transacción ACID.
   // Si el usuario aún no tiene la cuenta indicada, se crea con saldo cero y luego se aplica el movimiento.
   const nombreCuenta=String(input.cuenta||"EFECTIVO").trim()||"EFECTIVO";
   let cuenta=await Cuenta.findOne({usuarioId,nombre:nombreCuenta,activa:true}).session(session);
   if(!cuenta){
    [cuenta]=await Cuenta.create([{usuarioId,nombre:nombreCuenta,tipo:nombreCuenta.toUpperCase()==="EFECTIVO"?"EFECTIVO":"OTRA",institucion:"",moneda:"COP",saldoMinor:0,activa:true}],{session});
   }
   const delta=input.tipo==="INGRESO"||input.tipo==="PRESTAMO_RECIBIDO"||input.tipo==="COBRO_PRESTAMO"?input.montoMinor:input.tipo==="GASTO"||input.tipo==="PAGO_DEUDA"||input.tipo==="PRESTAMO_OTORGADO"?-input.montoMinor:0;
   if(delta){
    const actualizada=await Cuenta.findOneAndUpdate({_id:cuenta._id,usuarioId,activa:true,...(delta<0?{saldoMinor:{$gte:-delta}}:{})},{$inc:{saldoMinor:delta}},{new:true,session});
    if(!actualizada)throw Object.assign(new Error("Saldo insuficiente en "+nombreCuenta),{statusCode:409});
   }
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});
 }finally{await session.endSession();}
 try{await publicarEvento(outbox);}catch(err){console.error("[FIN_PERSONAL_OUTBOX_POST_COMMIT]",err);}
 return tx;
}
async function publicarEvento(outbox){
 try{personalEventBus.emitFinancial(outbox.eventName,{eventId:outbox.eventId,usuarioId:outbox.usuarioId.toString(),aggregateId:outbox.aggregateId.toString(),payload:outbox.payload});
  await Outbox.updateOne({_id:outbox._id,estado:{$ne:"PUBLICADO"}},{$set:{estado:"PUBLICADO",publicadoEn:new Date(),ultimoError:null},$inc:{intentos:1}});
 }catch(err){await Outbox.updateOne({_id:outbox._id},{$set:{estado:"ERROR",ultimoError:String(err.message||err).slice(0,500)},$inc:{intentos:1}});throw err;}
}
async function republicarPendientes(limite=100){const docs=await Outbox.find({estado:{$in:["PENDIENTE","ERROR"]}}).sort({createdAt:1}).limit(Math.min(limite,500));let publicados=0;for(const doc of docs){try{await publicarEvento(doc);publicados++;}catch(_){}}return publicados;}
async function flujoPeriodo(usuarioId,{desde,hasta}){
 const inicio=new Date(desde),fin=new Date(hasta);if(Number.isNaN(inicio.getTime())||Number.isNaN(fin.getTime())||inicio>=fin)throw Object.assign(new Error("Periodo inválido"),{statusCode:400});
 const rows=await Transaccion.aggregate([{$match:{usuarioId:new mongoose.Types.ObjectId(usuarioId),estado:{$ne:"ANULADA"},moneda:"COP",fecha:{$gte:inicio,$lt:fin}}},{$group:{_id:"$tipo",total:{$sum:"$montoMinor"}}}]);
 const totals=Object.fromEntries(rows.map(x=>[x._id,x.total]));const ingresos=(totals.INGRESO||0)+(totals.PRESTAMO_RECIBIDO||0)+(totals.COBRO_PRESTAMO||0),gastos=(totals.GASTO||0)+(totals.PRESTAMO_OTORGADO||0),pagosDeuda=totals.PAGO_DEUDA||0;
 return{ingresosMinor:ingresos,gastosMinor:gastos,pagosDeudaMinor:pagosDeuda,flujoNetoMinor:ingresos-gastos-pagosDeuda,moneda:"COP"};
}
async function corregirTransaccion(usuarioId,id,cambios){if(!mongoose.isValidObjectId(id))throw Object.assign(new Error("Identificador inválido"),{statusCode:400});const permitidos={};for(const k of ["tipo","montoMinor","concepto","categoria"])if(cambios[k]!==undefined)permitidos[k]=cambios[k];if(!Object.keys(permitidos).length)throw Object.assign(new Error("No hay cambios válidos"),{statusCode:400});const session=await mongoose.startSession();try{let tx;await session.withTransaction(async()=>{const anterior=await Transaccion.findOne({_id:id,usuarioId,tipo:{$in:["INGRESO","GASTO"]},estado:{$ne:"ANULADA"}}).session(session);if(!anterior)throw Object.assign(new Error("Movimiento no disponible"),{statusCode:404});const signo=t=>t==="INGRESO"?1:-1,delta=(signo(permitidos.tipo||anterior.tipo)*(permitidos.montoMinor??anterior.montoMinor))-(signo(anterior.tipo)*anterior.montoMinor);if(delta){const cuenta=await Cuenta.findOneAndUpdate({usuarioId,nombre:anterior.cuenta,activa:true,...(delta<0?{saldoMinor:{$gte:-delta}}:{})},{$inc:{saldoMinor:delta}},{new:true,session});if(!cuenta)throw Object.assign(new Error("No se puede corregir: saldo insuficiente o cuenta no encontrada"),{statusCode:409});}Object.assign(anterior,permitidos);await anterior.save({session});tx=anterior;},{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});return tx;}finally{await session.endSession();}}
async function anularTransaccion(usuarioId,id,motivo="Anulada por el usuario"){if(!mongoose.isValidObjectId(id))throw Object.assign(new Error("Identificador inválido"),{statusCode:400});const session=await mongoose.startSession();try{let tx;await session.withTransaction(async()=>{tx=await Transaccion.findOne({_id:id,usuarioId,tipo:{$in:["INGRESO","GASTO"]},estado:{$ne:"ANULADA"}}).session(session);if(!tx)throw Object.assign(new Error("Movimiento no disponible o ya eliminado"),{statusCode:404});const reverso=tx.tipo==="INGRESO"?-tx.montoMinor:tx.montoMinor;const cuenta=await Cuenta.findOneAndUpdate({usuarioId,nombre:tx.cuenta,activa:true,...(reverso<0?{saldoMinor:{$gte:-reverso}}:{})},{$inc:{saldoMinor:reverso}},{new:true,session});if(!cuenta)throw Object.assign(new Error("No se puede anular: saldo insuficiente o cuenta no encontrada"),{statusCode:409});tx.estado="ANULADA";tx.anuladaEn=new Date();tx.motivoAnulacion=String(motivo).slice(0,240);await tx.save({session});},{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});return tx;}finally{await session.endSession();}}
module.exports={registrarTransaccion,republicarPendientes,flujoPeriodo,anularTransaccion,corregirTransaccion};