"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const load=p=>fs.readFileSync(path.join(__dirname,"../..",p),"utf8");
test("ruta preventiva usa autenticacion personal, validacion cerrada y no escribe movimientos",()=>{
 const s=load("modules/finanzas-personales/routes.js");
 const login=s.indexOf("router.use(auth,entitlement)");
 const endpoint=s.indexOf('router.post("/gastos/evaluar"');
 assert.ok(login>=0&&endpoint>login);
 const route=s.slice(endpoint,endpoint+500);
 assert.match(route,/validate\(evaluarCompraSchema\)/);
 assert.match(route,/gastoInteligente\.evaluar\(req\.personalAuth\.userId,req\.validated\)/);
 assert.match(route,/soloLectura:true/);
 assert.doesNotMatch(route,/req\.body\.usuarioId|create\(|insertMany\(|registrarTransaccion/);
 assert.match(s,/montoMinor:Joi\.number\(\)\.integer\(\)\.min\(1\)\.max\(Number\.MAX_SAFE_INTEGER\)\.required\(\)/);
});
test("simulador visible no ejecuta gastos y muestra respuestas con texto seguro",()=>{
 const h=load("public/finanzas-personales.html");
 const j=load("public/finanzas-personales.js");
 for(const id of ["compraMonto","evaluarCompra","compraEstado","compraRespuesta"])assert.match(h,new RegExp('id="'+id+'"'));
 assert.match(j,/api\("\/gastos\/evaluar",body\(\{montoMinor:Number\(texto\)\}\)\)/);
 assert.match(j,/respuesta\.textContent=evaluacion\.mensaje/);
 assert.match(j,/if\(token!==sesion\|\|\$\("app"\)\.hidden\)return/);
 assert.doesNotMatch(j.slice(j.indexOf('$("evaluarCompra").onclick='),j.indexOf('$("refresh").onclick=')),/innerHTML|\/movimientos|registrarTransaccion/);
});
