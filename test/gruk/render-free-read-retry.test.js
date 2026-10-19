"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.js"),"utf8");
const api=source.slice(source.indexOf("async function api("),source.indexOf("function pesosExactos("));
test("al despertar Render solo reintenta lecturas GET, nunca POST de movimientos",()=>{
 assert.match(api,/const soloLectura=String\(o\.method\|\|"GET"\)\.toUpperCase\(\)==="GET"/);
 assert.match(api,/if\(!soloLectura\|\|intento>=2/);
 assert.match(api,/soloLectura&&intento<2&&\[502,503,504\]\.includes\(r\.status\)/);
 assert.match(api,/for\(let intento=0;;intento\+\+\)/);
 assert.match(api,/\[500,1200\]\[intento\]/);
});
test("cada reintento respeta sesión y cancelación, sin inferir dinero en cero",()=>{
 assert.match(api,/const tokenSolicitud=token/);
 assert.match(api,/controller\.signal\.aborted/);
 assert.match(api,/comprobarSesion\(\);let r/);
 assert.match(api,/comprobarSesion\(\);if\(!soloLectura/);
 assert.match(api,/finally\{solicitudesEnCurso\.delete\(controller\)/);
 assert.doesNotMatch(api,/Number\([^)]*\|\|0\)/);
});
