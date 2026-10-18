"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const code=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.js"),"utf8");
test("La API V81 rechaza respuestas que llegan después de cambiar el token",async()=>{
 const a=code.indexOf("const solicitudesEnCurso=new Set();"),b=code.indexOf("function body(",a);assert.ok(a>=0&&b>a);
 let resolver;const fetch=()=>new Promise(r=>{resolver=r;});
 const ctx={token:"usuarioA",fetch,Error,JSON,Set,AbortController};
 vm.runInNewContext(code.slice(a,b),ctx);
 const pending=ctx.api("/home");
 ctx.token="usuarioB";
 resolver({ok:true,status:200,headers:{get:()=>"application/json"},json:async()=>({home:{usuario:"A"}})});
 await assert.rejects(pending,/sesión cambió/);
});
