"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {validarMongoPruebasV81}=require("../../scripts/exigir-mongo-v81-pruebas");
const local="mongodb://127.0.0.1:27017/gruk_v81_test_integracion?replicaSet=rs0";
test("V81 permite únicamente MongoDB replica set local y base de pruebas",()=>{
 assert.equal(validarMongoPruebasV81(local,"test"),true);
});
test("V81 rechaza producción, Mongo remoto, SRV, autenticación y bases no aisladas",()=>{
 for(const [uri,env] of [
  [undefined,"test"],[local,"production"],
  ["mongodb://mongo.example.com:27017/gruk_v81_test_integracion?replicaSet=rs0","test"],
  ["mongodb+srv://127.0.0.1/gruk_v81_test_integracion?replicaSet=rs0","test"],
  ["mongodb://admin:secret@127.0.0.1:27017/gruk_v81_test_integracion?replicaSet=rs0","test"],
  ["mongodb://127.0.0.1:27017/finanzas_personales?replicaSet=rs0","test"],
  ["mongodb://127.0.0.1:27017/gruk_v81_test_integracion","test"]
 ])assert.throws(()=>validarMongoPruebasV81(uri,env),Error);
});
