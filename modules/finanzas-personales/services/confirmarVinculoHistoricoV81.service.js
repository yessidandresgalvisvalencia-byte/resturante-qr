"use strict";
const crypto=require("crypto");
const mongoose=require("mongoose");
const Transaccion=require("../models/TransaccionPersonal");
const Cuenta=require("../models/cuentaFinanciera.model");
const Vinculo=require("../models/vinculoHistoricoV81.model");

function resolverConfirmacion({usuarioId,movimiento,cuenta,evidencia,idempotencyKey}){
 if(!mongoose.isValidObjectId(usuarioId)||!movimiento||!cuenta)throw Object.assign(new Error("Cuenta o movimiento no encontrado"),{statusCode:404});
 if(String(movimiento.usuarioId)!==String(usuarioId)||String(cuenta.usuarioId)!==String(usuarioId))
  throw Object.assign(new Error("Cuenta o movimiento no pertenece al usuario"),{statusCode:404});
 if(movimiento.cuentaId!=null||movimiento.estado==="ANULADA"||movimiento.moneda!=="COP")
  throw Object.assign(new Error("Movimiento no elegible para vínculo"),{statusCode:409});
 if(!cuenta.activa||cuenta.moneda!=="COP")
  throw Object.assign(new Error("Cuenta no apta"),{statusCode:409});
 if(typeof evidencia!=="string"||evidencia.trim().length<12||evidencia.trim().length>240)
  throw Object.assign(new Error("Describe la evidencia de la cuenta de origen"),{statusCode:400});
 if(typeof idempotencyKey!=="string"||!/^[a-f0-9-]{36}$/i.test(idempotencyKey))
  throw Object.assign(new Error("Clave de idempotencia inválida"),{statusCode:400});
 // La coincidencia de nombre ayuda a proponer, no es una condición de escritura:
 // el usuario debe aportar evidencia específica y confirmar explícitamente.
 return {usuarioId,movimientoId:movimiento._id,cuentaId:cuenta._id,evidencia:evidencia.trim()};
}
async function confirmarVinculoHistoricoV81(usuarioId,{movimientoId,cuentaId,evidencia,idempotencyKey,confirmacionExplicita}){
 if(!mongoose.isValidObjectId(usuarioId)||!mongoose.isValidObjectId(movimientoId)||!mongoose.isValidObjectId(cuentaId))
  throw Object.assign(new Error("Identificadores inválidos"),{statusCode:400});
 if(confirmacionExplicita!==true)throw Object.assign(new Error("Confirmación explícita obligatoria"),{statusCode:400});
 const secret=process.env.PERSONAL_IDEMPOTENCY_SECRET;
 if(!secret)throw Object.assign(new Error("Servicio de idempotencia no configurado"),{statusCode:503});
 const idempotencyKeyHash=crypto.createHmac("sha256",secret).update(String(usuarioId)+":"+idempotencyKey).digest("hex");
 const session=await mongoose.startSession();
 try{
  return await session.withTransaction(async()=>{
   const indice=await Vinculo.collection.indexes();
   const requerido=["usuarioId","movimientoId"];
   if(!indice.some(i=>i.unique===true&&Object.keys(i.key).length===2&&requerido.every(k=>i.key[k]===1))||
      !indice.some(i=>i.unique===true&&Object.keys(i.key).length===2&&i.key.usuarioId===1&&i.key.idempotencyKeyHash===1))
    throw Object.assign(new Error("Índices de vínculo únicos no disponibles"),{statusCode:503});
   const [movimiento,cuenta]=[
    await Transaccion.findOne({_id:movimientoId,usuarioId}).session(session).lean(),
    await Cuenta.findOne({_id:cuentaId,usuarioId}).session(session).lean()
   ];
   const campos=resolverConfirmacion({usuarioId,movimiento,cuenta,evidencia,idempotencyKey});
   // Reintentos de la misma operación no crean evidencia adicional.
   const previo=await Vinculo.findOne({usuarioId,$or:[{movimientoId},{idempotencyKeyHash}]}).session(session).lean();
   if(previo){
    if(String(previo.movimientoId)!==String(movimientoId)||String(previo.cuentaId)!==String(cuentaId)||
       previo.evidencia!==campos.evidencia||previo.idempotencyKeyHash!==idempotencyKeyHash)
     throw Object.assign(new Error("Vínculo existente o clave utilizada para otro destino"),{statusCode:409});
    return {confirmado:true,yaExistia:true,modificaSaldo:false};
   }
   await Vinculo.create([{...campos,idempotencyKeyHash}],{session});
   return {confirmado:true,yaExistia:false,modificaSaldo:false};
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});
 }catch(e){
  if(e.code===11000)throw Object.assign(new Error("Conflicto concurrente de vínculo; consulta su estado antes de reintentar"),{statusCode:409});
  throw e;
 }finally{await session.endSession();}
}
module.exports={resolverConfirmacion,confirmarVinculoHistoricoV81};
