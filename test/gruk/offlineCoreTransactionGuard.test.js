"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {acceptOfflineBatch} = require("../../core/offline/offlineInbox.service");
const context = {empresaId:"empresaA",sedeId:"sedeA",actorId:"cajeroA"};
const ids=["01ARZ3NDEKTSV4RRFFQ69G5FA0","01ARZ3NDEKTSV4RRFFQ69G5FA1"];
const events=ids.map((eventId,i)=>({
  eventId,...context,deviceId:"tabletA",tipo:"PEDIDO_REGISTRADO",
  occurredAt:"2026-10-17T12:00:00.000Z",schemaVersion:1,
  payload:{localOrderId:"order"+i}
}));
test("núcleo offline: sin sesiones Mongo rechaza 2 eventos antes de escribir",async()=>{
  let writes=0;
  const db={collection(){writes++;throw new Error("WRITE_FORBIDDEN");}};
  await assert.rejects(
    acceptOfflineBatch({db,authenticatedContext:context,events}),
    err=>err.code==="OFFLINE_TRANSACTION_UNAVAILABLE"
  );
  assert.equal(writes,0);
});

test("núcleo offline: sesión sin withTransaction rechaza lote y libera sesión",async()=>{
  let writes=0,closed=0;
  const db={
    client:{startSession:()=>({endSession:async()=>{closed++;}})},
    collection(){writes++;throw new Error("WRITE_FORBIDDEN");}
  };
  await assert.rejects(
    acceptOfflineBatch({db,authenticatedContext:context,events}),
    err=>err.code==="OFFLINE_TRANSACTION_UNAVAILABLE"
  );
  assert.equal(writes,0);
  assert.equal(closed,1);
});
