"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.js"),"utf8");
test("Cancelar solicitudes de cuenta A no cancela consultas iniciadas por cuenta B",async()=>{
 const from=source.indexOf("const solicitudesEnCurso=new Set();"),to=source.indexOf("function body(",from);
 assert.ok(from>=0&&to>from);
 const petitions=[];
 const fetch=(url,opts)=>new Promise((resolve,reject)=>{
  petitions.push({resolve,signal:opts.signal});
  opts.signal.addEventListener("abort",()=>reject(new Error("Aborted")),{once:true});
 });
 const storage={removeItem(){}};
 const ctx={token:"A",fetch,AbortController,Set,Error,JSON,sessionStorage:storage,localStorage:storage,socket:null};
 vm.runInNewContext(source.slice(from,to),ctx);
 const old=ctx.api("/home");
 const rejected=assert.rejects(old,/Aborted/);
 ctx.cancelarSolicitudes();
 ctx.token="B";
 const current=ctx.api("/home");
 assert.equal(petitions.length,2);
 assert.equal(petitions[0].signal.aborted,true);
 assert.equal(petitions[1].signal.aborted,false);
 petitions[1].resolve({ok:true,status:200,headers:{get:()=>"application/json"},json:async()=>({home:{cuenta:"B"}})});
 await rejected;
 const result=await current;
 assert.equal(result.home.cuenta,"B");
 assert.equal(petitions[1].signal.aborted,false);
});
