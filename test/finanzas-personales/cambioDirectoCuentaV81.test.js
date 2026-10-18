"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const src=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.js"),"utf8");
test("Cambio directo de cuenta cancela peticiones y desconecta canal de cuenta anterior",()=>{
 const a=src.indexOf("function enter(j)"),b=src.indexOf("function connect()",a);
 assert.ok(a>=0&&b>a);
 const snippet=src.slice(a,b);
 assert.match(snippet,/if\(token!==j\.token\)\{cancelarSolicitudes\(\)/);
 assert.match(snippet,/socket\.disconnect\(\);socket=null/);
 assert.ok(snippet.indexOf("cancelarSolicitudes()")<snippet.indexOf("token=j.token"));
});
