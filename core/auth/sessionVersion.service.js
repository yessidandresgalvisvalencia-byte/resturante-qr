"use strict";
const Admin=require("../../models/admin");
const Personal=require("../../models/personal");
const Restaurante=require("../../models/restaurante");
const Usuario=require("../../models/usuario");
const {versionCoincide,payloadSesionValido}=require("./tokenVersion.guard");
const MODELOS=Object.freeze({ADMIN:Admin,PERSONAL:Personal,RESTAURANTE:Restaurante,USUARIO:Usuario});
async function validarVersionSesion(payload){
 if(!payloadSesionValido(payload))return false;
 const tipo=payload.identityType||"";
 if(!tipo)return true;
 const Modelo=MODELOS[tipo];
 if(!Modelo)return false;
 const identidad=await Modelo.findById(payload.sub).select("tokenVersion estado").lean();
 if(!identidad || (tipo==="USUARIO" && identidad.estado!=="activo"))return false;
 return versionCoincide(payload.tokenVersion,identidad.tokenVersion);
}
module.exports={validarVersionSesion};
