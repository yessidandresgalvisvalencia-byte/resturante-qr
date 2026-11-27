"use strict";
const mongoose=require("mongoose");
const {ROLES_GRUK}=require("./roleCheck.middleware");
const validId=v=>typeof v==="string"&&mongoose.isObjectIdOrHexString(v);
function catalogScope(auth,write){
 if(!validId(auth?.empresaId))return null;
 if(auth.rol===ROLES_GRUK.DUENO)return {empresaId:auth.empresaId};
 if(auth.rol!==ROLES_GRUK.ADMIN_SEDE||!validId(auth.sedeId))return null;
 return {empresaId:auth.empresaId,sedeId:write?auth.sedeId:{$in:[null,auth.sedeId]}};
}
async function resolveCatalogSite(auth,requested,Sede){
 const scope=catalogScope(auth,true);
 if(!scope)return {ok:false,status:403,error:"Sede no autorizada"};
 if(requested!==undefined&&requested!==null&&requested!==""&&!validId(requested))return {ok:false,status:400,error:"sedeId inválido"};
 if(auth.rol===ROLES_GRUK.ADMIN_SEDE&&requested&&requested!==auth.sedeId)return {ok:false,status:403,error:"Sede no autorizada"};
 const site=auth.rol===ROLES_GRUK.ADMIN_SEDE?auth.sedeId:requested||null;
 if(site&&!(await Sede.findOne({_id:site,empresaId:auth.empresaId}).select("_id").lean()))return {ok:false,status:403,error:"Sede no autorizada"};
 return {ok:true,sedeId:site};
}
const mutable=new Set(["tipo","nombre","descripcion","categoria","sku","precioVenta","costoUnitario","manejaInventario","unidad","activo","origen","metadata"]);
function catalogChanges(body){
 if(!body||typeof body!=="object"||Array.isArray(body))return null;
 const changes={};
 for(const [k,v] of Object.entries(body)){
  // Legacy forms may echo the company ID; never apply it.
  if(k==="empresaId")continue;
  if(!mutable.has(k))return null;
  changes[k]=v;
 }
 return Object.keys(changes).length?changes:null;
}
module.exports={catalogScope,resolveCatalogSite,catalogChanges};
