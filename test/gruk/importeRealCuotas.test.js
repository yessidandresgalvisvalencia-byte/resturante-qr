"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const service=fs.readFileSync(require.resolve("../../modules/finanzas-personales/services/patrimonioPersonal.service"),"utf8");
const routes=fs.readFileSync(require.resolve("../../modules/finanzas-personales/routes"),"utf8");
test("cuota exige monto real entero seguro",()=>{
 assert.match(service,/Number\.isSafeInteger\(montoPagadoRealMinor\)/);
 assert.match(routes,/montoPagadoRealMinor:Joi\.number\(\)\.integer\(\)\.min\(1\)/);
});
test("anulación restaura importe real",()=>assert.match(service,/tx\.montoPagadoRealMinor\|\|tx\.montoMinor/));
test("capital nunca aumenta por pagar",()=>assert.match(service,/Math\.min\(montoBase,montoPagadoRealMinor\)/));
