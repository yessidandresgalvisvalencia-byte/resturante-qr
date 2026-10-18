"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const src=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.js"),"utf8");
test("Cerrar sesión aborta solicitudes financieras pendientes",async()=>{
 const start=src.indexOf("const solicitudesEnCurso=new Set();");
 const end=src.indexOf("function body(",start);
 assert.ok(start>=0&&end>start);
 const snippet=src.slice(start,end);
 const controllerFlags=[];let resolveFetch;
 const fetch=(url,opts)=>new Promise((resolve,reject)=>{
  resolveFetch=resolve;
  opts.signal.addEventListener("abort",()=>reject(Object.assign(new Error("Aborted"),{name:"AbortError"})));
 });
 const storage={removeItem(){}};
 const ctx={token:"usuario-uno",socket:null,sessionStorage:storage,localStorage:storage,fetch,AbortController,Set,Error,JSON};
 vm.runInNewContext(snippet,ctx);
 const pendiente=ctx.api("/home");
 ctx.clearToken();
 await assert.rejects(pendiente,/Aborted/);
 assert.equal(ctx.token,null);
 assert.equal(vm.runInNewContext("solicitudesEnCurso.size",ctx),0);
});
