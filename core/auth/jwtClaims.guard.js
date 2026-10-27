"use strict";
const {parseVersion}=require("./tokenVersion.guard");
const ROLES=new Set(["DUEÑO","ADMIN_SEDE","EMPLEADO"]);
const nonempty=(value)=>typeof value==="string"&&value.trim().length>0;
function claimsValidas(payload){
 if(!payload||typeof payload!=="object"||Array.isArray(payload))return false;
 if(!nonempty(payload.sub)||!nonempty(payload.empresaId))return false;
 if(typeof payload.rol!=="string"||!ROLES.has(payload.rol))return false;
 for(const key of ["sedeId","restaurantId","identityType"]){
  if(payload[key]!==undefined&&payload[key]!==null&&!nonempty(payload[key]))return false;
 }
 if(parseVersion(payload.tokenVersion,{legacy:true})===null)return false;
 return true;
}
module.exports={claimsValidas};
