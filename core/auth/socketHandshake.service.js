"use strict";
const jwt=require("jsonwebtoken");
const {claimsValidas}=require("./jwtClaims.guard");
const {validarVersionSesion}=require("./sessionVersion.service");

// Reusa las mismas garantías JWT que el middleware HTTP antes de unir rooms.
async function autenticarSocket({token,secret,signal,verificarSesion=validarVersionSesion}={}){
 if(signal?.aborted || typeof token!=="string" || !secret || token.length>8192)return null;
 const limpio=token.replace(/^Bearer\s+/i,"").trim();
 if(!limpio)return null;
 try{
  const payload=jwt.verify(limpio,secret,{algorithms:["HS256"]});
  if(!claimsValidas(payload) || !payload.identityType)return null;
  if(!(await verificarSesion(payload,{signal})) || signal?.aborted)return null;
  return Object.freeze({
   usuarioId:String(payload.sub),empresaId:String(payload.empresaId),
   sedeId:payload.sedeId?String(payload.sedeId):null,
   rol:String(payload.rol),identityType:String(payload.identityType),
   tokenVersion:payload.tokenVersion===undefined?0:payload.tokenVersion
  });
 }catch{return null;}
}
module.exports={autenticarSocket};
