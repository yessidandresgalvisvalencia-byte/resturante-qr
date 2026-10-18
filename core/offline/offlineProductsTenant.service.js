"use strict";
// Validates legacy products exist and are owned by the authenticated tenant.
// Read-only preflight; no stock, cash or sale mutations.
const {validateOfflineLegacyProductIds}=require("./offlineLegacyProductIds.contract");
const HEX24=/^[a-fA-F0-9]{24}$/;
function fail(){const e=new Error("OFFLINE_PRODUCTS_NOT_AUTHORIZED");e.code="OFFLINE_PRODUCTS_NOT_AUTHORIZED";throw e;}
async function verifyOfflineProducts({collection,prepared,context,objectId,session}){
 if(!collection||typeof collection.find!=="function"||typeof objectId!=="function"||
   !context||![context.empresaId,context.sedeId].every(x=>typeof x==="string"&&HEX24.test(x)))fail();
 const ids=validateOfflineLegacyProductIds(prepared);
 const query={_id:{$in:ids.map(id=>objectId(id))},empresaId:objectId(context.empresaId),sedeId:objectId(context.sedeId),activo:true};
 const found=await collection.find(query,{projection:{_id:1,empresaId:1,sedeId:1,activo:1},...(session?{session}:{})}).toArray();
 // Defense in depth: validate returned records, not only the query predicate.
 if(!Array.isArray(found)||found.some(row=>
  String(row?.empresaId).toLowerCase()!==context.empresaId.toLowerCase()||
  String(row?.sedeId).toLowerCase()!==context.sedeId.toLowerCase()||
  row?.activo!==true))fail();
 const valid=new Set(found.map(x=>String(x._id).toLowerCase()));
 if(found.length!==ids.length||valid.size!==ids.length||ids.some(id=>!valid.has(id)))fail();
 return Object.freeze(ids);
}
module.exports={verifyOfflineProducts};
