'use strict';
// Temporary bounded cloud vault. No source database access, no automatic deletion.
const {createHash}=require('node:crypto');
const CAP=32*1024*1024, CHUNK=256*1024;
const NAME=/^gruk-restaurante-[0-9]{1,32}-[0-9]{1,16}\.archive\.age$/;
const HEADER=Buffer.from('age-encryption.org/v1\n');
function createMongoVault({db,client,keyring}){
 if(db?.databaseName!=='gruk_storage_vault'||typeof client?.startSession!=='function'||typeof keyring?.verify!=='function')throw Error('VAULT_SCOPE');
 const records=db.collection('archives'),chunks=db.collection('archive_chunks'),quota=db.collection('vault_quota');
 function validate(name,receipt){
  if(typeof name!=='string'||!NAME.test(name))throw Error('VAULT_NAME');
  const m=keyring.verify(receipt,name);
  if(m?.name!==name||m.database!=='restaurante'||m.version!==1||!Number.isSafeInteger(m.bytes)||m.bytes<64||m.bytes>CAP||!/^[a-f0-9]{64}$/.test(m.sha256))throw Error('VAULT_RECEIPT');
  return m;
 }
 function verify(data,m){
  if(!Buffer.isBuffer(data)||data.length!==m.bytes||!data.subarray(0,HEADER.length).equals(HEADER)||createHash('sha256').update(data).digest('hex')!==m.sha256)throw Error('VAULT_INTEGRITY');
 }
 return Object.freeze({
  async put(name,data,receipt){
   const m=validate(name,receipt);verify(data,m);
   // Reserve payload plus conservative per-chunk and per-archive overhead.
   const cost=m.bytes+4096*Math.ceil(m.bytes/CHUNK)+8192;
   const session=client.startSession();
   try{
    await session.withTransaction(async()=>{
     const existing=await records.findOne({_id:name},{session});
     if(existing)throw Error('VAULT_ALREADY_EXISTS');
     const result=await quota.updateOne({_id:'enterprise',used:{$gte:0,$lte:CAP-cost}},{$inc:{used:cost}},{session});
     if(result.modifiedCount!==1)throw Error('VAULT_QUOTA_OR_NOT_INITIALIZED');
     const parts=[];
     for(let i=0;i<data.length;i+=CHUNK)parts.push({_id:name+':'+(i/CHUNK),name,n:i/CHUNK,data:data.subarray(i,i+CHUNK)});
     await chunks.insertMany(parts,{session,ordered:true});
     await records.insertOne({_id:name,receipt,parts:parts.length,cost},{session});
    },{readConcern:{level:'snapshot'},writeConcern:{w:'majority'},maxCommitTimeMS:10000});
   }finally{await session.endSession();}
   return {name,status:'STORED',restoreVerified:false,independentReplica:false};
  },
  async get(name){
   if(typeof name!=='string'||!NAME.test(name))throw Error('VAULT_NAME');
   const record=await records.findOne({_id:name});
   if(!record)throw Error('VAULT_MISSING');
   const m=validate(name,record.receipt),count=Math.ceil(m.bytes/CHUNK);
   if(record.parts!==count)throw Error('VAULT_INTEGRITY');
   const parts=await chunks.find({name}).sort({n:1}).limit(count+1).toArray();
   if(parts.length!==count)throw Error('VAULT_INTEGRITY');
   const data=Buffer.concat(parts.map((p,i)=>{
    if(p.n!==i||p._id!==name+':'+i)throw Error('VAULT_INTEGRITY');
    const b=Buffer.isBuffer(p.data)?p.data:Buffer.from(p.data.value());
    if(b.length!==Math.min(CHUNK,m.bytes-i*CHUNK))throw Error('VAULT_INTEGRITY');
    return b;
   }));
   verify(data,m);return {data,receipt:record.receipt,restoreVerified:false};
  }
 });
}
module.exports={createMongoVault,CAP,CHUNK};
