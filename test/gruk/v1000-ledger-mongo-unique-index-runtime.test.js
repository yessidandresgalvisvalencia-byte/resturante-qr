"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Movimiento=require("../../models/MovimientoLedgerV1000");
const {hashAsiento}=require("../../core/finance/v1000/auditarLedger");
const A="0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function id(n){let s="";for(let i=0;i<16;i++){s=A[n%32]+s;n=Math.floor(n/32);}return "01ARZ3NDEK"+s;}
test("V1000: índice físico único impide doble operación en colección Mongo",async t=>{
 if(!process.env.TEST_MONGO_URI){t.skip("Replica set MongoDB requerido");return;}
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:"gruk_test_v1000_indexes_runtime",serverSelectionTimeoutMS:5000});
 const empresaId=id(65001),sedeId=id(65002),actorId=id(65003),sedeAlterna=id(65004);
 try{
  await Movimiento.init();
  const indexes=await Movimiento.collection.indexes();
  const matches=indexes.filter(index=>index.unique===true&&
   JSON.stringify(index.key)===JSON.stringify({empresaId:1,sedeId:1,operacionId:1}));
  assert.equal(matches.length,1,"Falta índice físico único por empresa, sede y operación");
  const original={id:id(65005),operacionId:id(65006),empresaId,sedeId,actorId,
   tipo:"CREDITO",montoCentavos:10,antesCentavos:0,despuesCentavos:10,
   secuencia:1,ip:"127.0.0.1",timestamp:new Date("2026-10-14T00:00:00.000Z"),
   hashAnterior:"0".repeat(64),deletedAt:null};
  original.hash=hashAsiento(original);
  await Movimiento.collection.insertOne(original);
  await assert.rejects(
   ()=>Movimiento.collection.insertOne({...original,_id:new mongoose.Types.ObjectId(),id:id(65007),secuencia:2}),
   err=>err&&err.code===11000
  );
  // Same operation ID can exist in another branch: index scope is tenant+branch.
  const other={...original,_id:new mongoose.Types.ObjectId(),sedeId:sedeAlterna,id:id(65008)};
  other.hash=hashAsiento(other);
  await Movimiento.collection.insertOne(other);
  assert.equal(await Movimiento.countDocuments({empresaId,sedeId}),1);
  assert.equal(await Movimiento.countDocuments({empresaId,sedeId:sedeAlterna}),1);
 }finally{
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
 }
});
