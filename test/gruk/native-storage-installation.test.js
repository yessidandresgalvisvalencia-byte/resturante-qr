'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const dir=path.resolve(__dirname,'../../deploy/gruk-storage');
test('standby installation preserves isolation and release gates',()=>{
 const unit=fs.readFileSync(path.join(dir,'gruk-storage.service'),'utf8').split(/\r?\n/);
 const env=Object.fromEntries(fs.readFileSync(path.join(dir,'standby.env.example'),'utf8').split(/\r?\n/).filter(l=>l&&!l.startsWith('#')).map(l=>l.split('=')));
 for(const line of ['User=gruk-storage','Group=gruk-storage','NoNewPrivileges=true','ProtectSystem=strict','ProtectHome=true','PrivateDevices=true','CapabilityBoundingSet=','IPAddressDeny=any','IPAddressAllow=localhost','Environment=GRUK_NATIVE_REAL_BACKUP_ENABLED=false','ConditionPathIsMountPoint=/srv/gruk-storage/primary','ConditionPathIsMountPoint=/srv/gruk-storage/secondary','ReadWritePaths=/srv/gruk-storage/primary/vault'])assert.ok(unit.includes(line),line);
 assert.equal(unit.filter(l=>l.startsWith('ExecStart=')).length,1);
 assert.ok(unit.includes('ExecStart=/usr/bin/node /opt/gruk-storage/scripts/gruk/native-storage-runtime.js'));
 assert.ok(unit.some(l=>l.startsWith('ExecStartPre=')&&l.includes('native-storage-host-preflight.js')));
 for(const flag of ['GRUK_NATIVE_REAL_BACKUP_ENABLED','GRUK_CATALOG_ENABLED','GRUK_NATIVE_STARTUP_RECOVERY_ENABLED','GRUK_NATIVE_SIGNED_REGISTRATION_ENABLED','GRUK_NATIVE_REPLICATION_REQUIRED'])assert.equal(env[flag],'false');
 assert.equal(env.GRUK_NATIVE_BACKUP_ROOT,'/srv/gruk-storage/primary/vault');
 assert.equal(env.GRUK_NATIVE_REPLICA_ROOT,'/srv/gruk-storage/secondary/vault');
 assert.ok(!Object.keys(env).some(k=>/URI|PASSWORD|PRIVATE_KEY/.test(k)));
});
