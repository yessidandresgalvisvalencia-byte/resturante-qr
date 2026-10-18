"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.js"),"utf8");
test("Error tardío de sesión antigua no altera inicio de sesión actual",()=>{
 const a=source.indexOf("async function load()"),b=source.indexOf("}window.deshacerUltimaCuota",a);
 assert.ok(a>=0&&b>a);
 const handler=source.slice(a,b);
 assert.match(handler,/catch\(e\)\{if\(e\.code==="SESION_CAMBIADA"\|\|token!==tokenAlInicio\)return;if\(e\.statusCode===401\)/);
});
