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
  const api=Object.freeze({putPending,listPending,markReceived});
  if(typeof module==="object"&&module.exports)module.exports=api;
  else root.GRUKOfflineOutbox=api;
})(typeof globalThis!=="undefined"?globalThis:this);
