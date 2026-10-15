"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const src=fs.readFileSync(path.join(__dirname,"../../services/ledgerV1000.service.js"),"utf8");
test("V1000: replay admite historiales superiores a diez mil dentro del límite explícito",()=>{
 const body=src.slice(src.indexOf("async function recuperar()"),src.indexOf("const previo=await recuperar()"));
 assert.match(body,/const MAX_REPLAY_AUDIT=100000;/);
 assert.match(body,/head\.secuencia>MAX_REPLAY_AUDIT/);
 assert.match(body,/\.limit\(MAX_REPLAY_AUDIT\+1\)/);
 assert.match(body,/\.cursor\(\{batchSize:500\}\)/);
 assert.match(body,/if\(\+\+vistos>MAX_REPLAY_AUDIT\)/);
 assert.match(body,/verificador\.finalizar\(head\)/);
});
