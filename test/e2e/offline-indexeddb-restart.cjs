"use strict";
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { mkdtemp, rm, readFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");

async function run() {
  const script = await readFile(path.join(__dirname, "../../public/js/gruk-offline-outbox.js"));
  const transportScript = await readFile(path.join(__dirname, "../../public/js/gruk-offline-transport.js"));
  const server = createServer((req, res) => {
    if (req.url === "/gruk-offline-transport.js") {
      res.writeHead(200, { "Content-Type": "text/javascript", "Cache-Control": "no-store" });
      res.end(transportScript);
      return;
    }
    if (req.url === "/gruk-offline-outbox.js") {
      res.writeHead(200, { "Content-Type": "text/javascript", "Cache-Control": "no-store" });
      res.end(script);
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store" });
    res.end('<!doctype html><meta charset="utf-8"><title>GRUK isolated offline test</title><script src="/gruk-offline-outbox.js"></script><script src="/gruk-offline-transport.js"></script>');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port + "/";
  const profile = await mkdtemp(path.join(os.tmpdir(), "gruk-indexeddb-e2e-"));
  const tenantA = { empresaId: "empresa-a", sedeId: "sede-a", actorId: "operador-a" };
  const tenantB = { empresaId: "empresa-b", sedeId: "sede-a", actorId: "operador-a" };
  const ids = Array.from({ length: 20 }, (_, n) => String(n + 1).padStart(26, "0"));
  let browser;
  try {
    browser = await chromium.launchPersistentContext(profile, { headless: true });
    let page = await browser.newPage();
    await page.goto(base);
    await browser.setOffline(true);
    const first = await page.evaluate(async ({ tenant, ids }) => {
      const api = globalThis.GRUKOfflineOutbox;
      for (const eventId of ids) {
        await api.putPending({ ...tenant, eventId, payload: { items: [{ productoId: "producto-1", cantidad: 1 }] } });
      }
      return { pending: (await api.listPending(100, tenant)).length,
        reservations: (await api.listStockReservations(tenant)).length };
    }, { tenant: tenantA, ids });
    assert.deepEqual(first, { pending: 20, reservations: 20 });
    await browser.close();
    browser = null;

    // Same browser profile and origin after full browser process shutdown.
    browser = await chromium.launchPersistentContext(profile, { headless: true });
    page = await browser.newPage();
    await page.goto(base);
    await browser.setOffline(true);
    const after = await page.evaluate(async ({ tenantA, tenantB, ids }) => {
      const api = globalThis.GRUKOfflineOutbox;
      const pending = await api.listPending(100, tenantA);
      const otherTenant = await api.listPending(100, tenantB);
      let duplicateRejected = false;
      try {
        await api.putPending({ ...tenantA, eventId: ids[0], payload: { items: [{ productoId: "producto-1", cantidad: 1 }] } });
      } catch (error) { duplicateRejected = true; }
      const countAfterDuplicate = (await api.listPending(100, tenantA)).length;
      return {
        ids: pending.map(event => event.eventId).sort(),
        otherTenant: otherTenant.length, duplicateRejected, countAfterDuplicate
      };
    }, { tenantA, tenantB, ids });
    assert.deepEqual(after.ids, ids);
    assert.equal(after.otherTenant, 0);
    assert.equal(after.duplicateRejected, true);
    assert.equal(after.countAfterDuplicate, 20);
    // After browser restart, another tenant cannot acknowledge or hide these events.
    const foreignAck = await page.evaluate(async ({tenantB,eventId}) => {
      const api=globalThis.GRUKOfflineOutbox;
      return {changed:await api.markReceived(eventId,tenantB),
        foreignPending:(await api.listPending(100,tenantB)).length};
    },{tenantB,eventId:ids[0]});
    assert.deepEqual(foreignAck,{changed:false,foreignPending:0});
    assert.equal((await page.evaluate(async tenant =>
      (await globalThis.GRUKOfflineOutbox.listPending(100,tenant)).length,tenantA)),20);

    // Acknowledgment records must remain durable, without deleting local events.
    const received = await page.evaluate(async ({ tenant, eventId }) => {
      const api = globalThis.GRUKOfflineOutbox;
      const changed = await api.markReceived(eventId, tenant);
      return { changed, pending: (await api.listPending(100, tenant)).length,
        received: (await api.listReceived(100, tenant)).length,
        local: (await api.listLocal(100, tenant)).length,
        reservations: (await api.listStockReservations(tenant)).length };
    }, { tenant: tenantA, eventId: ids[0] });
    assert.deepEqual(received, { changed: true, pending: 19, received: 1, local: 20, reservations: 20 });
    await browser.close();
    browser = null;
    browser = await chromium.launchPersistentContext(profile, { headless: true });
    page = await browser.newPage();
    await page.goto(base);
    await browser.setOffline(true);
    const afterAckRestart = await page.evaluate(async tenant => {
      const api = globalThis.GRUKOfflineOutbox;
      const reservations = await api.listStockReservations(tenant);
      return {
        local: (await api.listLocal(100, tenant)).length,
        received: (await api.listReceived(100, tenant)).length,
        reserved: reservations.length,
        productUnits: reservations.reduce((sum, row) => sum + row.cantidad, 0)
      };
    }, tenantA);
    assert.deepEqual(afterAckRestart, { local: 20, received: 1, reserved: 20, productUnits: 20 });
    // Simulated lost response after remote acceptance: local ACK must remain pending.
    const failedSend = await page.evaluate(async tenant => {
      try {
        await globalThis.GRUKOfflineTransport.synchronizeAll({
          outbox: globalThis.GRUKOfflineOutbox, context: tenant, token: "test-token",
          fetchFn: async () => { throw Error("NETWORK_LOST_AFTER_SERVER_COMMIT"); }
        });
      } catch (error) {
        return {error: error.message,
          pending: (await globalThis.GRUKOfflineOutbox.listPending(100,tenant)).length,
          received: (await globalThis.GRUKOfflineOutbox.listReceived(100,tenant)).length};
      }
      throw Error("NETWORK_FAILURE_MUST_REJECT");
    }, tenantA);
    assert.deepEqual(failedSend,{error:"NETWORK_LOST_AFTER_SERVER_COMMIT",pending:19,received:1});
    await browser.close();
    browser=null;
    browser=await chromium.launchPersistentContext(profile,{headless:true});
    page=await browser.newPage();
    await page.goto(base);
    await browser.setOffline(true);
    const recovered=await page.evaluate(async tenant=>{
      const outbox=globalThis.GRUKOfflineOutbox;
      let requests=0;
      const result=await globalThis.GRUKOfflineTransport.synchronizeAll({
        outbox,context:tenant,token:"test-token",
        fetchFn:async (_url,options)=>{
          requests++;
          const sent=JSON.parse(options.body).events;
          return {status:202,json:async()=>({ok:true,applied:false,
            events:sent.map(event=>({eventId:event.eventId,status:"YA_RECIBIDO"}))})};
        }
      });
      return {result,requests,
        pending:(await outbox.listPending(100,tenant)).length,
        received:(await outbox.listReceived(100,tenant)).length,
        local:(await outbox.listLocal(100,tenant)).length};
    },tenantA);
    assert.deepEqual(recovered,{result:{sent:19,received:19,batches:1,complete:true},
      requests:1,pending:0,received:20,local:20});
    await browser.close();
    browser=null;
    browser=await chromium.launchPersistentContext(profile,{headless:true});
    page=await browser.newPage();
    await page.goto(base);
    await browser.setOffline(true);
    const durable=await page.evaluate(async tenant=>({
      pending:(await globalThis.GRUKOfflineOutbox.listPending(100,tenant)).length,
      received:(await globalThis.GRUKOfflineOutbox.listReceived(100,tenant)).length,
      local:(await globalThis.GRUKOfflineOutbox.listLocal(100,tenant)).length
    }),tenantA);
    assert.deepEqual(durable,{pending:0,received:20,local:20});
    // Inject an ACTUAL IndexedDB transaction abort after a successful server
    // acknowledgement, just as the local markReceived() write is queued.
    // The aborted transaction must not persist the 'received' transition.
    const extraId = "01ARZ3NDEKTSV4RRFFQ69G5FA2";
    const aborted = await page.evaluate(async ({tenant,eventId})=>{
      const outbox=globalThis.GRUKOfflineOutbox;
      await outbox.putPending({...tenant,eventId,
        payload:{items:[{productoId:"producto-1",cantidad:1}]}});
      const original=IDBObjectStore.prototype.put;
      let injected=0,serverCalls=0,caught=false;
      IDBObjectStore.prototype.put=function(value,...args){
        const request=original.call(this,value,...args);
        if(injected===0&&value?.eventId===eventId&&value?.syncStatus==="received"){
          injected++;
          this.transaction.abort();
        }
        return request;
      };
      try{
        await globalThis.GRUKOfflineTransport.synchronize({
          outbox,context:tenant,token:"test-token",
          fetchFn:async (_url,options)=>{
            serverCalls++;
            const sent=JSON.parse(options.body).events;
            if(sent.length!==1||sent[0].eventId!==eventId)throw Error("WRONG_EVENT");
            return {status:202,json:async()=>({ok:true,applied:false,
              events:[{eventId,status:"RECIBIDO"}]})};
          }
        });
      }catch(_error){caught=true;}
      finally{IDBObjectStore.prototype.put=original;}
      return {caught,injected,serverCalls,
        pending:(await outbox.listPending(100,tenant)).map(x=>x.eventId),
        received:(await outbox.listReceived(100,tenant)).length,
        local:(await outbox.listLocal(100,tenant)).length};
    },{tenant:tenantA,eventId:extraId});
    assert.deepEqual(aborted,{caught:true,injected:1,serverCalls:1,
      pending:[extraId],received:20,local:21});
    await browser.close();
    browser=null;

    // Fresh Chromium process, same profile: the rejected ACK remains pending.
    browser=await chromium.launchPersistentContext(profile,{headless:true});
    page=await browser.newPage();
    await page.goto(base);
    await browser.setOffline(true);
    const afterAbortRestart=await page.evaluate(async ({tenant,eventId})=>{
      const outbox=globalThis.GRUKOfflineOutbox;
      const pending=await outbox.listPending(100,tenant);
      let requests=0;
      const outcome=await globalThis.GRUKOfflineTransport.synchronizeAll({
        outbox,context:tenant,token:"test-token",
        fetchFn:async (_url,options)=>{
          requests++;
          const sent=JSON.parse(options.body).events;
          if(sent.length!==1||sent[0].eventId!==eventId)throw Error("WRONG_RETRY");
          return {status:202,json:async()=>({ok:true,applied:false,
            events:[{eventId,status:"YA_RECIBIDO"}]})};
        }
      });
      return {pendingBefore:pending.map(x=>x.eventId),requests,outcome,
        pendingAfter:(await outbox.listPending(100,tenant)).length,
        received:(await outbox.listReceived(100,tenant)).length,
        local:(await outbox.listLocal(100,tenant)).length};
    },{tenant:tenantA,eventId:extraId});
    assert.deepEqual(afterAbortRestart,{pendingBefore:[extraId],requests:1,
      outcome:{sent:1,received:1,batches:1,complete:true},
      pendingAfter:0,received:21,local:21});
    await browser.close();
    browser=null;
    browser=await chromium.launchPersistentContext(profile,{headless:true});
    page=await browser.newPage();
    await page.goto(base);
    const afterSecondRestart=await page.evaluate(async tenant=>({
      local:(await globalThis.GRUKOfflineOutbox.listLocal(100,tenant)).length,
      received:(await globalThis.GRUKOfflineOutbox.listReceived(100,tenant)).length,
      pending:(await globalThis.GRUKOfflineOutbox.listPending(100,tenant)).length
    }),tenantA);
    assert.deepEqual(afterSecondRestart,{local:21,received:21,pending:0});
    // Fail the first NEW event with an injected QuotaExceededError, and
    // abort a second event's actual IndexedDB transaction AFTER add().
    // Both putPending() promises must reject, never report a saved order.
    const unsavedIds=["01ARZ3NDEKTSV4RRFFQ69G5FA3","01ARZ3NDEKTSV4RRFFQ69G5FA4"];
    const rejectedWrites=await page.evaluate(async ({tenant,eventIds})=>{
      const outbox=globalThis.GRUKOfflineOutbox;
      const original=IDBObjectStore.prototype.add;
      const attempts=[];
      for(const [index,eventId] of eventIds.entries()){
        let injected=0,rejected=false,errorName=null;
        IDBObjectStore.prototype.add=function(value,...args){
          if(injected===0&&value?.eventId===eventId){
            injected++;
            if(index===0)throw new DOMException("Storage quota exhausted","QuotaExceededError");
            const request=original.call(this,value,...args);
            this.transaction.abort();
            return request;
          }
          return original.call(this,value,...args);
        };
        try{
          await outbox.putPending({...tenant,eventId,
            payload:{items:[{productoId:"producto-1",cantidad:1}]}});
        }catch(error){rejected=true;errorName=error.name;}
        finally{IDBObjectStore.prototype.add=original;}
        attempts.push({rejected,errorName,injected});
      }
      return {attempts,
        pending:(await outbox.listPending(100,tenant)).map(x=>x.eventId),
        local:(await outbox.listLocal(100,tenant)).length,
        reservations:(await outbox.listStockReservations(tenant)).length};
    },{tenant:tenantA,eventIds:unsavedIds});
    assert.deepEqual(rejectedWrites.attempts.map(x=>[x.rejected,x.injected]),
      [[true,1],[true,1]]);
    assert.equal(rejectedWrites.attempts[0].errorName,"QuotaExceededError");
    assert.deepEqual(rejectedWrites.pending,[]);
    assert.equal(rejectedWrites.local,21);
    assert.equal(rejectedWrites.reservations,21);
    await browser.close();
    browser=null;

    // Prove failed writes are still absent from disk after a full restart.
    browser=await chromium.launchPersistentContext(profile,{headless:true});
    page=await browser.newPage();
    await page.goto(base);
    await browser.setOffline(true);
    const persistedFailure=await page.evaluate(async ({tenant,eventIds})=>{
      const outbox=globalThis.GRUKOfflineOutbox;
      const before=await outbox.listLocal(100,tenant);
      for(const eventId of eventIds)
        await outbox.putPending({...tenant,eventId,
          payload:{items:[{productoId:"producto-1",cantidad:1}]}});
      return {before:before.length,absent:eventIds.every(id=>!before.some(x=>x.eventId===id)),
        pending:(await outbox.listPending(100,tenant)).map(x=>x.eventId),
        local:(await outbox.listLocal(100,tenant)).length};
    },{tenant:tenantA,eventIds:unsavedIds});
    assert.deepEqual(persistedFailure,{before:21,absent:true,
      pending:unsavedIds,local:23});
    await browser.close();
    browser=null;
    browser=await chromium.launchPersistentContext(profile,{headless:true});
    page=await browser.newPage();
    await page.goto(base);
    const durableNewOrders=await page.evaluate(async tenant=>({
      local:(await globalThis.GRUKOfflineOutbox.listLocal(100,tenant)).length,
      pending:(await globalThis.GRUKOfflineOutbox.listPending(100,tenant)).length,
      received:(await globalThis.GRUKOfflineOutbox.listReceived(100,tenant)).length
    }),tenantA);
    assert.deepEqual(durableNewOrders,{local:23,pending:2,received:21});
    // A request captures the two old pending events, then pauses before ACK.
    // A second operation concurrently persists two NEW orders in IndexedDB.
    // The old ACK must not acknowledge events created while the request flies.
    const concurrentIds=["01ARZ3NDEKTSV4RRFFQ69G5FA5","01ARZ3NDEKTSV4RRFFQ69G5FA6"];
    const concurrent=await page.evaluate(async ({tenant,newIds,oldIds})=>{
      const outbox=globalThis.GRUKOfflineOutbox;
      let releaseRequest,startedRequest;
      const started=new Promise(resolve=>{startedRequest=resolve;});
      const release=new Promise(resolve=>{releaseRequest=resolve;});
      const sent=[];
      const sync=globalThis.GRUKOfflineTransport.synchronize({
        outbox,context:tenant,token:"test-token",
        fetchFn:async (_url,options)=>{
          const events=JSON.parse(options.body).events;
          sent.push(events.map(e=>e.eventId));
          startedRequest();
          await release;
          return {status:202,json:async()=>({ok:true,applied:false,
            events:events.map(e=>({eventId:e.eventId,status:"RECIBIDO"}))})};
        }
      });
      await started;
      await Promise.all(newIds.map(eventId=>outbox.putPending({...tenant,eventId,
        payload:{items:[{productoId:"producto-1",cantidad:1}]}})));
      const during=(await outbox.listPending(100,tenant)).map(e=>e.eventId);
      releaseRequest();
      const result=await sync;
      const remaining=(await outbox.listPending(100,tenant)).map(e=>e.eventId);
      const all=await outbox.listLocal(100,tenant);
      return {sent,during,result,remaining,local:all.length,
        newEventsPending:newIds.every(id=>all.some(e=>e.eventId===id&&e.syncStatus==="pending"))};
    },{tenant:tenantA,newIds:concurrentIds,oldIds:unsavedIds});
    assert.deepEqual(concurrent.sent,[unsavedIds]);
    assert.deepEqual(concurrent.during,[...unsavedIds,...concurrentIds]);
    assert.deepEqual(concurrent.result,{sent:2,received:2});
    assert.deepEqual(concurrent.remaining,concurrentIds);
    assert.equal(concurrent.local,25);
    assert.equal(concurrent.newEventsPending,true);
    await browser.close();
    browser=null;
    browser=await chromium.launchPersistentContext(profile,{headless:true});
    page=await browser.newPage();
    await page.goto(base);
    const afterConcurrentRestart=await page.evaluate(async tenant=>({
      pending:(await globalThis.GRUKOfflineOutbox.listPending(100,tenant)).map(e=>e.eventId),
      received:(await globalThis.GRUKOfflineOutbox.listReceived(100,tenant)).length,
      local:(await globalThis.GRUKOfflineOutbox.listLocal(100,tenant)).length
    }),tenantA);
    assert.deepEqual(afterConcurrentRestart,{pending:concurrentIds,received:23,local:25});
    console.log(JSON.stringify({ result: "ok", browser: "chromium", events: 20,
      browserRestart: true, isolatedTenant: true, duplicatedEvents: 0, retainedReceived: 21, abortedAckRecovered: true }));
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    await rm(profile, { recursive: true, force: true });
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
