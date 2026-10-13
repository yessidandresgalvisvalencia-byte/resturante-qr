"use strict";
const {renovar}=require("./gmailTokenRefreshPersonal.service");
const {interpretarAviso}=require("./gmailAvisoPersonal.parser");
const {registrarMovimiento}=require("./financialIngestion.service");
const Conexion=require("../models/conexionExternaPersonal.model");
function decode(value){
 if(typeof value!=="string"||value.length>120000)return"";
 try{return Buffer.from(value.replace(/-/g,"+").replace(/_/g,"/"),"base64").toString("utf8");}catch(_){return"";}
}
function headersMap(headers){const out={};for(const h of headers||[])if(typeof h.name==="string"&&typeof h.value==="string")out[h.name.toLowerCase()]=h.value;return out;}
async function gmailGet(path,token,fetchImpl){
 const res=await fetchImpl("https://gmail.googleapis.com/gmail/v1/users/me/"+path,{headers:{authorization:"Bearer "+token},signal:AbortSignal.timeout(10000),redirect:"error"});
 if(!res.ok)throw Object.assign(new Error("Gmail API no disponible"),{statusCode:502});
 return res.json();
}
async function sincronizar(usuarioId,{fetchImpl=fetch,limite=25}={}){
 if(!Number.isInteger(limite)||limite<1||limite>100)throw new Error("Límite inválido");
 const token=await renovar(usuarioId,{fetchImpl});
 const lista=await gmailGet("messages?"+new URLSearchParams({q:"newer_than:30d {from:(bancolombia.com) from:(nequi.com.co)}",maxResults:String(limite)}),token,fetchImpl);
 const resultados={revisados:0,detectados:0,duplicados:0,omitidos:0};
 for(const item of lista.messages||[]){
  if(typeof item.id!=="string"||!/^[a-zA-Z0-9_-]{1,128}$/.test(item.id))continue;
  const msg=await gmailGet("messages/"+encodeURIComponent(item.id)+"?format=full",token,fetchImpl);
  const headers=headersMap(msg.payload&&msg.payload.headers);
  const parts=[msg.payload?.body?.data,...(msg.payload?.parts||[]).filter(p=>p.mimeType==="text/plain").map(p=>p.body?.data)];
  const texto=parts.map(decode).join("\n").slice(0,10000);
  const resultado=interpretarAviso({messageId:item.id,from:headers.from||"",subject:headers.subject||"",text:texto,date:headers.date||new Date(Number(msg.internalDate||0)).toISOString(),cuentaFuente:"GMAIL_NOTIFICACIONES"});
  resultados.revisados++;
  if(!resultado.aceptado){resultados.omitidos++;continue;}
  const registrado=await registrarMovimiento(usuarioId,resultado.movimiento);
  if(registrado.duplicado)resultados.duplicados++;else resultados.detectados++;
 }
 await Conexion.updateOne({usuarioId,proveedor:"GOOGLE_GMAIL",estado:"ACTIVA"},{$set:{ultimaSincronizacion:new Date()}});
 return resultados;
}
module.exports={sincronizar,decode,headersMap};
