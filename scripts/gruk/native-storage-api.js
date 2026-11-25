'use strict';
const http=require('node:http');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {Transform}=require('node:stream');
const {pipeline}=require('node:stream/promises');
const {createWriteStream}=require('node:fs');
const {verify}=require('./native-storage-auth');
const {store,retrieve}=require('./native-backup-storage');
function createStorageServer({root,key,maxBytes=16*1024*1024}){
 if(!Buffer.isBuffer(key)||key.length<32||!Number.isSafeInteger(maxBytes)||maxBytes<64)throw Error('INVALID_STORAGE_CONFIG');
 let busy=false;
 const server=http.createServer({requestTimeout:60000,headersTimeout:10000},async(req,res)=>{
 const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const match=/^\/v1\/backups\/(gruk-restaurante-[0-9]+-[0-9]+\.archive\.age)$/.exec(req.url);
 if(!match||!['PUT','GET'].includes(req.method))return reply(404,{error:'NOT_FOUND'});
 try{verify(key,(req.headers.authorization||'').replace(/^Bearer /,''),req.method==='PUT'?'backup:write':'backup:read');if(!/^Bearer /.test(req.headers.authorization||''))throw Error();}catch{return reply(401,{error:'UNAUTHORIZED'});}
 if(busy)return reply(503,{error:'BUSY'});
 busy=true;let tmp;let status=400,body={error:'STORAGE_REQUEST_FAILED'},binary=false;
 try{
 tmp=await fs.mkdtemp(path.join(os.tmpdir(),'gruk-storage-'));
 const file=path.join(tmp,'archive.age');
 if(req.method==='PUT'){
 const size=Number(req.headers['content-length']);
 if(!Number.isSafeInteger(size)||size<64||size>maxBytes){status=413;body={error:'SIZE_LIMIT'};}else{
 let bytes=0;
 await pipeline(req,new Transform({transform(chunk,enc,cb){bytes+=chunk.length;cb(bytes>maxBytes?Error('SIZE_LIMIT'):null,chunk);}}),createWriteStream(file,{flags:'wx',mode:0o600}));
 if(bytes!==size)throw Error('SIZE_MISMATCH');
 body=await store(root,match[1],file);status=201;
 }
 }else{
 await retrieve(root,match[1],file,req.headers['x-backup-sha256']);
 const stat=await fs.stat(file);
 if(stat.size>maxBytes)throw Error('SIZE_LIMIT');
 body=await fs.readFile(file);status=200;binary=true;
 }
 }catch(e){status=e.code==='EEXIST'?409:400;body={error:'STORAGE_REQUEST_FAILED'};binary=false;}
 finally{try{if(tmp)await fs.rm(tmp,{recursive:true,force:true});}catch{status=500;body={error:'STORAGE_CLEANUP_FAILED'};binary=false;}finally{busy=false;}}
 if(res.destroyed)return;
 if(binary){res.writeHead(status,{'Content-Type':'application/octet-stream','Content-Length':body.length,'Cache-Control':'no-store'});res.end(body);}else reply(status,body);
 });
 server.maxConnections=16;
 return server;
}
// No public listener, no integration with the main application.
function listenLocal(config,port=0){const server=createStorageServer(config);return server.listen(port,'127.0.0.1');}
module.exports={listenLocal};
