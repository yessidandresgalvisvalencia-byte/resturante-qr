"use strict";
const Admin=require("../../models/admin");
const Personal=require("../../models/personal");
const Restaurante=require("../../models/restaurante");
const Usuario=require("../../models/usuario");
const Sede=require("../../models/sede");
const {versionCoincide,payloadSesionValido}=require("./tokenVersion.guard");
const MODELOS=Object.freeze({ADMIN:Admin,PERSONAL:Personal,RESTAURANTE:Restaurante,USUARIO:Usuario});
function consultaCancelable(query,signal){
 return signal ? query.setOptions({signal}) : query;
}
async function validarVersionSesion(payload,{signal}={}){
 if(signal?.aborted)return false;
 if(!payloadSesionValido(payload))return false;
 const tipo=payload.identityType||"";
 // El tipo de identidad es obligatorio: no aceptar JWT que omitan la\n // verificación de revocación y pertenencia a un sujeto real.\n if(!tipo)return false;
 if(tipo==="USUARIO"){
  // Un único roundtrip Mongo: usuario y vínculo de sede deben concordar
  // simultáneamente con el tenant. No confiar en la sede enviada por JWT.
  const mongoose=require("mongoose");
  if(!mongoose.isValidObjectId(payload.sub))return false;
  const usuarios=await Usuario.aggregate([
   {$match:{_id:new mongoose.Types.ObjectId(payload.sub)}},
   {$limit:1},
   {$lookup:{
    from:Sede.collection.name,
    let:{sede:"$sedeId",empresa:"$empresaId",restaurante:"$restauranteId"},
    pipeline:[{$match:{$expr:{$and:[
     {$eq:["$_id","$sede"]},
     {$eq:["$empresaId","$empresa"]},
     {$eq:["$restauranteId","$restaurante"]}
    ]}}},{$project:{_id:1}}],
    as:"sedeValidada"
   }},
   {$project:{tokenVersion:1,empresaId:1,restauranteId:1,sedeId:1,
    rol:1,estado:1,sedeValidada:1}}
  ]).option(signal?{signal}:{});
  const identidad=usuarios[0];
  if(signal?.aborted || !identidad || identidad.estado!=="activo" ||
     !versionCoincide(payload.tokenVersion,identidad.tokenVersion))return false;
  const roles={admin_general:"DUEÑO",admin_sede:"ADMIN_SEDE",mesero:"EMPLEADO"};
  if(roles[identidad.rol]!==payload.rol ||
     String(identidad.empresaId||"")!==payload.empresaId ||
     String(identidad.restauranteId||"")!==String(payload.restaurantId||"") ||
     String(identidad.sedeId||"")!==String(payload.sedeId||""))return false;
  if(identidad.sedeId && identidad.sedeValidada?.length!==1)return false;
  return !signal?.aborted;
 }
 if(tipo==="PERSONAL"){
  const identidad=await consultaCancelable(Personal.findById(payload.sub)
   .select("tokenVersion restaurantId sedeId estado cargo").lean(),signal);
  if(signal?.aborted || !identidad || !versionCoincide(payload.tokenVersion,identidad.tokenVersion) ||
     String(identidad.estado||"").toLowerCase()==="inactivo" ||
     !["mesero","mesera"].includes(identidad.cargo) ||
     payload.rol!=="EMPLEADO" ||
     String(identidad.restaurantId||"")!==String(payload.restaurantId||"") ||
     String(identidad.sedeId||"")!==String(payload.sedeId||""))return false;
  const restaurante=await consultaCancelable(Restaurante.exists({
   restaurantId:identidad.restaurantId,empresaId:payload.empresaId
  }),signal);
  if(signal?.aborted || !restaurante)return false;
  if(identidad.sedeId){
   const sedeFiltro={
    empresaId:payload.empresaId,restauranteId:identidad.restaurantId,
    $or:[{codigoSede:String(identidad.sedeId)}]
   };
   if(require("mongoose").isValidObjectId(identidad.sedeId)){
    sedeFiltro.$or.push({_id:identidad.sedeId});
   }
   if(signal?.aborted || !(await consultaCancelable(Sede.exists(sedeFiltro),signal)) || signal?.aborted)return false;
  }
  return true;
 }
 if(tipo==="ADMIN" || tipo==="RESTAURANTE"){
  const Modelo=MODELOS[tipo];
  const identidad=await consultaCancelable(Modelo.findById(payload.sub)
   .select(tipo==="ADMIN"?"tokenVersion restaurantId":"tokenVersion restaurantId empresaId").lean(),signal);
  if(!identidad || !versionCoincide(payload.tokenVersion,identidad.tokenVersion))return false;
  if(String(identidad.restaurantId||"")!==String(payload.restaurantId||""))return false;
  if(tipo==="RESTAURANTE" && String(identidad.empresaId||"")!==String(payload.empresaId||""))return false;
  const vinculo=await consultaCancelable(Restaurante.exists({
   restaurantId:identidad.restaurantId,empresaId:payload.empresaId
  }),signal);
  return !signal?.aborted && Boolean(vinculo);
 }
 const Modelo=MODELOS[tipo];
 if(!Modelo)return false;
 const identidad=await consultaCancelable(Modelo.findById(payload.sub).select("tokenVersion").lean(),signal);
 if(!identidad)return false;
 return !signal?.aborted && versionCoincide(payload.tokenVersion,identidad.tokenVersion);
}
module.exports={validarVersionSesion};
