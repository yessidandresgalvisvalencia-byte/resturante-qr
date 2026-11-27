'use strict';
const assert=require('node:assert/strict');
const {createHash,generateKeyPairSync}=require('node:crypto');
const fs=require('node:fs/promises');
const {createKeyring}=require('./drive-manifest-keyring');
const {publishVerifiedArchive}=require('./native-storage-cloud-publication');
const {createMongoVault,CHUNK,CAP}=require('./native-storage-mongo-vault');
async function main(){
 const data=await fs.readFile(process.argv[2]);
 const drill=process.argv[4]==='restore-drill';
 assert.ok(drill?data.length>=64&&data.length<CAP:data.length>CHUNK&&data.length<2*CHUNK);
 const c=require('mongoose').createConnection('mongodb://127.0.0.1:27189/gruk_storage_vault?replicaSet=grukci&directConnection=true',{serverSelectionTimeoutMS:15000});
 try{
  await c.asPromise();
  const db=c.db,client=c.getClient();
  const hello=await db.admin().command({hello:1});
  assert.equal(hello.setName,'grukci');assert.equal(hello.isWritablePrimary,true);
  for(const n of ['archives','archive_chunks','vault_quota'])await db.createCollection(n);
  const quota=db.collection('vault_quota');
  await quota.insertOne({_id:'enterprise',used:0});
  const {privateKey,publicKey}=generateKeyPairSync('ed25519');
  const keyId=createHash('sha256').update(publicKey.export({type:'spki',format:'der'})).digest('hex');
  const keyring=createKeyring({activeKeyId:keyId,keys:[{keyId,status:'active',publicKey:publicKey.export({type:'spki',format:'pem'})}]});
  const vault=createMongoVault({db,client,keyring});
  const name='gruk-restaurante-1-1.archive.age';
  const sign=n=>keyring.sign({version:1,database:'restaurante',name:n,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')},privateKey);
  const receipt=sign(name);
  const result=await publishVerifiedArchive({name,data,receipt,keyring,vault});
  assert.equal(result.status,'CLOUD_CIPHERTEXT_VERIFIED');
  assert.equal(result.independentReplica,false);
  const saved=await vault.get(name);
  assert.deepEqual(saved.data,data);
  await fs.writeFile(process.argv[3],saved.data,{flag:'wx',mode:0o600});
  if(drill){console.log('GRUK_SYNTHETIC_CLOUD_PUBLICATION_OK');return;}
  const used=(await quota.findOne({_id:'enterprise'})).used;
  assert.ok(used>data.length);
  await assert.rejects(vault.put(name,data,receipt),/VAULT_ALREADY_EXISTS/);
  assert.equal((await quota.findOne({_id:'enterprise'})).used,used);
  const next='gruk-restaurante-2-1.archive.age';
  // Seed a synthetic conflicting chunk to force a transaction rollback.
  await db.collection('archive_chunks').insertOne({_id:next+':0',name:next,n:0,data:Buffer.alloc(1)});
  await assert.rejects(vault.put(next,data,sign(next)),e=>e.code===11000);
  assert.equal((await quota.findOne({_id:'enterprise'})).used,used);
  assert.equal(await db.collection('archives').countDocuments({_id:next}),0);
  await quota.updateOne({_id:'enterprise'},{$set:{used:CAP}});
  const third='gruk-restaurante-3-1.archive.age';
  await assert.rejects(vault.put(third,data,sign(third)),/VAULT_QUOTA_OR_NOT_INITIALIZED/);
  assert.equal(await db.collection('archive_chunks').countDocuments({name:third}),0);
  await db.collection('archive_chunks').updateOne({_id:name+':0'},{$set:{data:Buffer.alloc(CHUNK)}});
  await assert.rejects(vault.get(name),/VAULT_INTEGRITY/);
  console.log('GRUK_MONGO_VAULT_TRANSACTION_INTEGRITY_OK');
 }finally{await c.close();}
}
main().catch(e=>{console.error('GRUK_MONGO_VAULT_SYNTHETIC_FAILED',e.code||e.message);process.exitCode=1;});
