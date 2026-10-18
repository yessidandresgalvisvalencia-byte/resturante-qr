"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {readOfflineCatalog}=require("../../core/offline/offlineCatalog.service");
const context={empresaId:"507f191e810c19729de860ea",sedeId:"507f1f77bcf86cd799439012",actorId:"operador"};
const productId="507f1f77bcf86cd799439011";
const row={_id:productId,empresaId:context.empresaId,sedeId:context.sedeId,tipo:"producto",activo:true,nombre:"Producto",precioVenta:5000};
function fake(rows){
 const queries=[];
 return {queries,collection(name){
  assert.equal(name,"productoservicios");
  return {find(query,options){
   queries.push({query,options});
   return {async toArray(){return rows;}};
  }};
 }};
}
const execute=db=>readOfflineCatalog({db,context,objectId:x=>x});
test("Capa 2: catalog requires scope in query and in returned fields",async()=>{
 const db=fake([row]);
 const result=await execute(db);
 assert.deepEqual(result.products,[{productoId:productId,nombre:"Producto",precioUnitarioCop:"5000"}]);
 assert.equal(db.queries[0].query.empresaId,context.empresaId);
 assert.equal(db.queries[0].query.sedeId,context.sedeId);
 for(const key of ["empresaId","sedeId","tipo","activo"])
  assert.equal(db.queries[0].options.projection[key],1);
});
test("Capa 2: foreign company/site and missing scope cannot leak catalog entries",async()=>{
 for(const change of [{empresaId:"507f191e810c19729de860eb"},
  {sedeId:"507f1f77bcf86cd799439013"}, {empresaId:undefined},
  {sedeId:undefined},{tipo:"servicio"},{activo:false},{activo:undefined}]){
  await assert.rejects(execute(fake([{...row,...change}])),{
   code:"OFFLINE_CATALOG_INVALID_PRODUCT"
  });
 }
});
test("Capa 2: tenantless request fails before touching catalog collection",async()=>{
 const db={collection(){throw Error("UNSCOPED_CATALOG_READ");}};
 for(const bad of [null,{}, {...context,empresaId:undefined},
  {...context,sedeId:undefined},{...context,actorId:undefined}]){
  await assert.rejects(readOfflineCatalog({db,context:bad,objectId:x=>x}),{
   code:"OFFLINE_CATALOG_AUTH_REQUIRED"
  });
 }
});
