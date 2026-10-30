/* GRUK offline outbox. Isolated module: no sales, payments or inventory posting. */
(function (root) {
  "use strict";
  const DB_NAME = "gruk-offline-v1";
  const STORE = "outbox";
  function open() {
    return new Promise((resolve,reject)=>{
      const r=indexedDB.open(DB_NAME,1);
      r.onupgradeneeded=()=>{
        const db=r.result;
        if(!db.objectStoreNames.contains(STORE)){
          const s=db.createObjectStore(STORE,{keyPath:"eventId"});
          s.createIndex("syncStatus","syncStatus");
        }
      };
      r.onerror=()=>reject(r.error);
      r.onsuccess=()=>resolve(r.result);
    });
  }
  function tx(db,mode,work) {
    return new Promise((resolve,reject)=>{
      const transaction=db.transaction(STORE,mode);
      const store=transaction.objectStore(STORE);
      let result;
      try{result=work(store);}catch(e){transaction.abort();reject(e);return;}
      transaction.oncomplete=()=>resolve(result);
      transaction.onerror=()=>reject(transaction.error||new Error("OUTBOX_ABORT"));
      transaction.onabort=()=>reject(transaction.error||new Error("OUTBOX_ABORT"));
    });
  }
  async function putPending(event) {
    if(!event||typeof event.eventId!=="string"||!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(event.eventId))throw Error("OUTBOX_EVENT_ID");
    if(!["empresaId","sedeId","actorId"].every(k=>typeof event[k]==="string"&&/^[A-Za-z0-9_-]{1,80}$/.test(event[k])))throw Error("OUTBOX_TENANT_REQUIRED");
    // Verify the serialized snapshot, not just the caller object: custom toJSON
    // must never replace the event identity or authenticated tenant on disk.
    let snapshot;
    try { snapshot=JSON.parse(JSON.stringify(event)); }
    catch (_error) { throw Error("OUTBOX_INVALID_EVENT_SNAPSHOT"); }
    if(!snapshot||typeof snapshot!=="object"||Array.isArray(snapshot)||
       snapshot.eventId!==event.eventId||
       !["empresaId","sedeId","actorId"].every(k=>snapshot[k]===event[k]))
      throw Error("OUTBOX_INVALID_EVENT_SNAPSHOT");
    const db=await open();
    try {
      return await tx(db,"readwrite",store=>{
        const r=store.add({event:snapshot,eventId:snapshot.eventId,syncStatus:"pending",createdAt:new Date().toISOString()});
        return event.eventId;
      });
    }finally{db.close();}
  }
  function validTenantContext(context) {
    return !!context && ["empresaId","sedeId","actorId"].every(k=>
      Object.prototype.hasOwnProperty.call(context,k) &&
      typeof context[k]==="string" && /^[A-Za-z0-9_-]{1,80}$/.test(context[k]));
  }
  // A corrupted IndexedDB row must never make an ACK target a different ULID.
  function ensureRecordKey(record) {
    return !!record && typeof record.eventId==="string" &&
      /^[0-9A-HJKMNP-TV-Z]{26}$/.test(record.eventId) &&
      record.event?.eventId===record.eventId;
  }
  function sameTenantSnapshot(context, identity) {
    return validTenantContext(context) &&
      ["empresaId","sedeId","actorId"].every(k=>context[k]===identity[k]);
  }
  function matchesTenant(event, context) {
    return validTenantContext(context) && ["empresaId","sedeId","actorId"].every(k => event?.[k] === context[k]);
  }
  async function listPending(limit=100, context) {
    if(!context || !validTenantContext(context))throw Error("OUTBOX_TENANT_REQUIRED");
    const identity=Object.freeze({empresaId:context.empresaId,sedeId:context.sedeId,actorId:context.actorId});
    if(!Number.isInteger(limit)||limit<1||limit>100)throw Error("OUTBOX_LIMIT");
    const db=await open();
    try{return await new Promise((resolve,reject)=>{
      const t=db.transaction(STORE,"readonly"),r=t.objectStore(STORE).index("syncStatus").openCursor(IDBKeyRange.only("pending"));
      const events=[];
      r.onerror=()=>reject(r.error||Error("OUTBOX_READ_FAILED"));
      t.onerror=()=>reject(t.error||Error("OUTBOX_ABORT"));
      t.onabort=()=>reject(t.error||Error("OUTBOX_ABORT"));
      r.onsuccess=()=>{const c=r.result;
        if(!sameTenantSnapshot(context,identity)){reject(Error("OUTBOX_SESSION_CHANGED"));return;}if(!c||events.length>=limit){resolve(events);return;}if(matchesTenant(c.value.event,context)){if(!ensureRecordKey(c.value)){reject(Error("OUTBOX_EVENT_ID_MISMATCH"));return;}events.push(c.value.event);}c.continue();};
    });}finally{db.close();}
  }
  async function markReceived(eventId, context) {
    if(!context || !validTenantContext(context))throw Error("OUTBOX_TENANT_REQUIRED");
    if(typeof eventId!=="string"||!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(eventId))throw Error("OUTBOX_EVENT_ID");
    const db=await open();
    try{return await new Promise((resolve,reject)=>{
      const t=db.transaction(STORE,"readwrite"),s=t.objectStore(STORE),r=s.get(eventId);
      let updated=false;
      r.onsuccess=()=>{if(!r.result)return;const v=r.result;if(!matchesTenant(v.event,context))return;if(!ensureRecordKey(v)){reject(Error("OUTBOX_EVENT_ID_MISMATCH"));return;}if(v.syncStatus==="received"){updated=true;return;}if(v.syncStatus!=="pending")return;v.syncStatus="received";v.receivedAt=new Date().toISOString();s.put(v);updated=true;};
      r.onerror=()=>reject(r.error);
      t.oncomplete=()=>resolve(updated);
      t.onerror=()=>reject(t.error||new Error("OUTBOX_ABORT"));
      t.onabort=()=>reject(t.error||new Error("OUTBOX_ABORT"));
    });}finally{db.close();}
  }
  // These events remain stored in IndexedDB after the server acknowledges receipt.
  async function listReceived(limit=100,context) {
    if(!context || !validTenantContext(context))throw Error("OUTBOX_TENANT_REQUIRED");
    const identity=Object.freeze({empresaId:context.empresaId,sedeId:context.sedeId,actorId:context.actorId});
    if(!Number.isInteger(limit)||limit<1||limit>100)throw Error("OUTBOX_LIMIT");
    const db=await open();
    try{return await new Promise((resolve,reject)=>{
      const t=db.transaction(STORE,"readonly"),r=t.objectStore(STORE).index("syncStatus").openCursor(IDBKeyRange.only("received"));
      const records=[];
      r.onerror=()=>reject(r.error||Error("OUTBOX_READ_FAILED"));
      t.onerror=()=>reject(t.error||Error("OUTBOX_ABORT"));
      t.onabort=()=>reject(t.error||Error("OUTBOX_ABORT"));
      r.onsuccess=()=>{const cursor=r.result;
        if(!sameTenantSnapshot(context,identity)){reject(Error("OUTBOX_SESSION_CHANGED"));return;}
        if(!cursor||records.length>=limit){resolve(records);return;}
        if(matchesTenant(cursor.value.event,context)){if(!ensureRecordKey(cursor.value)){reject(Error("OUTBOX_EVENT_ID_MISMATCH"));return;}records.push({eventId:cursor.value.eventId});}
        cursor.continue();
      };
    });}finally{db.close();}
  }
  // This stores the authoritative reconciliation result as metadata ONLY.
  // Local offline events are NEVER deleted, nor interpreted as settled cash.
  async function markReconciled(eventId,context,result) {
    if(!context || !validTenantContext(context))throw Error("OUTBOX_TENANT_REQUIRED");
    if(typeof eventId!=="string"||!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(eventId))throw Error("OUTBOX_EVENT_ID");
    if(!result||result.eventId!==eventId||!["PENDIENTE","EN_REVISION","APLICADO","RECHAZADO"].includes(result.status)||
      typeof result.applied!=="boolean"||typeof result.staged!=="boolean"||
      typeof result.financiallyReconciled!=="boolean"||
      (result.applied===true&&(result.status!=="APLICADO"||result.financiallyReconciled!==true))||
      (result.financiallyReconciled===true&&result.staged!==true)||
      (result.status==="APLICADO"&&result.applied!==true))throw Error("OUTBOX_INVALID_RECONCILIATION");
    const db=await open();
    try{return await new Promise((resolve,reject)=>{
      const t=db.transaction(STORE,"readwrite"),store=t.objectStore(STORE),r=store.get(eventId);
      let updated=false;
      r.onsuccess=()=>{
        const v=r.result;
        if(!v||!matchesTenant(v.event,context)||v.syncStatus!=="received")return;
        if(!ensureRecordKey(v)){reject(Error("OUTBOX_EVENT_ID_MISMATCH"));return;}
        // Never regress a confirmed terminal state on a later stale response.
        if(v.serverStatus==="APLICADO"&&result.status!=="APLICADO")return;
        if(v.serverStatus==="RECHAZADO"&&result.status!=="RECHAZADO")return;
        v.serverStatus=result.status;
        v.serverStaged=result.staged;
        v.serverFinanciallyReconciled=result.financiallyReconciled;
        v.serverApplied=result.applied;
        v.lastReconciledAt=new Date().toISOString();
        store.put(v);updated=true;
      };
      r.onerror=()=>reject(r.error);
      t.oncomplete=()=>resolve(updated);
      t.onerror=()=>reject(t.error);
      t.onabort=()=>reject(t.error||Error("OUTBOX_ABORT"));
    });}finally{db.close();}
  }
  // Operator's own local events only; never delete or expose another tenant's orders.
  async function listLocal(limit=100,context){
    if(!context||!validTenantContext(context))throw Error("OUTBOX_TENANT_REQUIRED");
    const identity=Object.freeze({empresaId:context.empresaId,sedeId:context.sedeId,actorId:context.actorId});
    if(!Number.isInteger(limit)||limit<1||limit>100)throw Error("OUTBOX_LIMIT");
    const db=await open();
    try{return await new Promise((resolve,reject)=>{
      const t=db.transaction(STORE,"readonly"),r=t.objectStore(STORE).openCursor();
      const records=[];
      r.onerror=()=>reject(r.error||Error("OUTBOX_READ_FAILED"));
      t.onerror=()=>reject(t.error||Error("OUTBOX_ABORT"));
      t.onabort=()=>reject(t.error||Error("OUTBOX_ABORT"));
      r.onsuccess=()=>{const cursor=r.result;
        if(!sameTenantSnapshot(context,identity)){reject(Error("OUTBOX_SESSION_CHANGED"));return;}
        if(!cursor||records.length>=limit){resolve(records);return;}
        const v=cursor.value;
        if(matchesTenant(v.event,context)){if(!ensureRecordKey(v)){reject(Error("OUTBOX_EVENT_ID_MISMATCH"));return;}records.push({
          eventId:v.eventId,syncStatus:v.syncStatus,
          serverStatus:v.serverStatus||null,serverApplied:v.serverApplied===true,
          serverStaged:v.serverStaged===true,
          serverFinanciallyReconciled:v.serverFinanciallyReconciled===true
        });}
        cursor.continue();
      };
    });}finally{db.close();}
  }
  // Non-destructive local stock reservations, derived from durable events.
  // Include received events until authoritative reconciliation proves inventory applied.
  async function listStockReservations(context){
    if(!context||!validTenantContext(context))
      throw Error("OUTBOX_TENANT_REQUIRED");
    const identity=Object.freeze({empresaId:context.empresaId,sedeId:context.sedeId,actorId:context.actorId});
    const db=await open();
    try{return await new Promise((resolve,reject)=>{
      const t=db.transaction(STORE,"readonly"),r=t.objectStore(STORE).openCursor();
      const entries=[];
      // Local reservations from many offline orders must not overflow even
      // when each individual item carries a valid safe integer quantity.
      const totalsByProduct=new Map();
      r.onerror=()=>reject(r.error||Error("OUTBOX_READ_FAILED"));
      t.onerror=()=>reject(t.error||Error("OUTBOX_ABORT"));
      t.onabort=()=>reject(t.error||Error("OUTBOX_ABORT"));
      r.onsuccess=()=>{
        const cursor=r.result;
        if(!sameTenantSnapshot(context,identity)){reject(Error("OUTBOX_SESSION_CHANGED"));return;}
        if(!cursor){resolve(entries);return;}
        const v=cursor.value;
        if(matchesTenant(v.event,context)&&
          (v.syncStatus==="pending"||v.syncStatus==="received")&&
          v.serverApplied!==true){
          if(!ensureRecordKey(v)){reject(Error("OUTBOX_EVENT_ID_MISMATCH"));return;}
          const items=v.event?.payload?.items;
          if(!Array.isArray(items)||items.length<1) {reject(Error("OUTBOX_STOCK_EVENT_INVALID"));return;}
          for(const item of items){
            // Corrupted records must never yield partial or undefined stock reservations.
            if(!item||typeof item!=="object"||Array.isArray(item)||
               typeof item.productoId!=="string"||!item.productoId.trim()||
               !Object.prototype.hasOwnProperty.call(item,"cantidad")||
               !(typeof item.cantidad==="number"?
                 Number.isSafeInteger(item.cantidad)&&item.cantidad>0:
                 typeof item.cantidad==="string"&&/^[1-9][0-9]*$/.test(item.cantidad)&&
                 Number.isSafeInteger(Number(item.cantidad)))){
              reject(Error("OUTBOX_STOCK_EVENT_INVALID"));return;
            }
            const previous=totalsByProduct.get(item.productoId)||0;
            const quantity=Number(item.cantidad);
            if(!Number.isSafeInteger(previous+quantity)){
              reject(Error("OUTBOX_STOCK_QUANTITY_OVERFLOW"));return;
            }
            totalsByProduct.set(item.productoId,previous+quantity);
            entries.push({eventId:v.eventId,
              productoId:item.productoId,cantidad:item.cantidad});
          }
        }
        cursor.continue();
      };
    });}finally{db.close();}
  }
  const api=Object.freeze({putPending,listPending,markReceived,listReceived,markReconciled,listLocal,listStockReservations});
  if(typeof module==="object"&&module.exports)module.exports=api;
  else root.GRUKOfflineOutbox=api;
})(typeof globalThis!=="undefined"?globalThis:this);
