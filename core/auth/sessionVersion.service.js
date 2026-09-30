"use strict";
const Admin=require("../../models/admin");
const Personal=require("../../models/personal");
const Restaurante=require("../../models/restaurante");
const MODELOS=Object.freeze({ADMIN:Admin,PERSONAL:Personal,RESTAURANTE:Restaurante});
async function validarVersionSesion(payload){
 const tipo=String(payload.identityType||"");
 if(!tipo) return true;
 const Modelo=MODELOS[tipo];
 if(!Modelo)return false;
 const identidad=await Modelo.findById(payload.sub).select("tokenVersion").lean();
 if(!identidad)return false;
 return Number(identidad.tokenVersion||0)===Number(payload.tokenVersion||0);
}
module.exports={validarVersionSesion};