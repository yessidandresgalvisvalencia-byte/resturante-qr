/* Offline inventory estimate. Server inventory is authoritative, never locally mutated. */
(function(root){
"use strict";
const HEX=/^[0-9a-f]{24}$/i,INT=/^(0|[1-9][0-9]*)$/;
function fail(code){throw Error(code);}
function scopeKey(context){
 if(!context||["empresaId","sedeId","actorId"].some(k=>typeof context[k]!=="string"||
   !/^[A-Za-z0-9_-]{1,80}$/.test(context[k])))fail("LOCAL_STOCK_TENANT_REQUIRED");
 return [context.empresaId,context.sedeId,context.actorId].join(":");
}
function validateProducts(products){
 if(!Array.isArray(products)||products.length>500)fail("LOCAL_STOCK_INVALID_SNAPSHOT");
 const seen=new Set();
 return products.map(p=>{
  if(!p||typeof p.productoId!=="string"||!HEX.test(p.productoId)||
    typeof p.cantidad!=="string"||!INT.test(p.cantidad)||
    BigInt(p.cantidad)>BigInt(Number.MAX_SAFE_INTEGER)||
    seen.has(p.productoId.toLowerCase()))fail("LOCAL_STOCK_INVALID_SNAPSHOT");
  seen.add(p.productoId.toLowerCase());
  return {productoId:p.productoId.toLowerCase(),cantidad:p.cantidad};
 });
}
function estimate(products,reservations){
 const safe=validateProducts(products),held=new Map();
 if(!Array.isArray(reservations))fail("LOCAL_STOCK_INVALID_RESERVATIONS");
 for(const item of reservations){
  if(!item||typeof item.productoId!=="string"||!HEX.test(item.productoId)||
   typeof item.cantidad!=="string"||!INT.test(item.cantidad)||BigInt(item.cantidad)<1n||
   !/^[0-9A-HJKMNP-TV-Z]{26}$/.test(item.eventId||""))fail("LOCAL_STOCK_INVALID_RESERVATIONS");
  const id=item.productoId.toLowerCase();
  held.set(id,(held.get(id)||0n)+BigInt(item.cantidad));
 }
 const usedIds=new Set();
 const result=safe.map(p=>{
  usedIds.add(p.productoId);
  const reserved=held.get(p.productoId)||0n;
  const available=BigInt(p.cantidad)-reserved;
  return {productoId:p.productoId,confirmed:p.cantidad,reserved:reserved.toString(),
   estimated:available.toString(),warning:available<0n?"LOCAL_OVERSOLD":available===0n?"LOCAL_EMPTY":null};
 });
 // Unknown mapping is not silently interpreted as zero stock.
 for(const id of held.keys())if(!usedIds.has(id))result.push({
  productoId:id,confirmed:null,reserved:held.get(id).toString(),
  estimated:null,warning:"NO_SERVER_STOCK_MAPPING"
 });
 return result;
}
function open(){
 return new Promise((resolve,reject)=>{
  const req=root.indexedDB.open("gruk-offline-stock-v1",1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains("snapshots"))
   req.result.createObjectStore("snapshots",{keyPath:"key"});};
  req.onerror=()=>reject(req.error);req.onsuccess=()=>resolve(req.result);
 });
}
async function saveSnapshot(context,products){
 const key=scopeKey(context),validated=validateProducts(products),db=await open();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction("snapshots","readwrite");
  tx.objectStore("snapshots").put({key,products:validated,updatedAt:new Date().toISOString()});
  tx.oncomplete=()=>resolve(validated.length);
  tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error("LOCAL_STOCK_ABORT"));
 });}finally{db.close();}
}
async function readSnapshot(context){
 const key=scopeKey(context),db=await open();
 try{return await new Promise((resolve,reject)=>{
  const request=db.transaction("snapshots","readonly").objectStore("snapshots").get(key);
  request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{try{
   resolve(request.result?{products:validateProducts(request.result.products),updatedAt:request.result.updatedAt}:
    {products:[],updatedAt:null});
  }catch(e){reject(e);}};
 });}finally{db.close();}
}
async function refresh({context,token,fetchFn}){
 scopeKey(context);
 if(typeof token!=="string"||!token.trim())fail("LOCAL_STOCK_AUTH_REQUIRED");
 if(typeof fetchFn!=="function")fail("LOCAL_STOCK_FETCH_REQUIRED");
 const response=await fetchFn("/api/sync/stock-snapshot",{method:"GET",
  headers:{"Authorization":"Bearer "+token},cache:"no-store",credentials:"same-origin"});
 if(response.status!==200)fail("LOCAL_STOCK_SERVER_UNAVAILABLE");
 const body=await response.json();
 if(body?.ok!==true||body.readOnly!==true)fail("LOCAL_STOCK_INVALID_RESPONSE");
 const validated=validateProducts(body.products);
 await saveSnapshot(context,validated);
 return validated.length;
}
async function preview({context,outbox}){
 if(typeof outbox?.listStockReservations!=="function")fail("LOCAL_STOCK_OUTBOX_REQUIRED");
 const snapshot=await readSnapshot(context);
 const reservations=await outbox.listStockReservations(context);
 return {updatedAt:snapshot.updatedAt,products:estimate(snapshot.products,reservations)};
}
const api=Object.freeze({scopeKey,validateProducts,estimate,saveSnapshot,readSnapshot,refresh,preview});
if(typeof module==="object"&&module.exports)module.exports=api;
else root.GRUKOfflineStock=api;
})(typeof globalThis!=="undefined"?globalThis:this);
