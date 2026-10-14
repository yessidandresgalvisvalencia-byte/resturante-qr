"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../../services/ledgerV1000.service.js"),"utf8");
test("V1000: un duplicado hallado dentro de una transacción exige recuperar con auditoría completa",()=>{
 const transaction=source.slice(source.indexOf("let duplicadoEnTransaccion=false"),source.indexOf("}catch(error){",source.indexOf("let duplicadoEnTransaccion=false")));
 assert.match(transaction,/const duplicado=await Movimiento\.findOne/);
 assert.match(transaction,/if\(duplicado\)\s*\{[\s\S]*?duplicadoEnTransaccion=true;\s*return;/);
 assert.match(transaction,/if\(duplicadoEnTransaccion\)return await recuperar\(\);/);
 assert.doesNotMatch(transaction,/registrado=duplicado/);
});
