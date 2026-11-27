'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {constants}=require('node:fs');
const {createHash}=require('node:crypto');
const {createKeyring}=require('./drive-manifest-keyring');
const {readNativeReceipt}=require('./native-storage-receipt-recovery');
const {validateVaultUri}=require('./native-storage-mongo-vault-connection');
const {createMongoVault,CAP}=require('./native-storage-mongo-vault');
async function publishVerifiedArchive({name,data,receipt,keyring,vault}){
 const m=keyring.verify(receipt,name);
 if(!Buffer.isBuffer(data)||m.database!=='restaurante'||m.name!==name||m.bytes!==data.length||data.length>CAP||createHash('sha256').update(data).digest('hex')!==m.sha256)throw Error('CLOUD_ARCHIVE_INTEGRITY');
 try{
  const stored=await vault.put(name,data,receipt);
  if(stored?.status!=='STORED'||stored.name!==name)throw Error('CLOUD_PUBLICATION_UNVERIFIED');
 }catch(e){if(e?.message!=='VAULT_ALREADY_EXISTS')throw e;}
 const retrieved=await vault.get(name);
 const remote=keyring.verify(retrieved.receipt,name);
 if(remote.sha256!==m.sha256||remote.bytes!==m.bytes||!Buffer.isBuffer(retrieved.data)||!retrieved.data.equals(data))throw Error('CLOUD_PUBLICATION_CONFLICT');
 return {name,status:'CLOUD_CIPHERTEXT_VERIFIED',restoreVerified:false,independentReplica:false};
}
function prepareCloudPublication(env,connect){
 if(env.GRUK_NATIVE_CLOUD_PUBLICATION_ENABLED!=='true'||env.GRUK_NATIVE_SIGNED_REGISTRATION_ENABLED!=='true'||typeof connect!=='function')throw Error('CLOUD_PUBLICATION_CONFIG');
 if(env.GRUK_NATIVE_REPLICATION_REQUIRED==='true')throw Error('CLOUD_NOT_INDEPENDENT_REPLICA');
 validateVaultUri(env.GRUK_VAULT_MONGO_URI,env.GRUK_VAULT_EXPECTED_HOST);
 const raw=env.GRUK_MANIFEST_TRUSTED_KEYRING;
 if(typeof raw!=='string'||raw.length>70000)throw Error('CLOUD_PUBLICATION_CONFIG');
 const keyring=createKeyring(JSON.parse(raw));
 return async name=>{
  const root=env.GRUK_NATIVE_BACKUP_ROOT;
  const {receipt,manifest}=await readNativeReceipt({root,name,keyring});
  if(manifest.bytes>CAP)throw Error('CLOUD_ARCHIVE_CAP');
  const h=await fs.open(path.join(root,name),constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  let data;
  try{
   const st=await h.stat();
   if(!st.isFile()||st.uid!==process.getuid()||(st.mode&0o077)||st.nlink!==1||st.size!==manifest.bytes)throw Error('CLOUD_ARCHIVE_INTEGRITY');
   data=Buffer.alloc(manifest.bytes);
   let offset=0;
   while(offset<data.length){const {bytesRead}=await h.read(data,offset,data.length-offset,offset);if(!bytesRead)throw Error('CLOUD_ARCHIVE_INTEGRITY');offset+=bytesRead;}
   if((await h.stat()).size!==data.length)throw Error('CLOUD_ARCHIVE_INTEGRITY');
  }finally{await h.close();}
  const c=await connect(env.GRUK_VAULT_MONGO_URI,{dbName:'gruk_storage_vault',tls:true,serverSelectionTimeoutMS:10000,maxPoolSize:1});
  try{return await publishVerifiedArchive({name,data,receipt,keyring,vault:createMongoVault({db:c.db,client:c.getClient(),keyring})});}finally{await c.close();}
 };
}
module.exports={publishVerifiedArchive,prepareCloudPublication};
