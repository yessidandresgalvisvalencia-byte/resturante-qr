'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {createMongoVault}=require('../../scripts/gruk/native-storage-mongo-vault');
test('vault rejects wrong database and corrupt ciphertext before transaction',async()=>{
 const name='gruk-restaurante-1-1.archive.age',data=Buffer.from('age-encryption.org/v1\n'+'x'.repeat(100));
 const manifest={name,database:'restaurante',version:1,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')};
 const client={startSession(){assert.fail('unexpected transaction');}},keyring={verify:()=>manifest};
 assert.throws(()=>createMongoVault({db:{databaseName:'restaurante'},client,keyring}),/VAULT_SCOPE/);
 const vault=createMongoVault({db:{databaseName:'gruk_storage_vault',collection(){return {}; }},client,keyring});
 await assert.rejects(vault.put(name,Buffer.alloc(data.length),{}),/VAULT_INTEGRITY/);
 await assert.rejects(vault.put('other',data,{}),/VAULT_NAME/);
});
