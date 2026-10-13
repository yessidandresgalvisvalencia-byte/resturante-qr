"use strict";
const crypto=require("node:crypto");
const mongoose=require("mongoose");
const {encryptObject,decryptObject}=require("../security/fieldEncryption.service");
const Conexion=require("../models/conexionExternaPersonal.model");
function sellar(usuarioId,tokens){
 if(!tokens||typeof tokens.access_token!=="string"||!tokens.access_token||typeof tokens.refresh_token!=="string"||!tokens.refresh_token)throw new Error("Tokens OAuth incompletos");
 if(!Number.isSafeInteger(tokens.expires_in)||tokens.expires_in<=0)throw new Error("Vencimiento OAuth inválido");
 return encryptObject({access_token:tokens.access_token,refresh_token:tokens.refresh_token},{aad:"GMAIL:"+usuarioId});
}
async function guardarConexion(usuarioId,tokens){
 if(!mongoose.isValidObjectId(usuarioId))throw new Error("Usuario inválido");
 const encrypted=sellar(usuarioId,tokens);
 const expiraEn=new Date(Date.now()+tokens.expires_in*1000);
 return Conexion.findOneAndUpdate({usuarioId,proveedor:"GOOGLE_GMAIL"},{$set:{tokenCifrado:encrypted,scope:"https://www.googleapis.com/auth/gmail.readonly",expiraEn,estado:"ACTIVA"}},{upsert:true,new:true,runValidators:true}).select("usuarioId proveedor scope expiraEn estado");
}
async function desconectar(usuarioId){
 const registro=await Conexion.findOneAndUpdate({usuarioId,proveedor:"GOOGLE_GMAIL"},{$set:{estado:"REVOCADA"},$unset:{tokenCifrado:1}},{new:true});
 return Boolean(registro);
}
async function recuperarTokens(usuarioId){
 const doc=await Conexion.findOne({usuarioId,proveedor:"GOOGLE_GMAIL",estado:"ACTIVA"}).select("+tokenCifrado.ciphertext +tokenCifrado.iv +tokenCifrado.tag +tokenCifrado.keyVersion");
 if(!doc)return null;
 return decryptObject(doc.tokenCifrado,{aad:"GMAIL:"+usuarioId});
}
module.exports={guardarConexion,desconectar,recuperarTokens,sellar};
