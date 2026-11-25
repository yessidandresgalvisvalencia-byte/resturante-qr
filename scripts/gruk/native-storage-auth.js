'use strict';
const {createHmac,timingSafeEqual,randomBytes}=require('node:crypto');
const scopes=new Set(['backup:write','backup:read']);
function mac(key,payload){
 if(!Buffer.isBuffer(key)||key.length<32)throw Error('INVALID_SIGNING_KEY');
 return createHmac('sha256',key).update(payload).digest();
}
function issue(key,scope,ttl=300,now=Math.floor(Date.now()/1000)){
 if(!scopes.has(scope)||!Number.isInteger(ttl)||ttl<1||ttl>300)throw Error('INVALID_TOKEN_POLICY');
 const payload=Buffer.from(JSON.stringify({aud:'gruk-storage',db:'restaurante',scope,iat:now,exp:now+ttl,jti:randomBytes(16).toString('hex')})).toString('base64url');
 return payload+'.'+mac(key,payload).toString('base64url');
}
function verify(key,token,scope,now=Math.floor(Date.now()/1000)){
 try{
 if(!scopes.has(scope)||typeof token!=='string'||token.length>2048)throw Error();
 const parts=token.split('.');
 if(parts.length!==2||parts.some(p=>!/^[A-Za-z0-9_-]+$/.test(p)))throw Error();
 const [payload,sig]=parts,actual=Buffer.from(sig,'base64url'),expected=mac(key,payload);
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw Error();
 const p=JSON.parse(Buffer.from(payload,'base64url').toString());
 if(p.aud!=='gruk-storage'||p.db!=='restaurante'||p.scope!==scope||!Number.isInteger(p.iat)||!Number.isInteger(p.exp)||p.iat>now||p.exp<=now||p.exp-p.iat>300||p.exp<=p.iat)throw Error();
 return Object.freeze(p);
 }catch{throw Error('STORAGE_UNAUTHORIZED');}
}
module.exports={issue,verify};
