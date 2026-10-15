"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Conciliacion=require("../../models/GrukWompiConciliacion");
const {registrarConflictoWompi}=require("../../services/gruk/registrarConflictoWompi");
test("Wompi: conflictos concurrentes conservan una incidencia unica",async(t)=>{
 if(!process.env.TEST_MONGO_URI){t.skip("TEST_MONGO_URI requerido");return;}
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:"gruk_test_wompi_conflictos_concurrentes",serverSelectionTimeoutMS:5000});
 const reference="GRUK_PEDIDO_123e4567-e89b-42d3-a456-426614174001";
 const transactionId="wompi-concurrente-001";
 try{
  await Conciliacion.init();
  const results=await Promise.allSettled(Array.from({length:8},()=>registrarConflictoWompi({reference,transactionId,reason:"PAGO_NO_APLICADO"})));
  const failures=results.filter(result=>result.status==="rejected");
  assert.equal(failures.length,0,"Los reintentos simultaneos deben converger sin errores");
  const rows=await Conciliacion.find({reference,transactionId}).lean();
  assert.equal(rows.length,1);
  assert.equal(rows[0].intentos,8);
 }finally{
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
 }
});
