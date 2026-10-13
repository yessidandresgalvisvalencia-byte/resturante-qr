"use strict";
const {createHash}=require("node:crypto");
const BANCOS=[/bancolombia/i,/nequi/i];
function normalizarCOP(texto){
 if(typeof texto!=="string")return null;
 const limpio=texto.replace(/\s/g,"");
 if(!/^\d{1,3}(?:\.\d{3})*(?:,00)?$|^\d+(?:,00)?$/.test(limpio))return null;
 const numero=Number(limpio.replace(/\./g,"").replace(/,00$/,""));
 return Number.isSafeInteger(numero)&&numero>0?numero:null;
}
function interpretarAviso({messageId,from,subject,text,date,cuentaFuente}){
 if(![messageId,from,subject,text,cuentaFuente].every(x=>typeof x==="string"&&x.length>0))return{aceptado:false,motivo:"DATOS_INSUFICIENTES"};
 if(!BANCOS.some(x=>x.test(from)))return{aceptado:false,motivo:"REMITENTE_NO_RECONOCIDO"};
 const cuerpo=(subject+"\n"+text).slice(0,10000);
 const recibido=/\b(recibiste|recibido|abonaron|abono|consignacion|consignación)\b/i.test(cuerpo);
 const enviado=/\b(enviaste|enviado|pagaste|pago realizado|transferencia realizada)\b/i.test(cuerpo);
 if(recibido===enviado)return{aceptado:false,motivo:"DIRECCION_AMBIGUA"};
 const coincidencias=[...cuerpo.matchAll(/\$\s*([\d.,]+)/g)].map(x=>normalizarCOP(x[1])).filter(x=>x!==null);
 if(coincidencias.length!==1)return{aceptado:false,motivo:"MONTO_AMBIGUO"};
 const fecha=new Date(date);if(Number.isNaN(fecha.getTime()))return{aceptado:false,motivo:"FECHA_INVALIDA"};
 return{aceptado:true,movimiento:{fuente:"GMAIL",cuentaFuente,referenciaExterna:"gmail:"+createHash("sha256").update(messageId).digest("hex"),fechaMovimiento:fecha.toISOString(),montoMinor:coincidencias[0],direccion:recibido?"ENTRADA":"SALIDA",moneda:"COP",evidencia:"NOTIFICACION",descripcion:subject.slice(0,500)}};
}
module.exports={interpretarAviso,normalizarCOP};
