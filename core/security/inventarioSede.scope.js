"use strict";
const mongoose=require("mongoose");
function sedeAutorizada(auth){
 if(!auth || !auth.empresaId)return null;
 if(auth.rol==="DUEÑO")return {empresaId:auth.empresaId};
 if(auth.rol!=="ADMIN_SEDE")return null;
 if(typeof auth.sedeId!=="string" || !mongoose.isValidObjectId(auth.sedeId))return null;
 return {empresaId:auth.empresaId,sedeId:auth.sedeId};
}
function altaPermitida(auth,datos){
 const alcance=sedeAutorizada(auth);
 if(!alcance)return false;
 if(datos.empresaId && String(datos.empresaId)!==String(auth.empresaId))return false;
 if(auth.rol==="ADMIN_SEDE")return !datos.sedeId || String(datos.sedeId)===String(auth.sedeId);
 return true;
}
function prepararAlta(auth,datos){
 if(!altaPermitida(auth,datos))return null;
 const copia={...datos,empresaId:auth.empresaId};
 if(auth.rol==="ADMIN_SEDE")copia.sedeId=auth.sedeId;
 return copia;
}
module.exports={sedeAutorizada,altaPermitida,prepararAlta};
