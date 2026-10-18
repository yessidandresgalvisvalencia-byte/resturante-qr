"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {normalizarErrorTransaccionalV81}=require("../../modules/finanzas-personales/services/persistenciaLedgerV81.service");

test("V81 normaliza colisiones únicas y conflictos de escritura como 409",()=>{
 for(const code of [11000,112,251]){
  const mapped=normalizarErrorTransaccionalV81(Object.assign(new Error("Mongo conflict"),{code}));
  assert.equal(mapped.statusCode,409);
  assert.equal(mapped.codigo,"REINTENTAR_MISMO_ID");
  assert.match(mapped.message,/mismo eventId/);
 }
});
test("V81 trata los resultados de commit inciertos como reintentables sin crear otro ID",()=>{
 for(const label of ["TransientTransactionError","UnknownTransactionCommitResult"]){
  const original=Object.assign(new Error("Mongo transient"),{
   hasErrorLabel:(s)=>s===label
  });
  const mapped=normalizarErrorTransaccionalV81(original);
  assert.equal(mapped.statusCode,409);
  assert.match(mapped.message,/mismo eventId/);
  const byArray=normalizarErrorTransaccionalV81(Object.assign(new Error("Mongo transient"),{errorLabels:[label]}));
  assert.equal(byArray.statusCode,409);
 }
});
test("V81 no disfraza una falla desconocida como conflicto idempotente",()=>{
 const original=Object.assign(new Error("storage offline"),{code:999});
 assert.strictEqual(normalizarErrorTransaccionalV81(original),original);
});
