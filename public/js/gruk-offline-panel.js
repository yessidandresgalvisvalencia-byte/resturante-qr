/* Read-only operational panel; synchronization only sends durable offline inbox events. */
(function(root){
"use strict";
const validate=/^[A-Za-z0-9_-]{1,80}$/;
function readSession(storage){
 const token=storage?.getItem("grukAuthToken");
 if(typeof token!=="string"||!token.trim())throw Error("PANEL_AUTH_REQUIRED");
 let payload;
 try{
  const raw=token.split(".")[1];
  if(!raw||typeof atob!=="function")throw Error("invalid jwt");
  payload=JSON.parse(atob(raw.replace(/-/g,"+").replace(/_/g,"/")));
 }catch(_){throw Error("PANEL_AUTH_REQUIRED");}
 const context={
  empresaId:payload.empresaId,sedeId:payload.sedeId,
  actorId:payload.sub
 };
 if(!Object.values(context).every(x=>typeof x==="string"&&validate.test(x)))throw Error("PANEL_SEDE_REQUIRED");
 // JWT claims here only filter IndexedDB; server always authenticates bearer token independently.
 return {token,context};
}
function statusLabel(event){
 if(event.syncStatus==="pending")return "Guardado localmente · sin enviar";
 if(event.serverApplied===true&&event.serverFinanciallyReconciled===true)return "Aplicado y conciliado";
 if(event.serverStatus==="RECHAZADO")return "Rechazado · revisión necesaria";
 if(event.serverStatus==="EN_REVISION")return "En revisión · no equivale a pago";
 if(event.serverStatus==="PENDIENTE")return "Recibido · pendiente";
 return "Recibido · por verificar";
}
async function launch({document,window,storage,outbox,transport,fetchFn,draft=root.GRUKOfflineDraft,catalog=root.GRUKOfflineCatalog,stock=root.GRUKOfflineStock}){
 const nodes={rows:document.getElementById("rows"),message:document.getElementById("message"),
  connection:document.getElementById("connection"),identity:document.getElementById("identity"),
  refresh:document.getElementById("refresh"),send:document.getElementById("send"),
  reconcile:document.getElementById("reconcile"),
  draftForm:document.getElementById("offlineDraftForm"),saveDraft:document.getElementById("saveDraft"),
  productId:document.getElementById("productId"),quantity:document.getElementById("quantity"),
  unitPrice:document.getElementById("unitPrice"),
  refreshCatalog:document.getElementById("refreshCatalog"),catalogInfo:document.getElementById("catalogInfo"),
  refreshStock:document.getElementById("refreshStock"),stockInfo:document.getElementById("stockInfo"),
  stockEstimate:document.getElementById("stockEstimate")};
 if(Object.values(nodes).some(x=>!x))throw Error("PANEL_DOM_REQUIRED");
 let credentials;
 try{credentials=readSession(storage);}
 catch(e){
  nodes.identity.textContent="Inicia sesión para acceder a los pedidos de tu empresa y sede.";
  nodes.send.disabled=true;nodes.reconcile.disabled=true;nodes.refresh.disabled=true;
  nodes.saveDraft.disabled=true;nodes.refreshCatalog.disabled=true;nodes.refreshStock.disabled=true;
  return {authenticated:false};
 }
 const {token,context}=credentials;
 let localProducts=[];
 function presentCatalog(snapshot){
  localProducts=snapshot.products;
  nodes.productId.replaceChildren();
  const placeholder=document.createElement("option");placeholder.value="";placeholder.textContent="Selecciona un producto";
  nodes.productId.appendChild(placeholder);
  for(const product of localProducts){
   const option=document.createElement("option");option.value=product.productoId;
   option.textContent=product.nombre+" · $"+product.precioUnitarioCop+" COP";nodes.productId.appendChild(option);
  }
  nodes.unitPrice.value="";
  nodes.catalogInfo.textContent=snapshot.updatedAt?"Copia local: "+snapshot.updatedAt:"Sin catálogo local";
 }
 async function showStock(){
  if(typeof stock?.preview!=="function")return;
  const snapshot=await stock.preview({context,outbox});
  nodes.stockInfo.textContent=snapshot.updatedAt?"Stock confirmado: "+snapshot.updatedAt:"Sin fotografía de inventario";
  const selected=snapshot.products.find(x=>x.productoId===nodes.productId.value);
  nodes.stockEstimate.textContent=!selected?"Selecciona un producto para ver disponibilidad estimada":
   selected.estimated===null?"Sin mapeo confirmado de stock para este producto":
   "Servidor: "+selected.confirmed+" · Pedidos locales pendientes: "+selected.reserved+
   " · Disponible estimado: "+selected.estimated+(selected.warning?" · ALERTA "+selected.warning:"");
 }
 nodes.productId.addEventListener("change",()=>{
  const selected=localProducts.find(x=>x.productoId===nodes.productId.value);
  nodes.unitPrice.value=selected?selected.precioUnitarioCop:"";
  showStock().catch(()=>{nodes.stockEstimate.textContent="Stock local no disponible";});
 });
 nodes.identity.textContent="Bandeja privada del operador · "+context.sedeId;
 const showConnection=()=>{nodes.connection.textContent=window.navigator.onLine?"Conexión disponible":"Sin conexión · pedidos locales conservados";};
 window.addEventListener("online",showConnection);
 window.addEventListener("offline",showConnection);
 showConnection();
 async function render(){
  const records=await outbox.listLocal(100,context);
  nodes.rows.replaceChildren();
  if(records.length===0){
   const row=document.createElement("tr"),cell=document.createElement("td");
   cell.colSpan=4;cell.textContent="No hay pedidos offline de este operador guardados aquí.";
   row.appendChild(cell);nodes.rows.appendChild(row);
  }
  for(const record of records){
   const row=document.createElement("tr");
   for(const value of [record.eventId,record.syncStatus==="pending"?"Pendiente de envío":"Recibido",
    record.serverStatus||"Sin consultar",statusLabel(record)]){
    const cell=document.createElement("td");cell.textContent=String(value);row.appendChild(cell);
   }
   nodes.rows.appendChild(row);
  }
  return records.length;
 }
 async function perform(action){
  for(const name of ["send","reconcile","refresh","saveDraft","refreshCatalog","refreshStock"])nodes[name].disabled=true;
  try{
   const result=await action();
   await render();
   await showStock().catch(()=>{nodes.stockEstimate.textContent="Stock local no disponible";});
   nodes.message.textContent=typeof result==="string"?result:JSON.stringify(result);
  }catch(e){
   nodes.message.textContent="No se completó la operación: "+String(e.message||"error");
  }finally{
   for(const name of ["send","reconcile","refresh"])nodes[name].disabled=false;
   showConnection();
  }
 }
 nodes.refresh.addEventListener("click",()=>perform(async()=>("Pedidos locales actualizados.")));
 nodes.send.addEventListener("click",()=>perform(async()=>{
  if(!window.navigator.onLine)throw Error("SIN_CONEXION");
  return transport.synchronizeAll({outbox,token,fetchFn,context});
 }));
 nodes.reconcile.addEventListener("click",()=>perform(async()=>{
  if(!window.navigator.onLine)throw Error("SIN_CONEXION");
  return transport.reconcileReceived({outbox,token,fetchFn,context});
 }));
 nodes.refreshCatalog.addEventListener("click",()=>perform(async()=>{
  if(!window.navigator.onLine)throw Error("SIN_CONEXION");
  if(typeof catalog?.refresh!=="function")throw Error("OFFLINE_CATALOG_UNAVAILABLE");
  await catalog.refresh({context,token,fetchFn});
  presentCatalog(await catalog.readSnapshot(context));
  return "Catálogo autorizado actualizado en este dispositivo.";
 }));
 nodes.refreshStock.addEventListener("click",()=>perform(async()=>{
  if(!window.navigator.onLine)throw Error("SIN_CONEXION");
  if(typeof stock?.refresh!=="function")throw Error("LOCAL_STOCK_UNAVAILABLE");
  await stock.refresh({context,token,fetchFn});
  return "Fotografía del stock servidor actualizada. Sujeto a ventas de otras tablets.";
 }));
 nodes.draftForm.addEventListener("submit",event=>{
  event.preventDefault();
  perform(async()=>{
   if(typeof draft?.saveOfflineOrder!=="function")throw Error("OFFLINE_DRAFT_UNAVAILABLE");
   const deviceKey="grukOfflineDeviceId";
   let deviceId=storage.getItem(deviceKey);
   if(!/^[A-Za-z0-9_-]{1,80}$/.test(deviceId||"")){
    if(typeof window.crypto?.randomUUID!=="function")throw Error("OFFLINE_DEVICE_ID_UNAVAILABLE");
    deviceId="device_"+window.crypto.randomUUID().replace(/-/g,"");
    storage.setItem(deviceKey,deviceId);
   }
   const selected=localProducts.find(x=>x.productoId===nodes.productId.value);
   if(!selected||nodes.unitPrice.value!==selected.precioUnitarioCop)throw Error("OFFLINE_CATALOG_SELECTION_REQUIRED");
   const result=await draft.saveOfflineOrder({
    outbox,context,deviceId,
    productoId:nodes.productId.value.trim(),cantidad:nodes.quantity.value.trim(),
    precioUnitarioCop:nodes.unitPrice.value.trim(),cryptoSource:window.crypto
   });
   return "Pedido guardado localmente. No cobrado ni aplicado: "+result.eventId;
  });
 });
 if(typeof catalog?.readSnapshot==="function"){
  try{presentCatalog(await catalog.readSnapshot(context));}
  catch(_){nodes.catalogInfo.textContent="Catálogo local no disponible; actualiza con internet";}
 }
 await render();
 await showStock().catch(()=>{nodes.stockEstimate.textContent="Stock local no disponible";});
 return {authenticated:true,refresh:render};
}
const api=Object.freeze({readSession,statusLabel,launch});
if(typeof module==="object"&&module.exports)module.exports=api;
else {
 root.GRUKOfflinePanel=api;
 if(root.document&&root.GRUKOfflineOutbox&&root.GRUKOfflineTransport){
  const start=()=>api.launch({document:root.document,window:root,
    storage:root.localStorage,outbox:root.GRUKOfflineOutbox,
    transport:root.GRUKOfflineTransport,draft:root.GRUKOfflineDraft,catalog:root.GRUKOfflineCatalog,stock:root.GRUKOfflineStock,fetchFn:root.fetch.bind(root)}).catch(e=>{
     const node=root.document.getElementById("message");
     if(node)node.textContent="No fue posible abrir el panel: "+String(e.message||"error");
    });
  if(root.document.readyState==="loading")root.document.addEventListener("DOMContentLoaded",start);
  else start();
 }
}
})(typeof globalThis!=="undefined"?globalThis:this);
