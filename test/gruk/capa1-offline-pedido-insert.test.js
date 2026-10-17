"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {insertOfflinePedido}=require("../../core/offline/offlinePedidoInsert.service");
test("transaction session required before any offline order insert",async()=>{
 let accessed=false;
 await assert.rejects(insertOfflinePedido({db:{collection:()=>{accessed=true;}},event:{},context:{}}),/OFFLINE_TRANSACTION_REQUIRED/);
 assert.equal(accessed,false);
});
test("no order created for unauthenticated offline event",async()=>{
 let committed=false;
 const session={withTransaction:async fn=>{await fn();committed=true;}};
 const db={collection:()=>{throw Error("DB should not be touched")}};
 await assert.rejects(insertOfflinePedido({db,session,event:{},context:{}}),/OFFLINE_AUTH_REQUIRED/);
 assert.equal(committed,false);
});
