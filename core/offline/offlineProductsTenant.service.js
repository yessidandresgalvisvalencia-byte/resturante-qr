"use strict";
// Validates legacy products exist and are owned by the authenticated tenant.
// Read-only preflight; no stock, cash or sale mutations.
const {validateOfflineLegacyProductIds}=require("./offlineLegacyProductIds.contract");
const HEX24=/^[a-fA-F0-9]{24}$/;
function fail(){const e=new Error("OFFLINE_PRODUCTS_NOT_AUTHORIZED");e.code="OFFLINE_PRODUCTS_NOT_AUTHORIZED";throw e;}
async function verifyOfflineProducts({collection,prepared,context,objectId}){
 if(!collection||typeof collection.find!=="function"||typeof objectId!=="function"||
   !context||![context.empresaId,context.sedeId].every(x=>typeof x==="string"&&HEX24.test(x)))fail();
 const ids=validateOfflineLegacyProductIds(prepared);
 const query={_id:{$in:ids.map(id=>objectId(id))},empresaId:objectId(context.empresaId),sedeId:objectId(context.sedeId),activo:true};
 const found=await collection.find(query,{projection:{_id:1}}).toArray();
 const valid=new Set(found.map(x=>String(x._id).toLowerCase()));
 if(valid.size!==ids.length||ids.some(id=>!valid.has(id)))fail();
 return Object.freeze(ids);
}
module.exports={verifyOfflineProducts};
