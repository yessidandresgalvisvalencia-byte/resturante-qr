"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const api=fs.readFileSync(path.join(__dirname,"../../routes/API.js"),"utf8");
const schema=fs.readFileSync(path.join(__dirname,"../../models/GrukWompiConciliacion.js"),"utf8");
test("Conflicto Wompi se persiste antes de responder HTTP 503",()=>{
 const start=api.indexOf('if (!resultadoPedido.ok)');
 const save=api.indexOf("await registrarConflictoWompi({",start);
 const response=api.indexOf('return res.status(503)',start);
 assert.ok(start>=0&&save>start&&response>save);
});
test("Registro de conciliación es único por referencia y transacción",()=>{
 assert.match(schema,/schema.index\(\{reference:1,transactionId:1\},\{unique:true/);
 assert.match(schema,/intentos:\{type:Number,default:0,min:0\}/);
});
