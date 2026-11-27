'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {generateKeyPairSync,createHash}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {verifySigner}=require('./native-storage-key-readiness');
function provision({root,age=execFileSync}){
 if(typeof root!=='string'||!path.isAbsolute(root)||path.resolve(root)!==root||root===path.parse(root).root)throw Error('KEY_ROOT_INVALID');
 const parent=fs.lstatSync(path.dirname(root));
 if(!parent.isDirectory()||parent.isSymbolicLink()||parent.uid!==process.getuid()||(parent.mode&0o077)||fs.realpathSync(path.dirname(root))!==path.dirname(root))throw Error('KEY_PARENT_INSECURE');
 fs.mkdirSync(root,{mode:0o700}); // exclusive: never overwrite existing keys
 try{
  const recovery=path.join(root,'recovery.agekey');
  age('age-keygen',['-o',recovery],{stdio:['ignore','ignore','ignore'],timeout:10000});
  const stat=fs.lstatSync(recovery);
  if(!stat.isFile()||stat.nlink!==1||stat.uid!==process.getuid()||(stat.mode&0o077))throw Error();
  const recipient=String(age('age-keygen',['-y',recovery],{stdio:['ignore','pipe','ignore'],timeout:10000})).trim();
  if(!/^age1[023456789acdefghjklmnpqrstuvwxyz]{58}$/.test(recipient))throw Error();
  const {privateKey,publicKey}=generateKeyPairSync('ed25519');
  const pem=privateKey.export({type:'pkcs8',format:'pem'});
  const keyId=createHash('sha256').update(publicKey.export({type:'spki',format:'der'})).digest('hex');
  const keyring={activeKeyId:keyId,keys:[{keyId,status:'active',publicKey:publicKey.export({type:'spki',format:'pem'})}]};
  verifySigner({privateKey:pem,keyring});
  fs.writeFileSync(path.join(root,'signer.pem'),pem,{mode:0o600,flag:'wx'});
  fs.writeFileSync(path.join(root,'public.json'),JSON.stringify({recipient,keyring},null,2)+'\n',{mode:0o600,flag:'wx'});
  return {status:'KEY_FILES_CREATED',independentCustodyVerified:false,realBackupEnabled:false};
 }catch{fs.rmSync(root,{recursive:true,force:true});throw Error('KEY_PROVISION_FAILED');}
}
if(require.main===module){
 try{if(process.argv.length!==3)throw Error();console.log(JSON.stringify(provision({root:process.argv[2]})));}catch{console.error('GRUK_KEY_PROVISION_FAILED');process.exitCode=1;}
}
module.exports={provision};
