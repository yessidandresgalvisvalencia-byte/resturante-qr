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
      transaction.onerror=()=>reject(transaction.error);
      transaction.onabort=()=>reject(transaction.error||new Error("OUTBOX_ABORT"));
    });
  }
  async function putPending(event) {
    if(!event||typeof event.eventId!=="string"||!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(event.eventId))throw Error("OUTBOX_EVENT_ID");
    if(!["empresaId","sedeId","actorId"].every(k=>typeof event[k]==="string"&&event[k].length>0))throw Error("OUTBOX_TENANT_REQUIRED");
    const db=await open();
    try {
      return await tx(db,"readwrite",store=>{
        const r=store.add({event:JSON.parse(JSON.stringify(event)),eventId:event.eventId,syncStatus:"pending",createdAt:new Date().toISOString()});
        return event.eventId;
      });
    }finally{db.close();}
  }
  function matchesTenant(event, context) {
    return context && ["empresaId","sedeId","actorId"].every(k => typeof context[k] === "string" && context[k].length > 0 && event?.[k] === context[k]);
  }
  async function listPending(limit=100, context) {
    if(!context || ["empresaId","sedeId","actorId"].some(k=>typeof context[k]!=="string"||!context[k]))throw Error("OUTBOX_TENANT_REQUIRED");
    if(!Number.isInteger(limit)||limit<1||limit>100)throw Error("OUTBOX_LIMIT");
    const db=await open();
    try{return await new Promise((resolve,reject)=>{
      const t=db.transaction(STORE,"readonly"),r=t.objectStore(STORE).index("syncStatus").openCursor(IDBKeyRange.only("pending"));
      const events=[];
      r.onerror=()=>reject(r.error);
      r.onsuccess=()=>{const c=r.result;if(!c||events.length>=limit){resolve(events);return;}if(matchesTenant(c.value.event,context))events.push(c.value.event);c.continue();};
    });}finally{db.close();}
  }
  async function markReceived(eventId, context) {
    if(!context || ["empresaId","sedeId","actorId"].some(k=>typeof context[k]!=="string"||!context[k]))throw Error("OUTBOX_TENANT_REQUIRED");
    const db=await open();
    try{return await new Promise((resolve,reject)=>{
      const t=db.transaction(STORE,"readwrite"),s=t.objectStore(STORE),r=s.get(eventId);
      let updated=false;
      r.onsuccess=()=>{if(!r.result)return;const v=r.result;if(!matchesTenant(v.event,context))return;if(v.syncStatus==="received"){updated=true;return;}if(v.syncStatus!=="pending")return;v.syncStatus="received";v.receivedAt=new Date().toISOString();s.put(v);updated=true;};
      r.onerror=()=>reject(r.error);
      t.oncomplete=()=>resolve(updated);
      t.onerror=()=>reject(t.error);
    });}finally{db.close();}
  }
  // These events remain stored in IndexedDB after the server acknowledges receipt.
  async function listReceived(limit=100,context) {
    if(!context || ["empresaId","sedeId","actorId"].some(k=>typeof context[k]!=="string"||!context[k]))throw Error("OUTBOX_TENANT_REQUIRED");
    if(!Number.isInteger(limit)||limit<1||limit>100)throw Error("OUTBOX_LIMIT");
    const db=await open();
    try{return await new Promise((resolve,reject)=>{
      const t=db.transaction(STORE,"readonly"),r=t.objectStore(STORE).index("syncStatus").openCursor(IDBKeyRange.only("received"));
      const records=[];
      r.onerror=()=>reject(r.error);
      r.onsuccess=()=>{const cursor=r.result;
        if(!cursor||records.length>=limit){resolve(records);return;}
        if(matchesTenant(cursor.value.event,context))records.push({eventId:cursor.value.eventId});
        cursor.continue();
      };
    });}finally{db.close();}
  }
  // This stores the authoritative reconciliation result as metadata ONLY.
  // Local offline events are NEVER deleted, nor interpreted as settled cash.
  async function markReconciled(eventId,context,result) {
    if(!context || ["empresaId","sedeId","actorId"].some(k=>typeof context[k]!=="string"||!context[k]))throw Error("OUTBOX_TENANT_REQUIRED");
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
    if(!context||["empresaId","sedeId","actorId"].some(k=>typeof context[k]!=="string"||!context[k]))throw Error("OUTBOX_TENANT_REQUIRED");
    if(!Number.isInteger(limit)||limit<1||limit>100)throw Error("OUTBOX_LIMIT");
    const db=await open();
    try{return await new Promise((resolve,reject)=>{
      const t=db.transaction(STORE,"readonly"),r=t.objectStore(STORE).openCursor();
      const records=[];
      r.onerror=()=>reject(r.error);
      r.onsuccess=()=>{const cursor=r.result;
        if(!cursor||records.length>=limit){resolve(records);return;}
        const v=cursor.value;
        if(matchesTenant(v.event,context))records.push({
          eventId:v.eventId,syncStatus:v.syncStatus,
          serverStatus:v.serverStatus||null,serverApplied:v.serverApplied===true,
          serverStaged:v.serverStaged===true,
          serverFinanciallyReconciled:v.serverFinanciallyReconciled===true
        });
        cursor.continue();
      };
    });}finally{db.close();}
  }
  const api=Object.freeze({putPending,listPending,markReceived,listReceived,markReconciled,listLocal});
  if(typeof module==="object"&&module.exports)module.exports=api;
  else root.GRUKOfflineOutbox=api;
})(typeof globalThis!=="undefined"?globalThis:this);
