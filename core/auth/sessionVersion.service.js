"use strict";
const Admin=require("../../models/admin");
const Personal=require("../../models/personal");
const Restaurante=require("../../models/restaurante");
const Usuario=require("../../models/usuario");
const Sede=require("../../models/sede");
const {versionCoincide,payloadSesionValido}=require("./tokenVersion.guard");
const MODELOS=Object.freeze({ADMIN:Admin,PERSONAL:Personal,RESTAURANTE:Restaurante,USUARIO:Usuario});
async function validarVersionSesion(payload){
 if(!payloadSesionValido(payload))return false;
 const tipo=payload.identityType||"";
 if(!tipo)return true;
 if(tipo==="USUARIO"){
  const identidad=await Usuario.findById(payload.sub)
   .select("tokenVersion empresaId restauranteId sedeId rol estado").lean();
  if(!identidad || identidad.estado!=="activo" ||
     !versionCoincide(payload.tokenVersion,identidad.tokenVersion))return false;
  const roles={admin_general:"DUEÑO",admin_sede:"ADMIN_SEDE",mesero:"EMPLEADO"};
  if(roles[identidad.rol]!==payload.rol ||
     String(identidad.empresaId||"")!==payload.empresaId ||
     String(identidad.restauranteId||"")!==String(payload.restaurantId||"") ||
     String(identidad.sedeId||"")!==String(payload.sedeId||""))return false;
  if(identidad.sedeId){
   const sede=await Sede.exists({
    _id:identidad.sedeId,empresaId:identidad.empresaId,
    restauranteId:identidad.restauranteId
   });
   if(!sede)return false;
  }
  return true;
 }
 const Modelo=MODELOS[tipo];
 if(!Modelo)return false;
 const identidad=await Modelo.findById(payload.sub).select("tokenVersion").lean();
 if(!identidad)return false;
 return versionCoincide(payload.tokenVersion,identidad.tokenVersion);
}
module.exports={validarVersionSesion};
