"use strict";
// Evita coerción implícita en tokens y documentos Mongo.
// La ausencia de tokenVersion en sesiones históricas equivale a cero.
function parseVersion(value,{legacy=false}={}){
 if(value===undefined && legacy)return 0;
 if(typeof value!=="number" || !Number.isSafeInteger(value) || value<0)return null;
 return value;
}
function versionCoincide(tokenVersion,dbVersion){
 const token=parseVersion(tokenVersion,{legacy:true});
 const stored=parseVersion(dbVersion,{legacy:true});
 return token!==null && stored!==null && token===stored;
}
function payloadSesionValido(payload){
 if(!payload || typeof payload!=="object" || Array.isArray(payload))return false;
 if(payload.identityType!==undefined && typeof payload.identityType!=="string")return false;
 const tipo=payload.identityType||"";
 // Se conserva compatibilidad con sesiones antiguas sin identityType.
 if(!tipo)return true;
 return typeof payload.sub==="string" && payload.sub.trim().length>0;
}
module.exports={parseVersion,versionCoincide,payloadSesionValido};
