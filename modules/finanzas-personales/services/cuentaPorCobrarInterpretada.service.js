"use strict";
const {fechaVerificable,diaCivilBogota}=require("./fechaPersonal.service");
const falla=mensaje=>Object.assign(new Error(mensaje),{statusCode:422});
const sinNombre=new Set(["alguien","nadie","persona","personas","ellos","ella","el","él","yo","tu","tú","usted","ustedes","me","mi","amigo","amiga","cliente","clientes","por","identificar","dinero","plata","pesos","mil","millones","hoy","ayer","mañana","ya","no","si","sí","y","o"]);
function nombreValido(nombre){return typeof nombre==="string"&&nombre.length<=140&&/^[\p{L}\p{M}]+(?:[-'][\p{L}\p{M}]+)*(?:\s+[\p{L}\p{M}]+(?:[-'][\p{L}\p{M}]+)*){0,3}$/u.test(nombre)&&!nombre.toLowerCase().split(/\s+/).some(w=>sinNombre.has(w));}
function importeExacto(texto){
 if(typeof texto!=="string"||texto.length>160)throw falla("Importe fuera de la capacidad verificable.");
 const s=texto.trim(),cop=/^(\$\s*)?([1-9]\d*|[1-9]\d{0,2}(?:\.\d{3})+)(?:\s*(pesos?|COP))?$/i.exec(s);
 let n;
 if(cop&&(cop[1]||cop[3]))n=BigInt(cop[2].replace(/\./g,""));
 else{
  const m=/^(un|una|0|[1-9]\d*)(?:[.,](\d{1,6}))?\s*(lucas?|mil|k|palos?|barras?|mill[oó]n|millones|m)$/i.exec(s);if(!m)throw falla("Confirma un importe COP exacto con pesos, lucas o palos; no se redondea.");
  if(m[2]?.length===3)throw falla("El separador de miles o decimal es ambiguo; confirma el importe en pesos COP.");
  const factor=/^(?:luca|mil$|k$)/i.test(m[3])?1000n:1000000n,escala=10n**BigInt((m[2]||"").length),base=/^(un|una)$/i.test(m[1])?1n:BigInt(m[1]),producto=(base*escala+BigInt(m[2]||"0"))*factor;
  if(producto%escala!==0n)throw falla("El importe no representa pesos enteros exactos.");n=producto/escala;
 }
 if(n<=0n||n>BigInt(Number.MAX_SAFE_INTEGER))throw falla("Importe fuera del rango exacto permitido.");return Number(n);
}
function interpretar(texto,{ahora=new Date()}={}){
 if(typeof texto!=="string")return null;
 const t=texto.normalize("NFC").replace(/\s+/g," ").trim();
 if(!/\b(?:me debe|me deben|me qued[oó] debiendo|me va a pagar|me van a pagar|por cobrar)\b/i.test(t))return null;
 if(t.length>5000||!(ahora instanceof Date)||!Number.isFinite(+ahora))throw falla("Texto o fecha de captura fuera de la capacidad verificable.");
 const importes=[...t.matchAll(/(?:\$\s*)?(?:\d+(?:[.,]\d+)*|un|una)\s*(?:pesos?|COP|lucas?|mil|k|palos?|barras?|mill[oó]n|millones|m)\b|\$\s*\d+(?:[.,]\d+)*/giu)];
 if(importes.length!==1)throw falla("Confirma un único importe explícito para la cuenta por cobrar.");
 const m=importes[0];if(/[-+−]\s*$/.test(t.slice(0,m.index)))throw falla("El importe debe ser positivo y explícito.");const montoMinor=importeExacto(m[0]),antes=t.slice(0,m.index).trim(),despues=t.slice(m.index+m[0].length).trim().replace(/\.$/,""),prefijo=/^(?:a\s+)?(.+?)\s+me\s+(?:debe|qued[oó]\s+debiendo)$/iu.exec(antes)||/^me\s+(?:debe|qued[oó]\s+debiendo)\s+(.+)$/iu.exec(antes),nombre=prefijo?.[1]?.trim(),valido=nombreValido(nombre);
 const item={tipo:"CUENTA_POR_COBRAR",montoMinor,concepto:"Dinero por cobrar",categoria:"Cuenta por cobrar",contraparte:valido?nombre:"Por identificar",fecha:new Date(ahora),estado:"REQUIERE_REVISION",confianza:50,razonRevision:"Confirma el nombre de una sola persona; no se identifica por aproximación."};
 if(!valido)return item;
 if(despues){
  const d=/^(?:y\s+)?me\s+paga\s+el\s+([1-9]\d{3}-\d{2}-\d{2})$/i.exec(despues),fecha=d&&fechaVerificable(d[1]);
  if(!fecha||diaCivilBogota(fecha)<diaCivilBogota(ahora))return{...item,razonRevision:"Confirma la fecha completa de cobro (AAAA-MM-DD), sin inferir mes o año."};
  item.fechaVencimiento=fecha;
 }
 return{...item,estado:"LISTO",confianza:95,razonRevision:"Cuenta pendiente por cobrar; no es dinero recibido ni disponible. Origen por confirmar."};
}
function validarParaAprobar(item){
 if(!Number.isSafeInteger(item?.montoMinor)||item.montoMinor<=0||!nombreValido(item.contraparte))throw falla("La cuenta por cobrar requiere importe exacto y nombre explícito de una persona.");
 if(item.fechaVencimiento!==undefined&&item.fechaVencimiento!==null){const f=item.fechaVencimiento;if(!(f instanceof Date)||!Number.isFinite(+f)||!(item.fecha instanceof Date)||diaCivilBogota(f)<diaCivilBogota(item.fecha))throw falla("La fecha original de cobro requiere revisión.");}
 return{contraparte:item.contraparte,origenCuentaPorCobrar:"OTRO",fechaVencimiento:item.fechaVencimiento||null};
}
module.exports={interpretar,importeExacto,nombreValido,validarParaAprobar};
