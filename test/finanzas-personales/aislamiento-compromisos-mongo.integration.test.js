"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

const uri = process.env.TEST_MONGO_URI;
const enabled = process.env.GRUK_V81_TEST_DB_CONFIRM === "SOLO_PRUEBAS_LOCALES";
if (uri) {
 const url = new URL(uri);
 if (url.protocol !== "mongodb:" ||
     !["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname.toLowerCase()) ||
     decodeURIComponent(url.pathname.slice(1)) !== "gruk_v81_test" ||
     url.searchParams.has("dbName") || !enabled) {
  throw new Error("Prueba de aislamiento bloqueada fuera de MongoDB local de pruebas");
 }
}

test("MongoDB: compromisos y cuotas están aislados por usuario autenticado", {skip: !uri}, async () => {
 const mongoose = require("mongoose");
 const Padre = require("../../modules/finanzas-personales/models/compromisoCuotas.model");
 const Cuota = require("../../modules/finanzas-personales/models/cuotaHija.model");
 const {listar} = require("../../modules/finanzas-personales/services/compromisosCuotas.service");
 const a = new mongoose.Types.ObjectId();
 const b = new mongoose.Types.ObjectId();
 const createdIds = [];
 await mongoose.connect(uri, {serverSelectionTimeoutMS: 10000});
 try {
  const [pa, pb] = await Padre.create([
   {usuarioId:a, concepto:"Arriendo privado", categoria:"VIVIENDA", montoTotalMinor:200000, saldoMinor:200000, numeroCuotas:1},
   {usuarioId:b, concepto:"Moto privada", categoria:"TRANSPORTE", montoTotalMinor:300000, saldoMinor:300000, numeroCuotas:1}
  ]);
  createdIds.push(pa._id, pb._id);
  await Cuota.create([
   {usuarioId:a, compromisoId:pa._id, numero:1, montoMinor:200000},
   {usuarioId:b, compromisoId:pb._id, numero:1, montoMinor:300000},
   // Una cuota con referencia cruzada no puede filtrarse solamente por compromisoId.
   {usuarioId:b, compromisoId:pa._id, numero:2, montoMinor:1}
  ]);
  const [visibleA, visibleB] = await Promise.all([listar(a), listar(b)]);
  assert.equal(visibleA.length,1);
  assert.equal(visibleB.length,1);
  assert.equal(visibleA[0].concepto,"Arriendo privado");
  assert.equal(visibleB[0].concepto,"Moto privada");
  assert.deepEqual(visibleA[0].cuotas.map(x=>x.montoMinor),[200000]);
  assert.deepEqual(visibleB[0].cuotas.map(x=>x.montoMinor),[300000]);
  assert.equal((await listar(new mongoose.Types.ObjectId())).length,0);
 } finally {
  await Cuota.deleteMany({usuarioId:{$in:[a,b]}});
  await Padre.deleteMany({_id:{$in:createdIds},usuarioId:{$in:[a,b]}});
  await mongoose.disconnect();
 }
});
