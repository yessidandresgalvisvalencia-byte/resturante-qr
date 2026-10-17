"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {authorizeOfflineOrder}=require("../../core/offline/offlineOrderAuthority.service");
const context={empresaId:"tenantA",sedeId:"sedeA",actorId:"cajeroA"};
const event={eventId:"01ARZ3NDEKTSV4RRFFQ69G5FAV",tipo:"PEDIDO_REGISTRADO",...context,payload:{restaurantId:"rest1",menuItemId:"507f1f77bcf86cd799439011",mesa:1,cantidad:2,precio:1}};
test("server resolves restaurant ownership and never trusts offline price",async()=>{
 let query;const db={collection:name=>{assert.equal(name,"restaurantes");return {findOne:async q=>{query=q;return {restaurantId:"rest1",empresaId:"tenantA"};}}}};
 const result=await authorizeOfflineOrder({event,context,db});
 assert.deepEqual(query,{restaurantId:"rest1",empresaId:"tenantA"});
 assert.equal(result.requiresAuthoritativePricing,true);
 assert.equal("precio" in result,false);
});
test("cross-tenant and missing identity fail before DB access",async()=>{
 let called=false;const db={collection:()=>{called=true;throw Error("unexpected")}};
 await assert.rejects(authorizeOfflineOrder({event:{...event,empresaId:"tenantB"},context,db}),/OFFLINE_TENANT_MISMATCH/);
 await assert.rejects(authorizeOfflineOrder({event,context:{...context,sedeId:""},db}),/OFFLINE_AUTH_REQUIRED/);
 assert.equal(called,false);
});
test("unowned restaurant cannot become offline order",async()=>{
 const db={collection:()=>({findOne:async()=>null})};
 await assert.rejects(authorizeOfflineOrder({event,context,db}),/OFFLINE_RESTAURANT_FORBIDDEN/);
});
