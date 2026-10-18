"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const Joi=require("joi");
const codigo=fs.readFileSync(path.join(__dirname,"../../modules/finanzas-personales/routes.js"),"utf8");
function esquemaTransaccion(){
 const start=codigo.indexOf("const transaccion=Joi.object(");
 const end=codigo.indexOf(";\nconst tarjetaOperacion=",start);
 assert.ok(start>=0&&end>start,"Esquema de transacciones no localizado");
 return vm.runInNewContext(codigo.slice(start,end)+";transaccion",{Joi});
}
const origenId="507f1f77bcf86cd799439011";
const entrada={
 tipo:"GASTO",montoMinor:200000,moneda:"COP",concepto:"Abono arriendo",
 categoria:"HOGAR",cuenta:"AHORROS",medioPago:"DEBITO",fecha:"2026-10-01",
 recurrenteOrigenId:origenId,externalId:"recurrente-confirmacion-001",recurrente:false
};
test("V81 API conserva el vínculo recurrente y el ID idempotente antes de persistir",()=>{
 const {value,error}=esquemaTransaccion().validate(entrada,{abortEarly:false,stripUnknown:true});
 assert.equal(error,undefined);
 assert.equal(value.recurrenteOrigenId,origenId);
 assert.equal(value.externalId,entrada.externalId);
 assert.equal(value.montoMinor,200000);
});
test("V81 API rechaza vínculo recurrente malformado",()=>{
 const {error}=esquemaTransaccion().validate({...entrada,recurrenteOrigenId:"usuario-ajeno"},{stripUnknown:true});
 assert.ok(error);
});
test("V81 API descarta elección de usuario enviada por el cliente",()=>{
 const {value,error}=esquemaTransaccion().validate({...entrada,usuarioId:"507f1f77bcf86cd799439012"},{stripUnknown:true});
 assert.equal(error,undefined);
 assert.equal(value.usuarioId,undefined);
 assert.equal(value.recurrenteOrigenId,origenId);
});
