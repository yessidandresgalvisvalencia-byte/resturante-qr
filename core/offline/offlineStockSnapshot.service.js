"use strict";
// Only a snapshot of confirmed inventory: NO offline mutations or payments.
const HEX=/^[0-9a-f]{24}$/i;
function fail(code){const error=new Error(code);error.code=code;throw error;}
async function readOfflineStockSnapshot({db,context,objectId}){
 if(typeof db?.collection!=="function"||typeof objectId!=="function")fail("OFFLINE_STOCK_DB_UNAVAILABLE");
 if(!context||!HEX.test(context.empresaId||"")||!HEX.test(context.sedeId||"")||
  typeof context.actorId!=="string"||!/^[A-Za-z0-9_-]{1,80}$/.test(context.actorId))
  fail("OFFLINE_STOCK_AUTH_REQUIRED");
 const rows=await db.collection("inventarios").find({
  empresaId:objectId(context.empresaId),sedeId:objectId(context.sedeId),anulado:false,
  productoServicioId:{$ne:null}
 },{projection:{_id:0,empresaId:1,sedeId:1,anulado:1,productoServicioId:1,cantidad:1},limit:501}).toArray();
 if(rows.length>500)fail("OFFLINE_STOCK_TOO_LARGE");
 const products=[],seen=new Set();
 for(const row of rows){
  const id=String(row.productoServicioId||"").toLowerCase();
  if(String(row.empresaId).toLowerCase()!==context.empresaId.toLowerCase()||
   String(row.sedeId).toLowerCase()!==context.sedeId.toLowerCase()||
   row.anulado!==false||!HEX.test(id)||seen.has(id)||
   !Number.isSafeInteger(row.cantidad)||row.cantidad<0)
   fail("OFFLINE_STOCK_INVALID_MAPPING");
  seen.add(id);
  products.push(Object.freeze({productoId:id,cantidad:String(row.cantidad)}));
 }
 return Object.freeze({readOnly:true,products});
}
module.exports={readOfflineStockSnapshot};
