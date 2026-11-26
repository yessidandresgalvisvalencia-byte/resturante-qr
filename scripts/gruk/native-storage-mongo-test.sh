#!/usr/bin/env bash
set -euo pipefail
umask 077
tmp=$(mktemp -d)
src=gruk-test-src-$$
dst=gruk-test-dst-$$
trap 'docker rm -f "$src" "$dst" >/dev/null 2>&1 || true; rm -rf "$tmp"' EXIT
export GRUK_NATIVE_BACKUP_ROOT="$tmp/vault"
mkdir -m 700 "$GRUK_NATIVE_BACKUP_ROOT" "$tmp/replica" "$tmp/recovery"
for c in "$src" "$dst"; do
 docker run -d --name "$c" --network none mongo:7.0 >/dev/null
 ready=0
 for i in {1..60}; do
  if docker exec "$c" mongosh --quiet --eval 'db.adminCommand({ping:1}).ok' 2>/dev/null | grep -qx 1; then ready=1; break; fi
  sleep 1
 done
 [[ "$ready" == 1 ]]
done
docker exec "$src" mongosh --quiet --eval 'const d=db.getSiblingDB("restaurante"); d.ventas.createIndex({folio:1},{unique:true}); d.ventas.insertOne({_id:1,folio:1,total:NumberDecimal("123.45")}); d.stock.insertOne({_id:1,qty:7});'
age-keygen -o "$tmp/key" 2>/dev/null
docker exec "$src" mongodump --db restaurante --archive --gzip --quiet | age -r "$(age-keygen -y "$tmp/key")" -o "$tmp/input.age"
name=gruk-restaurante-3-1.archive.age
node scripts/gruk/native-backup-cli.js store "$name" "$tmp/input.age"
node - "$tmp" "$name" <<'NODE'
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const {generateKeyPairSync}=require('node:crypto');
const {createManifest}=require('./scripts/gruk/drive-backup-manifest');
const {signManifest,verifySignedManifest}=require('./scripts/gruk/drive-manifest-signature');
const {persistReceipt}=require('./scripts/gruk/native-storage-receipt-recovery');
const {replicateArchive}=require('./scripts/gruk/native-storage-replication');
const {stageRecovery}=require('./scripts/gruk/native-storage-failover');
(async()=>{
 const [tmp,name]=process.argv.slice(2);
 const primaryRoot=path.join(tmp,'vault'),replicaRoot=path.join(tmp,'replica'),recoveryRoot=path.join(tmp,'recovery');
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');
 const keyring={verify:(receipt,n)=>verifySignedManifest(receipt,publicKey,n)};
 const manifest=await createManifest(path.join(primaryRoot,name),name);
 const receipt=signManifest(manifest,privateKey);
 await persistReceipt({root:primaryRoot,name,keyring,receipt});
 const catalog={lookup:async n=>{assert.equal(n,name);return keyring.verify(receipt,n);}};
 // Synthetic directories share a device; no physical redundancy claim.
 const copy=await replicateArchive({sourceRoot:primaryRoot,targetRoot:replicaRoot,name,keyring,catalog,requireDistinctDevice:false});
 assert.equal(copy.receiptVerified,true);
 await fs.writeFile(path.join(primaryRoot,name),'synthetic damaged original');
 const staged=await stageRecovery({primaryRoot,replicaRoot,recoveryRoot,name,keyring,catalog});
 assert.deepEqual(staged,{status:'STAGED',source:'replica',receiptVerified:true,restoreVerified:false});
 assert.equal(await fs.readFile(path.join(primaryRoot,name),'utf8'),'synthetic damaged original');
})().catch(()=>{console.error('GRUK_SYNTHETIC_FAILOVER_FAILED');process.exitCode=1;});
NODE
GRUK_NATIVE_BACKUP_ROOT="$tmp/recovery" node scripts/gruk/native-backup-cli.js retrieve "$name" "$tmp/output.age" "$(sha256sum "$tmp/input.age" | cut -d ' ' -f1)"
age -d -i "$tmp/key" "$tmp/output.age" | docker exec -i "$dst" mongorestore --archive --gzip --nsFrom='restaurante.*' --nsTo='restaurante_restore_drill.*' --stopOnError
summary='const d=db.getSiblingDB(process.env.DB_NAME); print(EJSON.stringify(d.getCollectionNames().sort().map(n=>({name:n,docs:d.getCollection(n).find().sort({_id:1}).toArray(),indexes:d.getCollection(n).getIndexes().map(i=>({name:i.name,key:i.key,unique:i.unique===true})).sort((a,b)=>a.name.localeCompare(b.name))})),{relaxed:false}));'
docker exec -e DB_NAME=restaurante "$src" mongosh --quiet --eval "$summary" > "$tmp/source"
docker exec -e DB_NAME=restaurante_restore_drill "$dst" mongosh --quiet --eval "$summary" > "$tmp/target"
test -s "$tmp/source"
cmp "$tmp/source" "$tmp/target"
echo GRUK_SYNTHETIC_MONGO_RESTORE_OK
echo GRUK_SYNTHETIC_SIGNED_REPLICA_RESTORE_OK
