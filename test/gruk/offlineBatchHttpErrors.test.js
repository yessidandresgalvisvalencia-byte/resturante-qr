"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {isRetryableOfflineBatchError:retryable}=require("../../core/offline/offlineBatchHttpErrors.service");
test("Capa 2: los errores transitorios de escritura requieren reintento del lote",()=>{
 for(const code of ["OFFLINE_TRANSACTION_UNAVAILABLE","OFFLINE_INBOX_WRITE_UNVERIFIED"])
  assert.equal(retryable({code}),true,code);
});
test("Capa 2: conflictos y solicitudes inválidas nunca reciben etiqueta retryable",()=>{
 for(const code of ["OFFLINE_EVENT_CONFLICT","OFFLINE_TENANT_MISMATCH",
  "OFFLINE_BATCH_SIZE","OFFLINE_INVALID_EVENT","OFFLINE_DUPLICATE_EVENT",
  "OFFLINE_INVALID_PAYLOAD","OFFLINE_UNSAFE_KEY"])
  assert.equal(retryable({code}),false,code);
 for(const error of [null,undefined,{}, {code:400},{code:"OTHER"},new Error("unknown")])
  assert.equal(retryable(error),false);
});
