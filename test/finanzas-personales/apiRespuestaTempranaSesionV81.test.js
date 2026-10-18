"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const src=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.js"),"utf8");
test("La API no procesa JSON de cuenta anterior si cambió sesión tras recibir encabezados",async()=>{
 const a=src.indexOf("async function api("),b=src.indexOf("function body(",a);
 assert.ok(a>=0&&b>a);
 let responder,parseos=0;
 const fetch=()=>new Promise(resolve=>{responder=resolve;});
 const context={token:"cuenta-A",fetch,Error,JSON};
 vm.runInNewContext(src.slice(a,b),context);
 const pending=context.api("/home");
 context.token="cuenta-B";
 responder({ok:true,status:200,headers:{get:()=>"application/json"},json:async()=>{parseos++;return {home:{}};}});
 await assert.rejects(pending,/sesión cambió/);
 assert.equal(parseos,0);
});
