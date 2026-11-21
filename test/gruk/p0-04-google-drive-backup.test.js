'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const script=fs.readFileSync(path.resolve(__dirname,'../../scripts/gruk/p0-04-google-drive-backup-restore.sh'),'utf8');
const api=fs.readFileSync(path.resolve(__dirname,'../../scripts/gruk/p0-04-google-drive-encrypted-object.js'),'utf8');
const yaml=fs.readFileSync(path.resolve(__dirname,'../../.github/workflows/gruk-p004-google-drive-encrypted-backup.yml'),'utf8');

test('hard scoped to restaurante and existing exact private Drive folder',()=>{
  assert.match(script,/GRUK_ENTERPRISE_DB" == "restaurante"/);
  assert.match(script,/GRUK_ENTERPRISE_DB_CONFIRM" == "restaurante"/);
  assert.match(script,/mongodump --uri=.*--db=restaurante/);
  assert.match(api,/1_1OxE9Ey7kr-GoCjOnC_Elm_sJpTQrfN/);
  assert.doesNotMatch(script,/gruk_finanzas_personales|blushea/i);
});
test('backup encrypts before upload and restores from downloaded ciphertext',()=>{
  assert.match(script,/mongodump[^\n]+\|\s*\n\s*age -r/);
  assert.match(script,/encrypted-object\.js upload "\$tmp\/archive\.age"/);
  assert.match(script,/encrypted-object\.js download "\$drive_id"/);
  assert.match(script,/sha256sum "\$tmp\/downloaded\.age"/);
  assert.match(script,/age -d -i "\$tmp\/identity" "\$tmp\/downloaded\.age" \|/);
});
test('writes restored records only into offline Docker Mongo, never Atlas',()=>{
  assert.match(script,/--network none mongo:7\.0/);
  assert.match(script,/docker exec -i "\$container" mongorestore/);
  assert.match(script,/--nsFrom='restaurante\.\*' --nsTo='restaurante_restore_drill\.\*'/);
  assert.doesNotMatch(script,/mongorestore --uri=/);
});
test('Drive uploader restricts to age ciphertext, exact folder and opaque ID',()=>{
  assert.match(api,/ONLY_CIPHERTEXT_ALLOWED/);
  assert.match(api,/DRIVE_FOLDER_MISMATCH/);
  assert.match(api,/mimeType:'application\/octet-stream'/);
  assert.match(api,/grant_type:'refresh_token'/);
  assert.match(api,/https:\/\/oauth2\.googleapis\.com\/token/);
  assert.match(api,/uploadType=resumable/);
  assert.match(api,/alt=media/);
  assert.doesNotMatch(api,/console\.log\(.*access_token/);
});
test('workflow defaults to safe contract testing and manual authorization for real data',()=>{
  assert.match(yaml,/workflow_dispatch:/);
  assert.match(yaml,/if: github\.event_name == 'workflow_dispatch'/);
  assert.match(yaml,/environment: gruk-enterprise-real-backup/);
  assert.match(yaml,/GRUK_ENTERPRISE_READONLY_MONGO_URI/);
  assert.doesNotMatch(yaml,/upload-artifact/);
  assert.doesNotMatch(yaml,/\bschedule:/);
});
test('Drive transport refuses invalid folder before making a request',()=>{
  const result=spawnSync(process.execPath,[path.resolve(__dirname,'../../scripts/gruk/p0-04-google-drive-encrypted-object.js'),'upload','/tmp/nonexistent.age','gruk-restaurante-1-1.archive.age'],{
    env:{...process.env,GRUK_DRIVE_BACKUP_FOLDER_ID:'wrong-folder'},
    encoding:'utf8'
  });
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/DRIVE_FOLDER_MISMATCH/);
});
