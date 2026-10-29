"use strict";
const {verificarStaging}=require("./staging-smoke.service");
(async()=>{
 try{
  const result=await verificarStaging({
   url:process.env.GRUK_STAGING_URL,commit:process.env.GRUK_EXPECTED_COMMIT
  });
  console.log("[GRUK STAGING SMOKE]",JSON.stringify(result));
 }catch(error){
  console.error("[GRUK STAGING SMOKE FAIL]",error?.message||"UNKNOWN");
  process.exitCode=1;
 }
})();
