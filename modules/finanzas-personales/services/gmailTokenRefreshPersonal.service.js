"use strict";
const {config}=require("./gmailOAuthExchangePersonal.service");
const Conexion=require("../models/conexionExternaPersonal.model");
const {encryptObject,decryptObject}=require("../security/fieldEncryption.service");
const SCOPE="https://www.googleapis.com/auth/gmail.readonly";
async function renovar(usuarioId,{fetchImpl=fetch}={}){
 const doc=await Conexion.findOne({usuarioId,proveedor:"GOOGLE_GMAIL",estado:"ACTIVA"}).select("+tokenCifrado.ciphertext +tokenCifrado.iv +tokenCifrado.tag +tokenCifrado.keyVersion");
 if(!doc)throw Object.assign(new Error("Gmail no conectado"),{statusCode:404});
 const previo=decryptObject(doc.tokenCifrado,{aad:"GMAIL:"+usuarioId});
 if(!previo.refresh_token)throw Object.assign(new Error("Gmail requiere nueva autorización"),{statusCode:409});
 if(doc.expiraEn.getTime()>Date.now()+120000)return previo.access_token;
 const cfg=config();
 const body=new URLSearchParams({client_id:cfg.client_id,client_secret:cfg.client_secret,refresh_token:previo.refresh_token,grant_type:"refresh_token"});
 const response=await fetchImpl("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body,signal:AbortSignal.timeout(10000),redirect:"error"});
 if(!response.ok)throw Object.assign(new Error("No fue posible renovar Gmail"),{statusCode:502});
 const result=await response.json();
 if(typeof result.access_token!=="string"||!result.access_token||!Number.isSafeInteger(result.expires_in)||result.expires_in<=0)throw Object.assign(new Error("Respuesta de renovación inválida"),{statusCode:502});
 if(result.scope&&!result.scope.split(" ").includes(SCOPE))throw Object.assign(new Error("Permisos inesperados"),{statusCode:502});
 const cifrado=encryptObject({access_token:result.access_token,refresh_token:result.refresh_token||previo.refresh_token},{aad:"GMAIL:"+usuarioId});
 const updated=await Conexion.updateOne({_id:doc._id,usuarioId,estado:"ACTIVA","tokenCifrado.ciphertext":doc.tokenCifrado.ciphertext},{$set:{tokenCifrado:cifrado,expiraEn:new Date(Date.now()+result.expires_in*1000)}});
 if(updated.modifiedCount!==1)throw Object.assign(new Error("Conexión Gmail modificada simultáneamente"),{statusCode:409});
 return result.access_token;
}
module.exports={renovar};
