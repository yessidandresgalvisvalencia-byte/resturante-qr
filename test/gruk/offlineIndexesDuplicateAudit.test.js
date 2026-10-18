"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {auditOfflineIndexDuplicates:audit}=require("../../core/offline/offlineIndexesDuplicateAudit.service");
function mock(counts={}){
 const pipelines=[];return {pipelines,collection(name){return {aggregate(pipeline,options){
  pipelines.push({name,pipeline,options});
  return {toArray:async()=>counts[name]?[{duplicateGroups:counts[name]}]:[]};
 }};}};
}
test("auditoria consulta 4 colecciones y no escribe datos",async()=>{
 const db=mock();const result=await audit(db);
 assert.equal(result.safe,true);assert.equal(result.results.length,4);
 assert.equal(db.pipelines.length,4);
 for(const entry of db.pipelines){
  assert.equal(entry.options.maxTimeMS,30000);
  assert.deepEqual(entry.pipeline.at(-1),{$count:"duplicateGroups"});
 }
});
test("duplicados de caja bloquean recomendación de migración",async()=>{
 const db=mock({gruk_offline_caja_intenciones:2});const result=await audit(db);
 assert.equal(result.safe,false);
 assert.equal(result.results.find(x=>x.collection==="gruk_offline_caja_intenciones").duplicateGroups,2);
});
test("falla cerrado sin base de datos",async()=>{
 await assert.rejects(audit(null),e=>e.code==="OFFLINE_AUDIT_DB_REQUIRED");
});
