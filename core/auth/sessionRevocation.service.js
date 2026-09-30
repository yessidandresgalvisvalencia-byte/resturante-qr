"use strict";
const Admin=require("../../models/admin");
const Personal=require("../../models/personal");
const Restaurante=require("../../models/restaurante");
const MODELOS=Object.freeze({ADMIN:Admin,PERSONAL:Personal,RESTAURANTE:Restaurante});
async function revocarIdentidad({identityType,usuarioId}){
 const Modelo=MODELOS[String(identityType||"")];
 if(!Modelo||!usuarioId)return false;
 const r=await Modelo.updateOne({_id:usuarioId},{$inc:{tokenVersion:1}});
 return r.matchedCount===1;
}
module.exports={revocarIdentidad};