"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const src=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.js"),"utf8");
test("Guardado manual V81 impide doble envío simultáneo y conserva id al fallar",()=>{
 const a=src.indexOf('$("saveMovimiento").onclick=async()=>'),b=src.indexOf(';$("savePrestamo")',a);
 assert.ok(a>=0&&b>a);
 const fn=src.slice(a,b);
 assert.match(fn,/if\(boton\.disabled\)return;boton\.disabled=true/);
 assert.match(fn,/finally\{boton\.disabled=false\}/);
 assert.match(fn,/manualExternalId=manualExternalId\|\|/);
 assert.ok(fn.indexOf('manualExternalId=null;')>fn.indexOf('await api("/transacciones"'));
 assert.ok(fn.indexOf('manualExternalId=null;')<fn.indexOf('await load()'));
});
