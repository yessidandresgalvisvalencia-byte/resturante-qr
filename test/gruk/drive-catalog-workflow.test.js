'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
test('manual cloud drill gates catalog before source access, registers before upload and verifies before restore',()=>{
 const shell=fs.readFileSync(path.join(root,'scripts/gruk/p0-04-google-drive-backup-restore.sh'),'utf8');
 const points=['Independent catalog not authorized','validateCatalogConnection','mongosh "$GRUK_ENTERPRISE_BACKUP_URI"','drive-catalog-runtime.js register','encrypted-object.js upload','encrypted-object.js download','drive-catalog-runtime.js verify','docker run -d','GRUK_DRIVE_BACKUP_REAL_RESTORE_OK'];
 let previous=-1;
 for(const point of points){const index=shell.indexOf(point);assert.ok(index>previous,point);previous=index;}
 const yaml=fs.readFileSync(path.join(root,'.github/workflows/gruk-p004-google-drive-encrypted-backup.yml'),'utf8');
 assert.match(yaml,/if: github\.event_name == 'workflow_dispatch'/);
 assert.match(yaml,/GRUK_CATALOG_MONGO_URI: \$\{\{ secrets\.GRUK_CATALOG_MONGO_URI \}\}/);
 assert.match(yaml,/GRUK_CATALOG_ENABLED: \$\{\{ vars\.GRUK_CATALOG_ENABLED \}\}/);
 assert.match(yaml,/npm ci --ignore-scripts/);
 assert.doesNotMatch(yaml,/\bschedule:/);
});
