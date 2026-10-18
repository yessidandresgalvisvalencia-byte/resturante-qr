"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const src=fs.readFileSync(require.resolve("../../modules/finanzas-personales/security/entitlement.middleware"),"utf8");
test("acceso gratis no bloquea suscripciones vencidas",()=>{
 assert.match(src,/modo:"GRATIS"/);
 assert.match(src,/cobroRequerido:false/);
 assert.doesNotMatch(src,/res\.status\(402\)/);
 assert.match(src,/req\.personalAuth\.userId/);
});
