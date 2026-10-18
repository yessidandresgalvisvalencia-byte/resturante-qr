/* Local catalog snapshot for offline technical drafts; never finalizes sales. */
(function(root){
"use strict";
const HEX=/^[0-9a-f]{24}$/i,SAFE=/^[A-Za-z0-9_-]{1,80}$/;
function fail(code){throw Error(code);}
function keyFor(context){
 if(!context||![context.empresaId,context.sedeId,context.actorId].every(x=>typeof x==="string"&&SAFE.test(x)))
  fail("OFFLINE_CATALOG_CONTEXT_REQUIRED");
 return [context.empresaId,context.sedeId,context.actorId].join(":");
}
function validateProducts(products){
 if(!Array.isArray(products)||products.length>500)fail("OFFLINE_CATALOG_INVALID_SNAPSHOT");
 const ids=new Set();
 return products.map(product=>{
  if(!product||typeof product.productoId!=="string"||!HEX.test(product.productoId)||
   typeof product.nombre!=="string"||!product.nombre.trim()||product.nombre.length>160||
   typeof product.precioUnitarioCop!=="string"||!/^(0|[1-9][0-9]*)$/.test(product.precioUnitarioCop)||
   BigInt(product.precioUnitarioCop)>BigInt(Number.MAX_SAFE_INTEGER)||
   ids.has(product.productoId.toLowerCase()))fail("OFFLINE_CATALOG_INVALID_SNAPSHOT");
  ids.add(product.productoId.toLowerCase());
  return {productoId:product.productoId.toLowerCase(),nombre:product.nombre.trim(),
   precioUnitarioCop:product.precioUnitarioCop};
 });
}
function open(){
 return new Promise((resolve,reject)=>{
  const req=root.indexedDB.open("gruk-offline-catalog-v1",1);
  req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains("snapshots"))db.createObjectStore("snapshots",{keyPath:"key"});};
  req.onerror=()=>reject(req.error);
  req.onsuccess=()=>resolve(req.result);
 });
}
async function saveSnapshot(context,products){
 const key=keyFor(context),safe=validateProducts(products),db=await open();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction("snapshots","readwrite");
  tx.objectStore("snapshots").put({key,products:safe,updatedAt:new Date().toISOString()});
  tx.oncomplete=()=>resolve(safe.length);
  tx.onerror=()=>reject(tx.error);
  tx.onabort=()=>reject(tx.error||Error("OFFLINE_CATALOG_ABORT"));
 });}finally{db.close();}
}
async function readSnapshot(context){
 const key=keyFor(context),db=await open();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction("snapshots","readonly"),req=tx.objectStore("snapshots").get(key);
  req.onsuccess=()=>{try{
   if(!req.result){resolve({products:[],updatedAt:null});return;}
   resolve({products:validateProducts(req.result.products),updatedAt:req.result.updatedAt});
  }catch(e){reject(e);}};
  req.onerror=()=>reject(req.error);
 });}finally{db.close();}
}
async function refresh({context,token,fetchFn}){
 keyFor(context);
 if(typeof token!=="string"||!token.trim())fail("OFFLINE_CATALOG_AUTH_REQUIRED");
 if(typeof fetchFn!=="function")fail("OFFLINE_CATALOG_FETCH_REQUIRED");
 const response=await fetchFn("/api/sync/catalog",{
  method:"GET",headers:{"Authorization":"Bearer "+token},cache:"no-store",credentials:"same-origin"
 });
 if(response.status!==200)fail("OFFLINE_CATALOG_REMOTE_UNAVAILABLE");
 const result=await response.json();
 if(result?.ok!==true||result.readOnly!==true)fail("OFFLINE_CATALOG_INVALID_RESPONSE");
 const products=validateProducts(result.products);
 await saveSnapshot(context,products);
 return {products,updated:true};
}
const api=Object.freeze({keyFor,validateProducts,readSnapshot,saveSnapshot,refresh});
if(typeof module==="object"&&module.exports)module.exports=api;
else root.GRUKOfflineCatalog=api;
})(typeof globalThis!=="undefined"?globalThis:this);
