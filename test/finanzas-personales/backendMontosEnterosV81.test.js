"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../../modules/finanzas-personales/routes.js"),"utf8");
test("Backend V81 rechaza importes decimales e inseguros de créditos y metas",()=>{
 const credit=source.match(/const credito=Joi\.object\(\{[^\n]+/);
 const goal=source.match(/const meta=Joi\.object\(\{[^\n]+/);
 assert.ok(credit&&goal);
 for(const field of ["saldo","cuotaMensual"])assert.match(credit[0],new RegExp(field+":Joi\\.number\\(\\)\\.integer\\(\\)\\.min\\(0\\)\\.max\\(Number\\.MAX_SAFE_INTEGER\\)"));
 for(const field of ["objetivo","acumulado"])assert.match(goal[0],new RegExp(field+":Joi\\.number\\(\\)\\.integer\\(\\)"));
 assert.match(goal[0],/\.max\(Number\.MAX_SAFE_INTEGER\)/);
});
