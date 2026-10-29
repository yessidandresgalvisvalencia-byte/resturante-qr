"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const express=require("express");
const jwt=require("jsonwebtoken");
const {randomUUID}=require("node:crypto");
const Inventario=require("../../models/Inventario");
const Restaurante=require("../../models/restaurante");
const Sede=require("../../models/sede");
const router=require("../../routes/inventario");

const A="507f1f77bcf86cd799439011",B="507f1f77bcf86cd799439012";
const SA="507f191e810c19729de860ea",SB="507f191e810c19729de860eb";
const mongo=process.env.GRUK_TEST_MONGO_URI||process.env.TEST_MONGO_URI;
function uriMongoSegura(uri){
 if(typeof uri!=="string" || !uri.startsWith("mongodb://"))return false;
 try{
  const parsed=new URL(uri);
  return !parsed.username && !parsed.password &&
    ["127.0.0.1","localhost","::1","[::1]"].includes(parsed.hostname) &&
    (!parsed.port || parsed.port==="27017");
 }catch{return false;}
}

test("Capa 2 HTTP Mongo: 2 empresas x 2 sedes, legado y anulación idempotente", {skip:!mongo && !process.env.CI},async()=>{
 assert.ok(mongo,"CI requiere MongoDB: nunca omitir las pruebas de aislamiento");
 assert.ok(uriMongoSegura(mongo),"Prohibidas pruebas destructivas sobre MongoDB remoto o autenticado");
 const database="gruk_capa2_ci_"+randomUUID().replace(/-/g,"");
 const prior=process.env.JWT_SECRET;
 process.env.JWT_SECRET="gruk-tests-only-jwt-secret-32-characters";
 const app=express();
 app.use(express.json());
 app.use("/api/inventario",router);
 const server=app.listen(0,"127.0.0.1");
 let connected=false;
 try{
  await new Promise(resolve=>server.once("listening",resolve));
  await mongoose.connect(mongo,{dbName:database,serverSelectionTimeoutMS:15000});
  connected=true;
  // Base temporal exclusiva por ejecución; no tocar datos preexistentes.
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
  const empleado=auth(A,SA,"EMPLEADO","empleado-a");
  const ownerB=auth(B,undefined,"DUEÑO","dueno-b");
  async function call(method,path,token,body){
   const response=await fetch(endpoint+path,{method,headers:{
    authorization:token,...(body?{"content-type":"application/json"}:{})
   },...(body?{body:JSON.stringify(body)}:{})});
   return {status:response.status,data:await response.json()};
  }

  // Negación por rol, empresa y ausencia de credenciales.
  assert.equal((await call("GET","/restaurant-a",empleado)).status,403);
  assert.equal((await call("POST","/",empleado,{
    restaurantId:"restaurant-a",nombre:"empleado-no-autorizado",categoria:"prueba",cantidad:1
  })).status,403);
  assert.equal((await call("PUT","/anular/"+own.id,empleado,{motivo:"sin permiso"})).status,403);
  assert.equal((await call("GET","/restaurant-a",ownerB)).status,403);
  assert.equal((await call("PUT","/anular/"+own.id,ownerB,{motivo:"otra empresa"})).status,404);
  assert.equal((await Inventario.findById(own.id)).anulado,false);
  // Ausencia de token: ninguna operación administrativa revela o modifica datos.
  assert.equal((await call("GET","/restaurant-a","")).status,401);
  assert.equal((await call("POST","/","",{
    restaurantId:"restaurant-a",nombre:"sin autenticación",categoria:"prueba",cantidad:1
  })).status,401);
  assert.equal((await call("PUT","/anular/"+own.id,"",{motivo:"sin autenticación"})).status,401);
  assert.equal(await Inventario.countDocuments({nombre:"sin autenticación"}),0);
  // El paginado y las búsquedas también deben conservar el filtro sede+empresa.
  const paged=await call("GET","/restaurant-a?page=1&limit=1&q=sede",adminA);
  assert.equal(paged.status,200,JSON.stringify(paged));
  assert.equal(paged.data.paginacion.total,1);
  assert.deepEqual(paged.data.productos.map(p=>p.nombre),["sede A"]);
  const noForeign=await call("GET","/restaurant-a?limit=1&page=1&q=otra",adminA);
  assert.equal(noForeign.status,200);
  assert.equal(noForeign.data.paginacion.total,0);
  assert.equal(noForeign.data.productos.length,0);
  // Parámetros y motivos malformados: no deben provocar 500 ni alterar el ledger de inventario.
  assert.equal((await call("PUT","/anular/invalid-object-id",adminA,{motivo:"prueba"})).status,400);
  assert.equal((await call("PUT","/anular/"+own.id,adminA,{motivo:{$ne:null}})).status,400);
  assert.equal((await call("PUT","/anular/"+own.id,adminA,{motivo:["inyectado"]})).status,400);
  assert.equal((await call("PUT","/anular/"+own.id,adminA,{motivo:"  "})).status,400);
  assert.equal((await call("PUT","/anular/"+own.id,adminA,{motivo:"x".repeat(501)})).status,400);
  assert.equal((await Inventario.findById(own.id)).anulado,false);
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

  // Compatibilidad con inventario general previo del DUEÑO.
  const altaGeneral=await call("POST","/",owner,{
   nombre:"inventario general",categoria:"prueba",cantidad:1
  });
  assert.equal(altaGeneral.status,200,JSON.stringify(altaGeneral));
  assert.equal(altaGeneral.data.inventario.restaurantId,null);
  assert.equal(String(altaGeneral.data.inventario.empresaId),A);

  // El dueño no puede adjuntar inventario de su empresa a una sede ajena.
  const otraSede="507f191e810c19729de860ec";
  const forjarSedeDueno=await call("POST","/",owner,{
    restaurantId:"restaurant-a",sedeId:otraSede,
    nombre:"sede extranjera",categoria:"prueba",cantidad:1
  });
  assert.equal(forjarSedeDueno.status,403,JSON.stringify(forjarSedeDueno));
  assert.equal(await Inventario.countDocuments({nombre:"sede extranjera"}),0);
  const mismatchedOwner=await call("POST","/",owner,{
    restaurantId:"restaurant-b",sedeId:SA,
    nombre:"restaurante ajeno",categoria:"prueba",cantidad:1
  });
  assert.equal(mismatchedOwner.status,403,JSON.stringify(mismatchedOwner));
  const ownerSameCompany=await call("POST","/",owner,{
    restaurantId:"restaurant-a",sedeId:SA,
    nombre:"sede propia",categoria:"prueba",cantidad:1
  });
  assert.equal(ownerSameCompany.status,200,JSON.stringify(ownerSameCompany));
  assert.equal(String(ownerSameCompany.data.inventario.sedeId),SA);

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

  // Alta bajo reasignación concurrente: no debe dejar un producto en la sede antigua.
  const altaConcurrente=await mongoose.startSession();
  try{
   altaConcurrente.startTransaction();
   await Sede.updateOne({_id:SA},{$set:{restauranteId:"restaurant-b"}},{session:altaConcurrente});
   const requestAlta=call("POST","/",adminA,{
    restaurantId:"restaurant-a",nombre:"alta durante traslado",
    categoria:"prueba",cantidad:1
   });
   await altaConcurrente.commitTransaction();
   const respuestaAlta=await requestAlta;
   assert.ok([403,409].includes(respuestaAlta.status),JSON.stringify(respuestaAlta));
   assert.equal(await Inventario.countDocuments({nombre:"alta durante traslado"}),0);
  }finally{
   if(altaConcurrente.inTransaction())await altaConcurrente.abortTransaction();
   await altaConcurrente.endSession();
  }
  await Sede.updateOne({_id:SA},{$set:{restauranteId:"restaurant-a"}});

  // La sede puede cambiar de restaurante después de crear el producto.
  // La anulación debe verificar también el vínculo actual, no solo sedeId.
  await Sede.updateOne({_id:SA},{$set:{restauranteId:"restaurant-b"}});
  assert.equal((await call("PUT","/anular/"+own.id,adminA,{motivo:"sin vínculo"})).status,404);
  assert.equal((await Inventario.findById(own.id)).anulado,false);
  await Sede.updateOne({_id:SA},{$set:{restauranteId:"restaurant-a"}});
  // Producto mal clasificado con sede correcta, pero restaurante de empresa distinta.
  const irregular=await item(A,SA,"restaurant-b","objeto no autorizado");
  assert.equal((await call("PUT","/anular/"+irregular.id,adminA,{motivo:"forzado"})).status,404);
  assert.equal((await Inventario.findById(irregular.id)).anulado,false);
  const forbiddenSede=await call("PUT","/anular/"+other.id,adminA,{motivo:"no corresponde",usuario:"suplantado"});
  assert.equal(forbiddenSede.status,404);
  const forbiddenCompany=await call("PUT","/anular/"+foreign.id,adminA,{motivo:"no corresponde"});
  assert.equal(forbiddenCompany.status,404);
  const forbiddenLegacy=await call("PUT","/anular/"+legacy.id,adminA,{motivo:"no corresponde"});
  assert.equal(forbiddenLegacy.status,404);
  // Carrera real: una transacción reasigna la sede mientras se solicita
  // anular el producto del restaurante anterior.
  const raceItem=await item(A,SA,"restaurant-a","race-reasignación");
  const reassignment=await mongoose.startSession();
  try{
   reassignment.startTransaction();
   await Sede.updateOne({_id:SA},{$set:{restauranteId:"restaurant-b"}},{session:reassignment});
   const pendingAnnul=call("PUT","/anular/"+raceItem.id,adminA,{motivo:"operación durante reasignación"});
   // La reasignación tiene ya el write lock del documento Sede.
   await reassignment.commitTransaction();
   const raced=await pendingAnnul;
   assert.ok([404,409].includes(raced.status),JSON.stringify(raced));
   assert.equal((await Inventario.findById(raceItem.id)).anulado,false);
   assert.equal((await Sede.findById(SA)).restauranteId,"restaurant-b");
  }finally{
   if(reassignment.inTransaction())await reassignment.abortTransaction();
   await reassignment.endSession();
  }
  await Sede.updateOne({_id:SA},{$set:{restauranteId:"restaurant-a"}});
  const fenceBefore=(await Sede.findById(SA)).authFence||0;
  const annulled=await call("PUT","/anular/"+own.id,adminA,{motivo:"control",usuario:"suplantado"});
  assert.equal(annulled.status,200);
  assert.equal(annulled.data.producto.usuarioAnulacion,"usuario-sede-a");
  assert.equal((await Sede.findById(SA)).authFence,fenceBefore+1);
  assert.equal((await call("PUT","/anular/"+own.id,adminA,{motivo:"repetir"})).status,404);
  assert.equal((await Inventario.findById(own.id)).usuarioAnulacion,"usuario-sede-a");
  assert.equal((await Sede.findById(SA)).authFence,fenceBefore+1);
  // Peticiones concurrentes del mismo administrador: una sola anulación.
  const simultaneo=await item(A,SA,"restaurant-a","anulación concurrente");
  const fenceConcurrent=(await Sede.findById(SA)).authFence;
  const respuestas=await Promise.all(Array.from({length:4},()=>
    call("PUT","/anular/"+simultaneo.id,adminA,{motivo:"petición simultánea"})
  ));
  assert.equal(respuestas.filter(x=>x.status===200).length,1,
    JSON.stringify(respuestas.map(x=>({status:x.status,error:x.data.error}))));
  assert.equal(respuestas.every(x=>[200,404,409].includes(x.status)),true,
    JSON.stringify(respuestas.map(x=>({status:x.status,error:x.data.error}))));
  assert.equal((await Sede.findById(SA)).authFence,fenceConcurrent+1);
  assert.equal((await Inventario.findById(simultaneo.id)).anulado,true);
 }finally{
  if(connected){await mongoose.connection.dropDatabase();await mongoose.disconnect();}
  await new Promise(resolve=>server.close(resolve));
  if(prior===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=prior;
 }
});
