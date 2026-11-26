'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const backup = fs.readFileSync(path.join(__dirname,'../../scripts/gruk/p0-04-real-offsite-backup-restore.sh'),'utf8');
const workflow = fs.readFileSync(path.join(__dirname,'../../.github/workflows/gruk-p004-real-offsite-backup.yml'),'utf8');
test('backup is pinned to the only enterprise database and explicitly confirmed',()=>{
  assert.match(backup,/GRUK_ENTERPRISE_DB" == "restaurante"/);
  assert.match(backup,/GRUK_ENTERPRISE_DB_CONFIRM" == "restaurante"/);
  assert.match(backup,/--db=restaurante\b/);
  assert.match(backup,/RESPALDAR_SOLO_RESTAURANTE/);
  assert.doesNotMatch(backup,/gruk_finanzas_personales|blushea/i);
});
test('encrypt before publishing and fetch the offsite object back',()=>{
  assert.match(backup,/mongodump[\s\S]*\|\s*age -r/);
  assert.match(backup,/aws s3api put-object[\s\S]*--if-none-match/);
  assert.match(backup,/aws s3api get-object/);
  assert.match(backup,/sha256sum/);
  assert.match(backup,/get-bucket-versioning/);
});
test('restore happens only inside a network-isolated MongoDB container',()=>{
  assert.match(backup,/docker run -d --name "\$container" --network none mongo:7\.0/);
  assert.match(backup,/docker exec -i "\$container" mongorestore/);
  assert.match(backup,/--nsFrom='restaurante\.\*' --nsTo='restaurante_restore_drill\.\*'/);
  for (const line of backup.split('\n').filter(x=>x.includes('docker exec -i') && x.includes('mongorestore'))) { assert.doesNotMatch(line,/--uri=/); }
  assert.doesNotMatch(backup,/\b(deleteOne|deleteMany|updateMany|dropDatabase)\b/);
});
test('external workflow is synthetic only and direct execution is retired',()=>{
 const workflowText=workflow;
 assert.doesNotMatch(workflowText,/workflow_dispatch:|secrets\.|environment: gruk-enterprise-real-backup|upload-artifact|\bschedule:/);
 const result=require('node:child_process').spawnSync('bash',[path.resolve(__dirname,'../../scripts/gruk/p0-04-real-offsite-backup-restore.sh')],{env:{PATH:'/usr/bin:/bin',GRUK_BACKUP_APPROVAL:'RESPALDAR_SOLO_RESTAURANTE'},encoding:'utf8'});
 assert.equal(result.status,1);
 assert.equal(result.stderr.trim(),'GRUK_EXTERNAL_BACKUP_RETIRED');
});
