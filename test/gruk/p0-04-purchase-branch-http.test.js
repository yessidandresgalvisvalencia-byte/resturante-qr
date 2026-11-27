"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const express=require("express"),Module=require("node:module"),mongoose=require("mongoose");
const A="a".repeat(24),B="b".repeat(24),S="c".repeat(24),T="d".repeat(24),P="e".repeat(24);
test("purchase HTTP rejects unowned branch before writes or transaction",async()=>{
 const calls=[];
 let purchase=null;
 const originalSession=mongoose.startSession;
 mongoose.startSession=async()=>{calls.push("session");throw Error("UNEXPECTED_SESSION");};
 const load=Module._load;
 let router;
 try{
 Module._load=function(request,parent,...rest){
  if(parent?.filename.endsWith("/routes/compras.js")){
   if(request==="../core/auth/auth.middleware")return (req,res,next)=>{req.auth={empresaId:A,rol:"ADMIN_SEDE",sedeId:req.get("x-site")||null};next();};
   if(request==="../models/Empresa")return {findById:async()=>({_id:A})};
   if(request==="../models/sede")return {findOne:q=>({select:()=>({lean:async()=>q.empresaId===A&&q._id===S?{_id:S}:null})})};
   if(request==="../models/ProductoServicio")return {findOne:async q=>{calls.push(q);return null;}};
   if(request==="../models/Compra")return {find:q=>{calls.push(q);return {sort:async()=>[]};},findOne:async q=>{calls.push(q);return purchase;},findOneAndUpdate:async()=>{throw Error('UNEXPECTED_CANCELLATION_WRITE');}};
   if(request==="../models/Inventario"||request==="../models/MovimientoInventario")return {};
   if(request==="../core/eventos/eventBus")return {emit(){throw Error("UNEXPECTED_EVENT");}};
  }
  return load.call(this,request,parent,...rest);
 };
 router=require("../../routes/compras");
 }finally{Module._load=load;}
 const app=express();app.use(express.json());app.use(router);
 const server=await new Promise(resolve=>{const s=app.listen(0,"127.0.0.1",()=>resolve(s));});
 try{
  async function call(method,path,site,body){
   const res=await fetch("http://127.0.0.1:"+server.address().port+path,{method,headers:{"x-site":site,"content-type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
   return res.status;
  }
  const body={empresaId:A,items:[{nombre:"prueba",cantidad:1,costoUnitario:2,productoServicioId:P}]};
  for(const site of [T,"invalid",""]){
   assert.equal(await call("POST","/",site,body),403);
   assert.equal(await call("GET","/empresa/"+A,site),403);
   assert.equal(await call("PUT","/"+P+"/pago",site,{estadoPago:"pagado"}),403);
   assert.equal(await call("PUT","/"+P+"/anular",site,{}),403);
  }
  assert.equal(calls.length,0);
  assert.equal(await call("POST","/",S,{...body,sedeId:T}),403);
  assert.equal(await call("POST","/",S,body),404);
  assert.deepEqual(calls.pop(),{_id:P,empresaId:A,sedeId:{$in:[null,S]}});
  assert.equal(await call("GET","/empresa/"+B,S),403);
  assert.equal(await call("GET","/empresa/"+A,S),200);
  assert.deepEqual(calls.pop(),{empresaId:A,estado:"registrada",sedeId:S});
  assert.equal(await call("PUT","/"+P+"/pago",S,{estadoPago:"pagado"}),404);
  assert.equal(calls.pop().sedeId,S);
  assert.equal(await call("PUT","/"+P+"/anular",S,{}),404);
  assert.equal(calls.pop().sedeId,S);
  assert.equal(calls.length,0);
  purchase={_id:P,empresaId:A,sedeId:S,estado:"registrada",estadoPago:"pagado",total:2};
  assert.equal(await call("PUT","/"+P+"/anular",S,{}),409);
  assert.equal(purchase.estado,"registrada");
  assert.equal(calls.pop().sedeId,S);
  purchase={...purchase,estado:"anulada"};
  assert.equal(await call("PUT","/"+P+"/anular",S,{}),200);
  assert.equal(calls.pop().sedeId,S);
  assert.equal(calls.length,0);
 }finally{mongoose.startSession=originalSession;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
