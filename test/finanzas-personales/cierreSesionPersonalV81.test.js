"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const code=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.js"),"utf8");
test("Al salir de V81 se elimina el token en memoria y se corta Socket.IO",()=>{
 const from=code.indexOf("function clearToken(){"),to=code.indexOf("const $=",from);
 assert.ok(from>=0&&to>from);
 const clear=code.slice(from,to);
 assert.match(clear,/token=null/);
 assert.match(clear,/sessionStorage\.removeItem/);
 assert.match(clear,/localStorage\.removeItem/);
 assert.match(clear,/socket\.disconnect\(\)/);
 assert.match(clear,/invalidarIndicadoresFinancieros\(\)/);
});
