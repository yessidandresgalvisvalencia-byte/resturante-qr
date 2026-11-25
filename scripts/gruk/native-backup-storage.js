'use strict';
// Local persistent-volume adapter. Never use an ephemeral deployment filesystem.
const fs = require('node:fs/promises');
const {constants} = require('node:fs');
const path = require('node:path');
const {pipeline} = require('node:stream/promises');
const {createHash,randomUUID} = require('node:crypto');
const {createReadStream,createWriteStream} = require('node:fs');
const valid = /^gruk-restaurante-[0-9]+-[0-9]+\.archive\.age$/;
async function digest(file) {
  const h=createHash('sha256');
  for await(const chunk of createReadStream(file)) h.update(chunk);
  return h.digest('hex');
}
async function rootDir(root) {
  if(!root || !path.isAbsolute(root) || root===path.parse(root).root) throw Error('PRIVATE_VOLUME_REQUIRED');
  const real=await fs.realpath(root);
  if(real!==path.resolve(root)) throw Error('SYMLINK_VOLUME_REJECTED');
  const s=await fs.stat(real);
  if(!s.isDirectory() || (s.mode & 0o077)!==0) throw Error('PRIVATE_VOLUME_PERMISSIONS');
  return real;
}
function nameCheck(name){if(typeof name!=='string'||!valid.test(name)) throw Error('INVALID_BACKUP_NAME');}
async function store(root,name,source){
  nameCheck(name); root=await rootDir(root);
  const dest=path.join(root,name), tmp=path.join(root,'.pending-'+randomUUID());
  const handle=await fs.open(source,constants.O_RDONLY|constants.O_NOFOLLOW);
  try {
    const s=await handle.stat();
    const header=Buffer.alloc(22);
    await handle.read(header,0,22,0);
    if(!s.isFile()||s.size<64||header.toString()!=='age-encryption.org/v1\n') throw Error('AGE_ARCHIVE_REQUIRED');
    await pipeline(handle.createReadStream({start:0,autoClose:false}),createWriteStream(tmp,{flags:'wx',mode:0o600}));
    const output=await fs.open(tmp,'r+'); try{await output.sync();}finally{await output.close();}
    const sha256=await digest(tmp);
    await fs.link(tmp,dest); // atomic publish, refuses overwrite
    const dir=await fs.open(root,'r');try{await dir.sync();}finally{await dir.close();}
    return {name,sha256,bytes:s.size};
  } finally {await handle.close();await fs.unlink(tmp).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
async function retrieve(root,name,destination,expected){
  nameCheck(name);root=await rootDir(root);
  if(!/^[a-f0-9]{64}$/.test(expected)) throw Error('EXPECTED_DIGEST_REQUIRED');
  const handle=await fs.open(path.join(root,name),constants.O_RDONLY|constants.O_NOFOLLOW);
  const tmp=destination+'.pending-'+randomUUID();
  try{
    if(!(await handle.stat()).isFile())throw Error('INVALID_ARCHIVE');
    await pipeline(handle.createReadStream({autoClose:false}),createWriteStream(tmp,{flags:'wx',mode:0o600}));
    if(await digest(tmp)!==expected)throw Error('BACKUP_INTEGRITY_MISMATCH');
    await fs.link(tmp,destination);
  }finally{await handle.close();await fs.unlink(tmp).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
module.exports={store,retrieve};
