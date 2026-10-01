"use strict";
const crypto=require("crypto");
const ALGO="aes-256-gcm";
function key(){const raw=process.env.PERSONAL_DATA_KEY;if(!raw)throw new Error("PERSONAL_DATA_KEY requerido");const b=Buffer.from(raw,"base64");if(b.length!==32)throw new Error("PERSONAL_DATA_KEY debe ser base64 de 32 bytes");return b;}
function encryptObject(value,{aad=""}={}){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv(ALGO,key(),iv,{authTagLength:16});if(aad)cipher.setAAD(Buffer.from(aad));const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),"utf8"),cipher.final()]);return{ciphertext:encrypted.toString("base64"),iv:iv.toString("base64"),tag:cipher.getAuthTag().toString("base64"),keyVersion:Number(process.env.PERSONAL_DATA_KEY_VERSION||1)};}
function decryptObject(bundle,{aad=""}={}){const decipher=crypto.createDecipheriv(ALGO,key(),Buffer.from(bundle.iv,"base64"),{authTagLength:16});if(aad)decipher.setAAD(Buffer.from(aad));decipher.setAuthTag(Buffer.from(bundle.tag,"base64"));return JSON.parse(Buffer.concat([decipher.update(Buffer.from(bundle.ciphertext,"base64")),decipher.final()]).toString("utf8"));}
module.exports={encryptObject,decryptObject};