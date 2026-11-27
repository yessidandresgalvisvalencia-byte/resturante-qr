'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {publishVerifiedArchive,prepareCloudPublication}=require('../../scripts/gruk/native-storage-cloud-publication');
const name='gruk-restaurante-1-1.archive.age',data=Buffer.from('age-encryption.org/v1\n'+ 'x'.repeat(100));
const receipt={name,database:'restaurante',bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')};
const keyring={verify:r=>r};
test('cloud publication verifies retrieval and safely accepts matching retry',async()=>{
 let stored=false;
 const vault={put:async()=>{if(stored)throw Error('VAULT_ALREADY_EXISTS');stored=true;return {name,status:'STORED'};},get:async()=>({data,receipt})};
 for(let i=0;i<2;i++)assert.deepEqual(await publishVerifiedArchive({name,data,receipt,keyring,vault}),{name,status:'CLOUD_CIPHERTEXT_VERIFIED',restoreVerified:false,independentReplica:false});
});
test('cloud publication rejects mismatched source and retrieved ciphertext',async()=>{
 let puts=0;
 const vault={put:async()=>{puts++;return {name,status:'STORED'};},get:async()=>({data:Buffer.alloc(data.length),receipt})};
 await assert.rejects(publishVerifiedArchive({name,data:Buffer.alloc(data.length),receipt,keyring,vault}),/CLOUD_ARCHIVE_INTEGRITY/);
 assert.equal(puts,0);
 await assert.rejects(publishVerifiedArchive({name,data,receipt,keyring,vault}),/CLOUD_PUBLICATION_CONFLICT/);
});
test('cloud publication requires explicit opt in and cannot replace independent replication',()=>{
 assert.throws(()=>prepareCloudPublication({},()=>{}),/CLOUD_PUBLICATION_CONFIG/);
 assert.throws(()=>prepareCloudPublication({GRUK_NATIVE_CLOUD_PUBLICATION_ENABLED:'true',GRUK_NATIVE_SIGNED_REGISTRATION_ENABLED:'true',GRUK_NATIVE_REPLICATION_REQUIRED:'true'},()=>{}),/CLOUD_NOT_INDEPENDENT_REPLICA/);
});
