"use strict";
async function ensureOfflineSalesIndexes(db){
 if(typeof db?.collection!=="function")throw new TypeError("OFFLINE_DATABASE_REQUIRED");
 await db.collection("gruk_offline_ventas").createIndex(
  {empresaId:1,sedeId:1,eventId:1},{unique:true,name:"uniq_offline_sale_tenant_event"});
 return true;
}
module.exports={ensureOfflineSalesIndexes};
