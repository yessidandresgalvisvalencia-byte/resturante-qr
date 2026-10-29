"use strict";
const {verifyDeploymentCommit}=require("../core/health/deploymentCommit.contract");
function stagingOrigin(raw){
 if(typeof raw!=="string")throw Error("STAGING_URL_REQUIRED");
 let parsed;
 try{parsed=new URL(raw);}catch{throw Error("STAGING_URL_INVALID");}
 const local=["localhost","127.0.0.1","[::1]"].includes(parsed.hostname);
 if((parsed.protocol!=="https:"&&!(local&&parsed.protocol==="http:"))||
    parsed.username||parsed.password||parsed.search||parsed.hash||
    parsed.pathname!=="/")throw Error("STAGING_URL_UNSAFE");
 return parsed.origin;
}
async function verificarStaging({url,commit,fetcher=fetch,timeoutMs=8000}={}){
 const origen=stagingOrigin(url);
 if(!/^[0-9a-f]{40}$/.test(commit||""))throw Error("STAGING_COMMIT_INVALID");
 async function leer(endpoint){
  const respuesta=await fetcher(origen+endpoint,{
   method:"GET",redirect:"error",signal:AbortSignal.timeout(timeoutMs),
   headers:{accept:"application/json"}
  });
  if(respuesta.status!==200)throw Error("STAGING_"+endpoint.slice(1).toUpperCase()+"_HTTP_"+respuesta.status);
  const type=respuesta.headers.get("content-type")||"";
  if(!/^application\/json(?:;|$)/i.test(type))throw Error("STAGING_CONTENT_TYPE_INVALID");
  return respuesta.json();
 }
 const [health,ready]=await Promise.all([leer("/health"),leer("/ready")]);
 if(health.status!=="ok"||health.db!=="connected"||
    typeof health.version!=="string"||!Number.isInteger(health.uptime)||
    health.uptime<0)throw Error("STAGING_HEALTH_CONTRACT_INVALID");
 if(ready.ready!==true||ready.db!=="connected")throw Error("STAGING_NOT_READY");
 if(!verifyDeploymentCommit(health.commit,commit))throw Error("STAGING_COMMIT_MISMATCH");
 return Object.freeze({status:"ok",ready:true,commit,version:health.version,
  db:health.db,uptime:health.uptime});
}
module.exports={stagingOrigin,verificarStaging};
