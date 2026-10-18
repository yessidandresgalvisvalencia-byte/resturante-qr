"use strict";
// Read-only duplicate audit before any unique index creation. No document mutation.
const SPECS=[
 ["gruk_offline_ventas",["empresaId","sedeId","eventId"]],
 ["gruk_offline_stock_movimientos",["empresaId","sedeId","batchId","productoId"]],
 ["gruk_offline_caja_intenciones",["empresaId","sedeId","eventId"]],
 ["gruk_ledger_movimientos",["empresaId","sedeId","eventId","tipo"]]
];
function fail(code){const e=new Error(code);e.code=code;throw e;}
async function auditOfflineIndexDuplicates(db){
 if(typeof db?.collection!=="function")fail("OFFLINE_AUDIT_DB_REQUIRED");
 const results=[];
 for(const [name,keys] of SPECS){
  const group=Object.fromEntries(keys.map(k=>[k,"$"+k]));
  // Restrict output to counts, never expose tenant or transaction identifiers.
  const cursor=db.collection(name).aggregate([
   {$group:{_id:group,count:{$sum:1}}},
   {$match:{count:{$gt:1}}},
   {$count:"duplicateGroups"}
  ],{allowDiskUse:true,maxTimeMS:30000});
  const rows=await cursor.toArray();
  const duplicateGroups=rows[0]?.duplicateGroups||0;
  if(!Number.isSafeInteger(duplicateGroups)||duplicateGroups<0)fail("OFFLINE_AUDIT_INVALID_RESULT");
  results.push(Object.freeze({collection:name,duplicateGroups}));
 }
 return Object.freeze({safe:results.every(r=>r.duplicateGroups===0),results:Object.freeze(results)});
}
module.exports={auditOfflineIndexDuplicates};
