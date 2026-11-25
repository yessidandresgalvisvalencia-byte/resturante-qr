'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomBytes,createHash}=require('node:crypto');
const {once}=require('node:events');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {issue,verify}=require('../../scripts/gruk/native-storage-auth');
const {listenLocal}=require('../../scripts/gruk/native-storage-api');
test('tokens reject forgery, expiration and wrong scope',()=>{
 const key=randomBytes(32), token=issue(key,'backup:write',5,100);
 assert.equal(verify(key,token,'backup:write',104).db,'restaurante');
 assert.throws(()=>verify(key,token,'backup:write',105));
 assert.throws(()=>verify(key,token,'backup:read',104));
 assert.throws(()=>verify(randomBytes(32),token,'backup:write',104));
 assert.throws(()=>issue(key,'backup:write',301));
});
test('private API rejects unauthorized, oversized, duplicate and corrupt requests',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'gruk-api-'));
 const key=randomBytes(32),server=listenLocal({root,key,maxBytes:256});
 try{
 await once(server,'listening');
 const base='http://127.0.0.1:'+server.address().port+'/v1/backups/';
 const url=base+'gruk-restaurante-1-1.archive.age';
 const data=Buffer.from('age-encryption.org/v1\n'+'synthetic only'.repeat(6));
 const write='Bearer '+issue(key,'backup:write'),read='Bearer '+issue(key,'backup:read');
 const put=(authorization,body=data)=>fetch(url,{method:'PUT',headers:{authorization},body});
 assert.equal((await put('Bearer invalid')).status,401);
 assert.equal((await put(read)).status,401);
 assert.equal((await put(write,Buffer.alloc(257))).status,413);
 const response=await put(write);assert.equal(response.status,201);
 const receipt=await response.json();
 assert.equal(receipt.sha256,createHash('sha256').update(data).digest('hex'));
 assert.equal((await put(write)).status,409);
 assert.equal((await fetch(url,{headers:{authorization:write}})).status,401);
 const get=sha=>fetch(url,{headers:{authorization:read,'x-backup-sha256':sha}});
 assert.equal((await get('0'.repeat(64))).status,400);
 const result=await get(receipt.sha256);assert.equal(result.status,200);
 assert.deepEqual(Buffer.from(await result.arrayBuffer()),data);
 assert.equal((await fetch(base+'invalid',{headers:{authorization:read}})).status,404);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await fs.rm(root,{recursive:true,force:true});}
});
