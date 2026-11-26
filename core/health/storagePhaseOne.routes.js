"use strict";
// Phase 1 is capability registration only: no filesystem, listener, scheduler or database access.
function registerStoragePhaseOne(app,{env=process.env,log=console.log}={}){
 if(typeof app?.get!=="function")throw Error("INVALID_APP");
 const blocked=env.GRUK_NATIVE_REAL_BACKUP_ENABLED==="true";
 const state=Object.freeze({component:"gruk-storage",mode:"standby",realBackupEnabled:false,readyForRealBackup:false});
 app.get("/health/storage",(_req,res)=>{
  res.set("Cache-Control","no-store");
  return res.status(blocked?503:200).json({...state,status:blocked?"configuration-blocked":"standby"});
 });
 log(blocked?"GRUK_STORAGE_REAL_BACKUP_BLOCKED":"GRUK_STORAGE_PHASE_ONE_STANDBY");
 return state;
}
module.exports={registerStoragePhaseOne};
