"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const express=require("express");
const jwt=require("jsonwebtoken");
const Inventario=require("../../models/Inventario");
const Restaurante=require("../../models/restaurante");
const Sede=require("../../models/sede");
const router=require("../../routes/inventario");

const A="507f1f77bcf86cd799439011",B="507f1f77bcf86cd799439012";
const SA="507f191e810c19729de860ea",SB="507f191e810c19729de860eb";
const mongo=process.env.GRUK_TEST_MONGO_URI||process.env.TEST_MONGO_URI;

test("Capa 2 HTTP Mongo: 2 empresas x 2 sedes, legado y anulación idempotente", {skip:!mongo},async()=>{
 const prior=process.env.JWT_SECRET;
 process.env.JWT_SECRET="gruk-tests-only-jwt-secret-32-characters";
 const app=express();
 app.use(express.json());
 app.use("/api/inventario",router);
 const server=app.listen(0,"127.0.0.1");
 let connected=false;
 try{
  await new Promise(resolve=>server.once("listening",resolve));
  await mongoose.connect(mongo,{dbName:"gruk_capa2_inventario_http_tests",serverSelectionTimeoutMS:15000});
  connected=true;
  await Inventario.deleteMany({});
  await Restaurante.deleteMany({});
  await Sede.deleteMany({});
  for(const [restaurantId,empresaId] of [["restaurant-a",A],["restaurant-b",B]]){
   await Restaurante.create({
    restaurantId,empresaId,nombreRestaurante:restaurantId,correo:restaurantId+"@example.test",
    usuarioAdmin:restaurantId,passwordAdmin:"test-password-not-live"
   });
  }
  await Sede.create([
   {_id:SA,empresaId:A,restauranteId:"restaurant-a",nombreSede:"sede A",codigoSede:"gruk-ci-a"},
   {_id:SB,empresaId:A,restauranteId:"restaurant-a",nombreSede:"sede B",codigoSede:"gruk-ci-b"},
   {_id:"507f191e810c19729de860ec",empresaId:B,restauranteId:"restaurant-b",nombreSede:"sede empresa B",codigoSede:"gruk-ci-c"}
  ]);
  async function item(empresaId,sedeId,restaurantId,nombre){
   return Inventario.create({empresaId,sedeId,restaurantId,nombre,categoria:"prueba",cantidad:3,costo:100});
  }
  const own=await item(A,SA,"restaurant-a","sede A");
  const other=await item(A,SB,"restaurant-a","sede B");
  const foreign=await item(B,SB,"restaurant-b","otra empresa");
  const legacy=await item(A,null,"restaurant-a","histórico sin sede");
  const endpoint="http://127.0.0.1:"+server.address().port+"/api/inventario";
  function auth(empresaId,sedeId,rol,sub){
   return "Bearer "+jwt.sign({sub,empresaId,sedeId,rol},process.env.JWT_SECRET,
     {algorithm:"HS256",expiresIn:"5m"});
  }
  const adminA=auth(A,SA,"ADMIN_SEDE","usuario-sede-a");
  const adminB=auth(A,SB,"ADMIN_SEDE","usuario-sede-b");
  const owner=auth(A,undefined,"DUEÑO","dueno-a");
  async function call(method,path,token,body){
   const response=await fetch(endpoint+path,{method,headers:{
    authorization:token,...(body?{"content-type":"application/json"}:{})
   },...(body?{body:JSON.stringify(body)}:{})});
   return {status:response.status,data:await response.json()};
  }

  const visible=await call("GET","/restaurant-a",adminA);
  assert.equal(visible.status,200,JSON.stringify(visible.data));
  assert.deepEqual(visible.data.productos.map(x=>x.nombre),["sede A"]);
  assert.equal(visible.data.resumen.totalProductos,1);
  const otherVisible=await call("GET","/restaurant-a",adminB);
  assert.equal(otherVisible.status,200);
  assert.deepEqual(otherVisible.data.productos.map(x=>x.nombre),["sede B"]);
  await Sede.updateOne({_id:SA},{$set:{restauranteId:"restaurant-b"}});
  assert.equal((await call("GET","/restaurant-a",adminA)).status,403);
  assert.equal((await call("POST","/",adminA,{restaurantId:"restaurant-a",nombre:"sin vínculo",categoria:"prueba",cantidad:1})).status,403);
  await Sede.updateOne({_id:SA},{$set:{restauranteId:"restaurant-a"}});
  const deniedCompany=await call("GET","/restaurant-b",adminA);
  assert.equal(deniedCompany.status,403);
  const ownerVisible=await call("GET","/restaurant-a",owner);
  assert.equal(ownerVisible.status,200);
  assert.equal(ownerVisible.data.resumen.totalProductos,3);
  assert.equal(ownerVisible.data.productos.some(x=>x.nombre==="histórico sin sede"),true);

  const createSpoof=await call("POST","/",adminA,{
    empresaId:B,restaurantId:"restaurant-a",sedeId:SA,nombre:"falsa",categoria:"prueba",cantidad:1
  });
  assert.equal(createSpoof.status,403);
  const createCrossSede=await call("POST","/",adminA,{
    restaurantId:"restaurant-a",sedeId:SB,nombre:"otra sede",categoria:"prueba",cantidad:1
  });
  assert.equal(createCrossSede.status,403);
  const createCrossCompanyRestaurant=await call("POST","/",adminA,{
    restaurantId:"restaurant-b",nombre:"otra empresa",categoria:"prueba",cantidad:1
  });
  assert.equal(createCrossCompanyRestaurant.status,403);
  const createOk=await call("POST","/",adminA,{
    restaurantId:"restaurant-a",nombre:"pedido válido",categoria:"prueba",cantidad:1
  });
  assert.equal(createOk.status,200,JSON.stringify(createOk.data));
  assert.equal(String(createOk.data.inventario.sedeId),SA);

  const forbiddenSede=await call("PUT","/anular/"+other.id,adminA,{motivo:"no corresponde",usuario:"suplantado"});
  assert.equal(forbiddenSede.status,404);
  const forbiddenCompany=await call("PUT","/anular/"+foreign.id,adminA,{motivo:"no corresponde"});
  assert.equal(forbiddenCompany.status,404);
  const forbiddenLegacy=await call("PUT","/anular/"+legacy.id,adminA,{motivo:"no corresponde"});
  assert.equal(forbiddenLegacy.status,404);
  const annulled=await call("PUT","/anular/"+own.id,adminA,{motivo:"control",usuario:"suplantado"});
  assert.equal(annulled.status,200);
  assert.equal(annulled.data.producto.usuarioAnulacion,"usuario-sede-a");
  assert.equal((await call("PUT","/anular/"+own.id,adminA,{motivo:"repetir"})).status,404);
  assert.equal((await Inventario.findById(own.id)).usuarioAnulacion,"usuario-sede-a");
 }finally{
  if(connected){await Inventario.deleteMany({});await Restaurante.deleteMany({});await Sede.deleteMany({});await mongoose.disconnect();}
  await new Promise(resolve=>server.close(resolve));
  if(prior===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=prior;
 }
});
