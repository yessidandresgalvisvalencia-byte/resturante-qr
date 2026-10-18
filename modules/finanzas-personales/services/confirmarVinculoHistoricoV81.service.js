"use strict";
const crypto=require("crypto");
const mongoose=require("mongoose");
const Transaccion=require("../models/TransaccionPersonal");
const Cuenta=require("../models/cuentaFinanciera.model");
const Vinculo=require("../models/vinculoHistoricoV81.model");

function validarClaveVinculo(idempotencyKey){
 if(typeof idempotencyKey!=="string"||!/^[a-f0-9]{8}-[a-f0-9]{4}-[47][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(idempotencyKey))
  throw Object.assign(new Error("Clave de idempotencia inválida"),{statusCode:400});
}
function hashClaveVinculoV81(usuarioId,idempotencyKey,secret){
 validarClaveVinculo(idempotencyKey);
 if(!mongoose.isValidObjectId(usuarioId)||typeof secret!=="string"||!secret)
  throw Object.assign(new Error("Parámetros de idempotencia inválidos"),{statusCode:503});
 // UUID es insensible a mayúsculas: su formato no debe cambiar el HMAC.
 return crypto.createHmac("sha256",secret)
  .update(String(usuarioId).toLowerCase()+":"+idempotencyKey.toLowerCase()).digest("hex");
}
function coincideVinculo(previo,{movimientoId,cuentaId,evidencia,idempotencyKeyHash}){
 return Boolean(previo&&String(previo.movimientoId)===String(movimientoId)&&
  String(previo.cuentaId)===String(cuentaId)&&previo.evidencia===evidencia.trim()&&
  previo.idempotencyKeyHash===idempotencyKeyHash);
}
function decidirReintentoVinculo(previos,solicitud){
 if(!Array.isArray(previos))throw new TypeError("Registros de vínculo inválidos");
 if(!previos.length)return {existe:false,coincide:false};
 // No confiar en findOne($or): puede ocultar otro conflicto simultáneo.
 return {existe:true,coincide:previos.length===1&&coincideVinculo(previos[0],solicitud)};
}
function conflictoTransitorioMongo(e){
 return Boolean(e&&(e.code===112||e.code===251||
  (typeof e.hasErrorLabel==="function"&&
   (e.hasErrorLabel("TransientTransactionError")||e.hasErrorLabel("UnknownTransactionCommitResult")))));
}
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
 validarClaveVinculo(idempotencyKey);
 // La coincidencia de nombre ayuda a proponer, no es una condición de escritura:
 // el usuario debe aportar evidencia específica y confirmar explícitamente.
 return {usuarioId,movimientoId:movimiento._id,cuentaId:cuenta._id,evidencia:evidencia.trim()};
}
async function confirmarVinculoHistoricoV81(usuarioId,{movimientoId,cuentaId,evidencia,idempotencyKey,confirmacionExplicita}){
 if(!mongoose.isValidObjectId(usuarioId)||!mongoose.isValidObjectId(movimientoId)||!mongoose.isValidObjectId(cuentaId))
  throw Object.assign(new Error("Identificadores inválidos"),{statusCode:400});
 if(confirmacionExplicita!==true)throw Object.assign(new Error("Confirmación explícita obligatoria"),{statusCode:400});
 validarClaveVinculo(idempotencyKey);
 if(typeof evidencia!=="string"||evidencia.trim().length<12||evidencia.trim().length>240)
  throw Object.assign(new Error("Describe la evidencia de la cuenta de origen"),{statusCode:400});
 const secret=process.env.PERSONAL_IDEMPOTENCY_SECRET;
 if(!secret)throw Object.assign(new Error("Servicio de idempotencia no configurado"),{statusCode:503});
 const idempotencyKeyHash=hashClaveVinculoV81(usuarioId,idempotencyKey,secret);
 // MongoDB no permite listIndexes dentro de una transacción.
 // Fallar cerrado si los índices únicos requeridos no están presentes.
 let indices;
 try{indices=await Vinculo.collection.indexes();}
 catch(_){throw Object.assign(new Error("No se pudieron verificar índices de vínculo"),{statusCode:503});}
 if(!indices.some(i=>i.unique===true&&Object.keys(i.key).length===2&&i.key.usuarioId===1&&i.key.movimientoId===1)||
    !indices.some(i=>i.unique===true&&Object.keys(i.key).length===2&&i.key.usuarioId===1&&i.key.idempotencyKeyHash===1))
  throw Object.assign(new Error("Índices de vínculo únicos no disponibles"),{statusCode:503});
 const session=await mongoose.startSession();
 try{
  return await session.withTransaction(async()=>{
   const [movimiento,cuenta]=[
    await Transaccion.findOne({_id:movimientoId,usuarioId}).session(session).lean(),
    await Cuenta.findOne({_id:cuentaId,usuarioId}).session(session).lean()
   ];
   const campos=resolverConfirmacion({usuarioId,movimiento,cuenta,evidencia,idempotencyKey});
   // Reintentos de la misma operación no crean evidencia adicional.
   const previos=await Vinculo.find({usuarioId,$or:[{movimientoId},{idempotencyKeyHash}]}).session(session).lean();
   const existente=decidirReintentoVinculo(previos,{movimientoId,cuentaId,evidencia:campos.evidencia,idempotencyKeyHash});
   if(existente.existe){
    if(!existente.coincide)
     throw Object.assign(new Error("Vínculo existente o clave utilizada para otro destino"),{statusCode:409});
    return {confirmado:true,yaExistia:true,modificaSaldo:false};
   }
   await Vinculo.create([{...campos,idempotencyKeyHash}],{session});
   return {confirmado:true,yaExistia:false,modificaSaldo:false};
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});
 }catch(e){
  if(e.code===11000){
   // El insert duplicado pudo haber sido el mismo intento concurrente.
   // Solo responder idempotentemente tras leer el registro ya confirmado.
   const previos=await Vinculo.find({usuarioId,$or:[{movimientoId},{idempotencyKeyHash}]}).lean();
   if(decidirReintentoVinculo(previos,{movimientoId,cuentaId,evidencia,idempotencyKeyHash}).coincide)
    return {confirmado:true,yaExistia:true,modificaSaldo:false};
   throw Object.assign(new Error("Conflicto concurrente de vínculo con otra cuenta o evidencia"),{statusCode:409});
  }
  if(conflictoTransitorioMongo(e))
   throw Object.assign(new Error("Operación concurrente sin confirmación verificable; reintenta con la misma clave"),{statusCode:503});
  throw e;
 }finally{await session.endSession();}
}
module.exports={resolverConfirmacion,confirmarVinculoHistoricoV81,validarClaveVinculo,coincideVinculo,decidirReintentoVinculo,conflictoTransitorioMongo,hashClaveVinculoV81};
