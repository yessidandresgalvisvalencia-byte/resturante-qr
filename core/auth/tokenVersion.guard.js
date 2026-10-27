"use strict";
// Evita que valores como null, "", "0" o false se acepten como version 0.
// La ausencia del campo en JWT históricos se trata como versión 0.
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
module.exports={parseVersion,versionCoincide};
