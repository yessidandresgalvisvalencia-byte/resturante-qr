"use strict";
// Catalog snapshot for offline order capture. Strict company+site scoping.
// Do not include cost, suppliers, margins, stock, secrets or tenant-wide records.
const HEX=/^[a-fA-F0-9]{24}$/;
function fail(code){const e=new Error(code);e.code=code;throw e;}
async function readOfflineCatalog({db,context,objectId}){
 if(typeof db?.collection!=="function"||typeof objectId!=="function")fail("OFFLINE_CATALOG_DB_UNAVAILABLE");
 if(!context||!HEX.test(context.empresaId||"")||!HEX.test(context.sedeId||"")||
  typeof context.actorId!=="string"||!/^[A-Za-z0-9_-]{1,80}$/.test(context.actorId))
  fail("OFFLINE_CATALOG_AUTH_REQUIRED");
 const cursor=db.collection("productoservicios").find({
  empresaId:objectId(context.empresaId),
  sedeId:objectId(context.sedeId),
  tipo:"producto",activo:true
 },{projection:{_id:1,empresaId:1,sedeId:1,tipo:1,activo:1,nombre:1,precioVenta:1},sort:{nombre:1,_id:1},limit:501});
 const rows=await cursor.toArray();
 if(rows.length>500)fail("OFFLINE_CATALOG_TOO_LARGE");
 const products=rows.map(row=>{
  if(String(row.empresaId).toLowerCase()!==context.empresaId.toLowerCase()||
   String(row.sedeId).toLowerCase()!==context.sedeId.toLowerCase()||
   row.tipo!=="producto"||row.activo!==true||
   !HEX.test(String(row._id))||typeof row.nombre!=="string"||
   !row.nombre.trim()||row.nombre.length>160||
   !Number.isSafeInteger(row.precioVenta)||row.precioVenta<0)
   fail("OFFLINE_CATALOG_INVALID_PRODUCT");
  return Object.freeze({productoId:String(row._id).toLowerCase(),nombre:row.nombre.trim(),
   precioUnitarioCop:String(row.precioVenta)});
 });
 if(new Set(products.map(p=>p.productoId)).size!==products.length)
  fail("OFFLINE_CATALOG_DUPLICATE_PRODUCT");
 return Object.freeze({products,readOnly:true});
}
module.exports={readOfflineCatalog};
