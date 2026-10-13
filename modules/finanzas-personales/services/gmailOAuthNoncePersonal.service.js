"use strict";
const crypto=require("node:crypto");
const Nonce=require("../models/oauthNoncePersonal.model");
const oauth=require("./gmailOAuthPersonal.service");
function hash(nonce){return crypto.createHash("sha256").update(nonce).digest("hex");}
async function iniciar(usuarioId,clientId,redirectUri){
 const url=oauth.urlAutorizacion({usuarioId,clientId,redirectUri});
 const state=new URL(url).searchParams.get("state");
 const {nonce}=oauth.verificarEstado(state);
 await Nonce.create({usuarioId,proveedor:"GOOGLE_GMAIL",nonceHash:hash(nonce),expiraEn:new Date(Date.now()+600000)});
 return url;
}
async function consumir(state){
 const {usuarioId,nonce}=oauth.verificarEstado(state);
 const result=await Nonce.findOneAndUpdate({usuarioId,proveedor:"GOOGLE_GMAIL",nonceHash:hash(nonce),consumidoEn:null,expiraEn:{$gt:new Date()}},{$set:{consumidoEn:new Date()}},{new:true});
 if(!result)throw Object.assign(new Error("Autorización expirada o utilizada"),{statusCode:409});
 return usuarioId;
}
module.exports={iniciar,consumir};
