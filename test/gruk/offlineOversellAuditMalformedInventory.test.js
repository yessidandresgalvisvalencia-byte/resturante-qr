"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {recordOfflineOversellConflict}=require("../../core/offline/offlineOversellAudit.service");
const eventId="01ARZ3NDEKTSV4RRFFQ69G5FA0",productId="507f1f77bcf86cd799439011";
const context={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",actorId:"operador"};
const order={...context,eventId,tipo:"PEDIDO_REGISTRADO",status:"PENDIENTE",
 payload:{localOrderId:eventId,items:[{productoId:productId,cantidad:"2",precioUnitarioCop:"1000",totalCop:"2000"}],totalCop:"2000"}};
function fixture(rows){
 let auditWrites=0,inventoryReads=0;
 const db={collection(name){
  if(name==="gruk_offline_inbox")return {find(filter){
   assert.equal(filter.empresaId,context.empresaId);
   assert.equal(filter.sedeId,context.sedeId);
   assert.equal(filter.actorId,context.actorId);
   return {toArray:async()=>[order]};
  }};
  if(name==="inventarios")return {find(query){
   inventoryReads++;
   assert.equal(query.empresaId,context.empresaId);
   assert.equal(query.sedeId,context.sedeId);
   assert.equal(query.productoServicioId,productId);
   return {toArray:async()=>rows};
  }};
  if(name==="gruk_offline_stock_conflicts"){
   return {updateOne:async()=>{auditWrites++;throw Error("FORBIDDEN_AUDIT_WRITE");}};
  }
  throw Error("UNEXPECTED_COLLECTION_"+name);
 }};
 return {db,get auditWrites(){return auditWrites;},get inventoryReads(){return inventoryReads;}};
}
test("Capa 2: lecturas de inventario incompletas no registran sobreventas",async()=>{
 const bad=[null,undefined,{},false,0,"",new Array(1),
  [null],[undefined],[{}],[{_id:null}],[{_id:""}],[{_id:"   "}]];
 for(const rows of bad){
  const f=fixture(rows);
  await assert.rejects(recordOfflineOversellConflict({
   db:f.db,context,eventIds:[eventId],objectId:value=>value
  }),{code:"OFFLINE_STOCK_AUDIT_MAPPING_UNAVAILABLE"});
  assert.equal(f.inventoryReads,1);
  assert.equal(f.auditWrites,0);
 }
});
test("Capa 2: múltiples existencias para un producto son ambiguas",async()=>{
 const row={_id:"inventory-1",...context,productoServicioId:productId,anulado:false,cantidad:1};
 const f=fixture([row,{...row,_id:"inventory-2"}]);
 await assert.rejects(recordOfflineOversellConflict({
  db:f.db,context,eventIds:[eventId],objectId:value=>value
 }),{code:"OFFLINE_STOCK_AUDIT_MAPPING_UNAVAILABLE"});
 assert.equal(f.auditWrites,0);
});
