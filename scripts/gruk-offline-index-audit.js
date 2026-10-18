"use strict";
// Explicit read-only operational diagnostic. Run in Render Shell as:
// node scripts/gruk-offline-index-audit.js
// Requires existing MONGO_URI (and optional MONGO_DB). Never creates indexes.
require("dotenv").config();
const mongoose=require("mongoose");
const {auditOfflineIndexDuplicates}=require("../core/offline/offlineIndexesDuplicateAudit.service");
const {assertOfflineStagingIndexes}=require("../core/offline/offlineIndexesReadiness.service");
const {normalizeMongoUri}=require("../core/config/mongoUri");
async function inspect(db){
 const duplicates=await auditOfflineIndexDuplicates(db);
 let indexesReady=false;
 try{await assertOfflineStagingIndexes(db);indexesReady=true;}
 catch(e){if(e.code!=="OFFLINE_INDEX_NOT_READY")throw e;}
 return {duplicates, indexesReady, ready:duplicates.safe&&indexesReady};
}
async function main(){
 if(!process.env.MONGO_URI)throw Error("OFFLINE_AUDIT_MONGO_URI_REQUIRED");
 await mongoose.connect(normalizeMongoUri(process.env.MONGO_URI),
   process.env.MONGO_DB?{dbName:process.env.MONGO_DB}:{});
 try{
  const outcome=await inspect(mongoose.connection.db);
  process.stdout.write(JSON.stringify(outcome)+"\n");
  if(!outcome.ready)process.exitCode=2;
 }finally{await mongoose.disconnect();}
}
if(require.main===module)main().catch(e=>{
 process.stderr.write(JSON.stringify({ok:false,code:e.code||"OFFLINE_AUDIT_FAILED"})+"\n");
 process.exitCode=1;
});
module.exports={inspect};
