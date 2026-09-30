"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const Intento=require("../../models/IntentoCobroSuscripcion");
const {adquirirDerechoEnvio}=require("../../core/pagos/intentoCobro.service");
const uri=process.env.TEST_MONGO_URI;
test("CAS permite un solo worker para un cobro recurrente",{skip:!uri},async()=>{
 await mongoose.connect(uri,{dbName:"gruk_test_cobro_cas"});
 await Intento.deleteMany({});
 const i=await Intento.create({restaurantId:"tenant-cas",periodo:"2026-09",reference:"renovacion_202609_cas",amountInCents:22000000,currency:"COP",estado:"CREADO"});
 const resultados=await Promise.all(Array.from({length:8},()=>adquirirDerechoEnvio(i._id)));
 assert.equal(resultados.filter(Boolean).length,1);
 const final=await Intento.findById(i._id).lean();
 assert.equal(final.estado,"ENVIANDO");
 assert.ok(final.inicioEnvioAt);
 await mongoose.disconnect();
});
