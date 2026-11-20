// GRUK P0-04 independent read-only verification after atomic legacy migration.
// Prints aggregate counters only; no customer data, document IDs, or secrets.
'use strict';
if (process.env.GRUK_ENTERPRISE_DB !== 'restaurante' ||
    process.env.GRUK_ENTERPRISE_DB_CONFIRM !== 'restaurante') {
  throw new Error('Enterprise database must be confirmed');
}
const crypto = require('node:crypto');
const database = db.getSiblingDB('restaurante');
const sales = database.getCollection('ventas');
const journal = database.getCollection('gruk_p004_venta_originales');
const sites = database.getCollection('sedes');
const same = (a,b) => a instanceof ObjectId && b instanceof ObjectId && a.equals(b);
const serialize = v => EJSON.stringify(v,null,0,{relaxed:false});
const hash = v => crypto.createHash('sha256').update(serialize(v)).digest('hex');
const backups = journal.find({operation:'GRUK-P0-04-2026-11-20'}).toArray();
const result = {
  journaled:backups.length,
  checked:0, preservedExactly:0,
  mismatched:0, invalidSiteRemaining:0, verifiedSiteOwnership:0,
  ready:false
};
for(const record of backups) {
  const before=record.original;
  const now=sales.findOne({_id:record._id,empresaId:record.empresaId});
  const site=sites.findOne({_id:record.targetSedeId,empresaId:record.empresaId});
  result.checked++;
  if (!before || !now || !site || before.sedeId!==null ||
      !same(record.empresaId,before.empresaId) ||
      !same(record.targetSedeId,now.sedeId) ||
      record.sourceHash!==hash(before)) {
    result.mismatched++;continue;
  }
  result.verifiedSiteOwnership++;
  const expected={...before,sedeId:record.targetSedeId};
  if (serialize(now)===serialize(expected)) result.preservedExactly++;
  else result.mismatched++;
}
result.invalidSiteRemaining=sales.countDocuments({sedeId:{$not:{$type:'objectId'}}});
result.ready=result.journaled===16 && result.checked===16 &&
  result.preservedExactly===16 && result.verifiedSiteOwnership===16 &&
  result.invalidSiteRemaining===0 && result.mismatched===0;
printjson(result);
if(!result.ready) throw new Error('Postmigration reconciliation blocked');
