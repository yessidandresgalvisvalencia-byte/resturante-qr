'use strict';
const fs=require('node:fs/promises');
const {createHash,randomUUID}=require('node:crypto');
async function receiveArchive(stream,destination,{size,md5Checksum},{maxBytes=1073741824}={}){
 if(typeof size!=='string'||!/^\d{1,16}$/.test(size)||!Number.isSafeInteger(Number(size))||Number(size)<64||Number(size)>maxBytes||typeof md5Checksum!=='string'||!(/^[a-f0-9]{32}$/).test(md5Checksum))throw Error('DRIVE_DOWNLOAD_METADATA_INVALID');
 const expected=Number(size),tmp=destination+'.pending-'+randomUUID();
 let bytes=0,header=Buffer.alloc(0),owned=false;
 const hash=createHash('md5');
 try{
  const file=await fs.open(tmp,'wx',0o600);owned=true;
  try{
   for await(const value of stream){
    const chunk=Buffer.isBuffer(value)?value:Buffer.from(value);
    bytes+=chunk.length;
    if(bytes>expected)throw Error('DRIVE_DOWNLOAD_SIZE_LIMIT');
    if(header.length<22)header=Buffer.concat([header,chunk.subarray(0,22-header.length)]);
    hash.update(chunk);
    let offset=0;
    while(offset<chunk.length){
     const result=await file.write(chunk,offset,chunk.length-offset,null);
     if(result.bytesWritten<=0)throw Error('DRIVE_DOWNLOAD_WRITE_FAILED');
     offset+=result.bytesWritten;
    }
   }
   if(bytes!==expected||hash.digest('hex')!==md5Checksum||header.toString()!=='age-encryption.org/v1\n')throw Error('DRIVE_DOWNLOAD_INTEGRITY_FAILED');
   await file.sync();
  }finally{await file.close();}
  await fs.link(tmp,destination);
 }finally{if(owned)await fs.unlink(tmp);}
}
module.exports={receiveArchive};
