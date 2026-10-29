"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {stagingOrigin,verificarStaging}=require("../../scripts/staging-smoke.service");
const sha="a".repeat(40);
const headers={"content-type":"application/json; charset=utf-8"};
const health={status:"ok",db:"connected",version:"1.0.0",commit:sha,uptime:12};
const ready={ready:true,db:"connected"};
const respuesta=(status,data,extra={})=>new Response(JSON.stringify(data),{
 status,headers:{...headers,...extra}
});
function fakeFetcher(healthResponse=respuesta(200,health),readyResponse=respuesta(200,ready)){
 const solicitadas=[];
 const fetcher=async(url,opts)=>{
  solicitadas.push({url,opts});
  return url.endsWith("/health")?healthResponse:readyResponse;
 };
 return {fetcher,solicitadas};
}
test("Capa 2 staging: verifica health ready SHA y prohíbe redirecciones",async()=>{
 const f=fakeFetcher();
 const data=await verificarStaging({url:"https://staging.example.com/",commit:sha,fetcher:f.fetcher});
 assert.equal(data.status,"ok");
 assert.equal(data.commit,sha);
 assert.deepEqual(f.solicitadas.map(x=>new URL(x.url).pathname).sort(),["/health","/ready"]);
 assert.equal(f.solicitadas.every(x=>x.opts.redirect==="error"),true);
});
test("Capa 2 staging: rechaza HTTP remoto, URLs con credenciales o path",()=>{
 for(const u of ["http://staging.example.com/","https://x:y@staging.example.com/",
  "https://staging.example.com/admin","https://staging.example.com/?token=secret",
  "javascript:alert(1)"]){
  assert.throws(()=>stagingOrigin(u),/STAGING_URL_/);
 }
 assert.equal(stagingOrigin("http://127.0.0.1:3000/"),"http://127.0.0.1:3000");
});
test("Capa 2 staging: deniega commit obsoleto, incompleto o ausente",async()=>{
 const f=fakeFetcher();
 await assert.rejects(()=>verificarStaging({url:"https://staging.example.com",commit:"b".repeat(40),fetcher:f.fetcher}),/STAGING_COMMIT_MISMATCH/);
 await assert.rejects(()=>verificarStaging({url:"https://staging.example.com",commit:"main",fetcher:f.fetcher}),/STAGING_COMMIT_INVALID/);
});
test("Capa 2 staging: no declara éxito si DB no lista o 503",async()=>{
 const f=fakeFetcher(respuesta(503,{status:"degraded",db:"disconnected"}));
 await assert.rejects(()=>verificarStaging({url:"https://staging.example.com",commit:sha,fetcher:f.fetcher}),/STAGING_HEALTH_HTTP_503/);
 const x=fakeFetcher(respuesta(200,health),respuesta(200,{ready:false,db:"disconnected"}));
 await assert.rejects(()=>verificarStaging({url:"https://staging.example.com",commit:sha,fetcher:x.fetcher}),/STAGING_NOT_READY/);
});
test("Capa 2 staging: exige JSON y contrato de /health",async()=>{
 const noJson=fakeFetcher(respuesta(200,health,{"content-type":"text/html"}));
 await assert.rejects(()=>verificarStaging({url:"https://staging.example.com",commit:sha,fetcher:noJson.fetcher}),/STAGING_CONTENT_TYPE_INVALID/);
 const sinVersion=fakeFetcher(respuesta(200,{...health,version:null}));
 await assert.rejects(()=>verificarStaging({url:"https://staging.example.com",commit:sha,fetcher:sinVersion.fetcher}),/STAGING_HEALTH_CONTRACT_INVALID/);
});
