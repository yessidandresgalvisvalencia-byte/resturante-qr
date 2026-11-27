"use strict";
const {partesColombia,fechaCivilColombia}=require("./homePersonal.service")._fechas;
function fechaTentativa(dia,ahora){
 if(!Number.isSafeInteger(dia)||dia<1||dia>31||!(ahora instanceof Date)||!Number.isFinite(+ahora))throw Object.assign(Error("Día o reloj inválido"),{statusCode:400});
 const p=partesColombia(ahora);if(p.y<1000||p.y>9998)throw Object.assign(Error("Reloj fuera de rango"),{statusCode:400});
 const hoy=fechaCivilColombia(p.y,p.m,p.d);let f=fechaCivilColombia(p.y,p.m,dia);
 if(f<hoy)f=fechaCivilColombia(p.m===12?p.y+1:p.y,p.m===12?1:p.m+1,dia);
 return{fechaTentativa:f.toISOString().slice(0,10),ocurreHoy:+f===+hoy,ajustadaFinMes:f.getUTCDate()!==dia};
}
function proponer(texto,ahora=new Date()){
 if(typeof texto!=="string"||texto.length>2000)return null;const t=texto.toLowerCase().trim();
 if(!/^(?:me (?:pagan|consignan|depositan)|recibo|cobro)\b/.test(t)||! /\bcada mes\b/.test(t))return null;
 const analisis={tipo:"VISTA_PREVIA_INGRESO_MENSUAL",soloLectura:true,diaIngreso:null,montoMinor:null,fechaTentativa:null,proximoIngreso:null,programado:false,confirmado:false,aptoParaDisponibleHoy:false,requiereConfirmacionExplicita:true,datosFaltantes:[]};
 const dias=[...t.matchAll(/\bel\s+(?:d[ií]a\s+)?(\d{1,2})(?!\d)\b/g)];
 if(dias.length!==1||Number(dias[0][1])<1||Number(dias[0][1])>31){analisis.datosFaltantes.push("DIA_MENSUAL_EXPLICITO");}
 else{analisis.diaIngreso=Number(dias[0][1]);Object.assign(analisis,fechaTentativa(analisis.diaIngreso,ahora));if(analisis.ocurreHoy)analisis.datosFaltantes.push("CONFIRMAR_INGRESO_DE_HOY_O_SIGUIENTE_FECHA");}
 const montos=[...t.matchAll(/\b(?:monto(?: de)?|por)\s*\$?\s*(\d[\d.,]*)(?:\s*(mil|lucas?|palos?)\b)?/g)];
 if(montos.length===1){const m=montos[0],s=m[1].replace(/,$/,"");if(/^(?:\d{1,3}(?:\.\d{3})+|\d+)$/.test(s)&&!/[\w%]/.test(t.slice(m.index+m[0].length,m.index+m[0].length+1))){const n=BigInt(s.replace(/\./g,""))*(/^mil$|^lucas?$/.test(m[2]||"")?1000n:/^palos?$/.test(m[2]||"")?1000000n:1n);if(n>0n&&n<=BigInt(Number.MAX_SAFE_INTEGER))analisis.montoMinor=Number(n);}}
 if(analisis.montoMinor===null)analisis.datosFaltantes.push("MONTO_COP_EXPLICITO");
 return{clase:"INTENCION",requiereAprobacion:false,mensaje:"🟡 Vista previa de ingreso mensual; no quedó programado.\n"+(analisis.fechaTentativa?"Fecha tentativa colombiana: "+analisis.fechaTentativa+(analisis.ajustadaFinMes?" (ajustada al fin de mes)":"")+".":"Falta un único día mensual válido, entre 1 y 31.")+"\n"+(analisis.montoMinor===null?"Falta monto exacto declarado; no copio un ingreso anterior.":"Monto declarado: "+analisis.montoMinor.toString().replace(/\B(?=(\d{3})+(?!\d))/g,".")+" COP; no es dinero recibido.")+"\n"+(analisis.ocurreHoy?"Vence hoy: no supongo que ya entró ni lo salto al próximo mes.":"La fecha no garantiza que el ingreso llegue ni aumenta Disponible Hoy.")+"\nIndica día, monto y próxima fecha para revisar una programación con confirmación explícita.",analisis};
}
module.exports={proponer,fechaTentativa};
