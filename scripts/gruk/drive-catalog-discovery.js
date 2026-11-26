'use strict';
const NAME=/^gruk-restaurante-[0-9]{1,32}-[0-9]{1,16}\.archive\.age$/;
// Lexicographic cursor, not a chronological ordering. No unbounded scan.
async function discoverCatalogPage(db,{after=null,limit=10}={}){
 if(db?.databaseName!=='gruk_storage_catalog'||!Number.isSafeInteger(limit)||limit<1||limit>10||(after!==null&&(typeof after!=='string'||!NAME.test(after))))throw Error('DISCOVERY_CONFIG');
 const query=after===null?{}:{_id:{$gt:after}};
 const rows=await db.collection('signed_receipts').find(query,{projection:{_id:1},readConcern:{level:'majority'},readPreference:'primary',maxTimeMS:10000,collation:{locale:'simple'}}).sort({_id:1}).limit(limit+1).toArray();
 if(!Array.isArray(rows)||rows.length>limit+1)throw Error('DISCOVERY_UNVERIFIED');
 let previous=after;
 for(const row of rows){
  if(!row||typeof row._id!=='string'||!NAME.test(row._id)||(previous!==null&&row._id<=previous))throw Error('DISCOVERY_UNVERIFIED');
  previous=row._id;
 }
 const names=rows.slice(0,limit).map(r=>r._id);
 return {names,nextCursor:rows.length>limit?names[names.length-1]:null};
}
module.exports={discoverCatalogPage};
