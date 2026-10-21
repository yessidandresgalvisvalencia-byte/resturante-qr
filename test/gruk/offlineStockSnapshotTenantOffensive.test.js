"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {readOfflineStockSnapshot}=require("../../core/offline/offlineStockSnapshot.service");
const empresaId="507f191e810c19729de860ea",sedeId="507f1f77bcf86cd799439012";
const productoId="507f1f77bcf86cd799439011";
const context={empresaId,sedeId,actorId:"cajero"};
const own={empresaId,sedeId,anulado:false,productoServicioId:productoId,cantidad:3};
function source(rows){
 const calls=[];
 const db={collection(name){
  assert.equal(name,"inventarios");
  return {find(filter,options){
   calls.push({filter,options});
   return {toArray:async()=>rows};
  }};
 }};
 return {db,calls};
}
const objectId=id=>id;
const request=db=>({db,context,objectId});
test("Capa 2 ofensiva: snapshot de inventario consulta únicamente empresa y sede autenticadas",async()=>{
 const s=source([own]);
 const result=await readOfflineStockSnapshot(request(s.db));
 assert.deepEqual(result,{readOnly:true,products:[{productoId,cantidad:"3"}]});
 assert.equal(s.calls.length,1);
 assert.deepEqual(s.calls[0].filter,{empresaId,sedeId,anulado:false,productoServicioId:{$ne:null}});
 assert.equal(s.calls[0].options.projection.empresaId,1);
 assert.equal(s.calls[0].options.projection.sedeId,1);
 assert.equal(s.calls[0].options.limit,501);
});
test("Capa 2 ofensiva: ningún producto de otra empresa o sede supera verificación de resultados",async()=>{
 for(const foreign of [{empresaId:"507f191e810c19729de860eb"},
   {sedeId:"507f1f77bcf86cd799439013"},{empresaId:undefined},{sedeId:undefined}]){
  for(const rows of [[{...own,...foreign}],[own,{...own,...foreign,productoServicioId:"507f1f77bcf86cd799439015"}]]){
   await assert.rejects(readOfflineStockSnapshot(request(source(rows).db)),{code:"OFFLINE_STOCK_INVALID_MAPPING"});
  }
 }
});
test("Capa 2 ofensiva: evidencia de inventario ambigua, anulada o duplicada falla cerrada",async()=>{
 for(const row of [
  {...own,anulado:true},{...own,anulado:undefined},
  {...own,productoServicioId:"not-an-id"},{...own,cantidad:-1},
  {...own,cantidad:1.5},{...own,cantidad:Number.MAX_SAFE_INTEGER+1}
 ]){
  await assert.rejects(readOfflineStockSnapshot(request(source([row]).db)),{code:"OFFLINE_STOCK_INVALID_MAPPING"});
 }
 await assert.rejects(readOfflineStockSnapshot(request(source([own,{...own}]).db)),
  {code:"OFFLINE_STOCK_INVALID_MAPPING"});
});
test("Capa 2 ofensiva: falla antes de MongoDB sin identidad completa autenticada",async()=>{
 for(const key of ["empresaId","sedeId","actorId"]){
  let called=0;
  const db={collection(){called++;throw Error("UNAUTHORIZED_READ");}};
  await assert.rejects(readOfflineStockSnapshot({db,objectId,context:{...context,[key]:undefined}}),
   {code:"OFFLINE_STOCK_AUTH_REQUIRED"});
  assert.equal(called,0);
 }
});
test("Capa 2 ofensiva: respuesta masiva no sobrepasa límite de inventario offline",async()=>{
 const rows=Array.from({length:501},()=>own);
 await assert.rejects(readOfflineStockSnapshot(request(source(rows).db)),
  {code:"OFFLINE_STOCK_TOO_LARGE"});
});
