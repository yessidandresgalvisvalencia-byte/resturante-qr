"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const {registrarConflictoWompi}=require("../../services/gruk/registrarConflictoWompi");
const Conciliacion=require("../../models/GrukWompiConciliacion");
test("Wompi: incidencias repetidas mantienen una sola fila y cuentan intentos",async(t)=>{
 if(!process.env.TEST_MONGO_URI){t.skip("TEST_MONGO_URI requerido");return;}
 await mongoose.connect(process.env.TEST_MONGO_URI,{dbName:"gruk_test_wompi_conflictos",serverSelectionTimeoutMS:5000});
 const reference="GRUK_PEDIDO_123e4567-e89b-42d3-a456-426614174000";
 const transactionId="wompi-transaccion-prueba";
 try{
  await Conciliacion.init();
  await registrarConflictoWompi({reference,transactionId,reason:"PAGO_NO_APLICADO"});
  await registrarConflictoWompi({reference,transactionId,reason:"PEDIDO_YA_PAGADO_REQUIERE_CONCILIACION"});
  const docs=await Conciliacion.find({reference,transactionId}).lean();
  assert.equal(docs.length,1);
  assert.equal(docs[0].intentos,2);
  assert.equal(docs[0].estado,"PENDIENTE");
  assert.equal(docs[0].reason,"PEDIDO_YA_PAGADO_REQUIERE_CONCILIACION");
 }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
