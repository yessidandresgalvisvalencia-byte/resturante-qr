"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const sw=fs.readFileSync(path.join(__dirname,"../../public/sw.js"),"utf8");
test("V81: navegación de app instalada no espera indefinidamente a Render",()=>{
 assert.match(sw,/const timeout=setTimeout\(\(\)=>controller\.abort\(\),12000\)/);
 assert.match(sw,/fetch\(request,\{cache:"no-store",signal:controller\.signal\}\)/);
 assert.match(sw,/finally\{clearTimeout\(timeout\)\}/);
 assert.match(sw,/new Response\(OFFLINE_HTML,\{status:503/);
 assert.match(sw,/Reintentar/);
});
test("V81: red sin conexión no muestra datos financieros almacenados y API nunca entra al caché",()=>{
 assert.match(sw,/request\.method!=="GET"/);
 assert.ok(sw.includes("url.origin!==self.location.origin"));
 assert.ok(sw.includes("internal|socket"));
 assert.doesNotMatch(sw,/caches\.match\(.*saldo/i);
 assert.match(sw,/Tus saldos no se reemplazarán por ceros/);
});
