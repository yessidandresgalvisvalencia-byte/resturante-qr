"use strict";
const DIA=86400000;
function calendarioObligacion(deuda,corte=new Date(),horizonteDias=90){
 if(!deuda||!deuda.periodicidadConfirmada||!["UNICA","SEMANAL","QUINCENAL","MENSUAL"].includes(deuda.periodicidad))return[];
 if(!Number.isSafeInteger(deuda.saldoMinor)||deuda.saldoMinor<=0||!Number.isSafeInteger(deuda.cuotaMinor)||deuda.cuotaMinor<=0)return[];
 const hoy=new Date(corte),inicio=new Date(deuda.fechaVencimiento);
 if(!Number.isFinite(hoy.getTime())||!Number.isFinite(inicio.getTime())||!Number.isInteger(horizonteDias)||horizonteDias<1||horizonteDias>366)throw new TypeError("Calendario inválido");
 const limite=new Date(hoy.getTime()+horizonteDias*DIA),eventos=[];
 const fechaMensual=(y,m)=>{const ultimo=new Date(Date.UTC(y,m+1,0)).getUTCDate();return new Date(Date.UTC(y,m,Math.min(deuda.diaPago||inicio.getUTCDate(),ultimo),inicio.getUTCHours(),inicio.getUTCMinutes()));};
 let restante=deuda.saldoMinor;
 if(deuda.periodicidad==="UNICA"){if(inicio>hoy&&inicio<=limite)return[{fecha:inicio,montoMinor:Math.min(restante,deuda.cuotaMinor),concepto:deuda.concepto}];return[];}
 let fecha=new Date(inicio);
 for(let i=0;i<370&&fecha<=limite&&restante>0;i++){
  if(fecha>hoy){const montoMinor=Math.min(deuda.cuotaMinor,restante);eventos.push({fecha:new Date(fecha),montoMinor,concepto:deuda.concepto,sourceId:String(deuda._id||"")});restante-=montoMinor;}
  if(deuda.periodicidad==="MENSUAL"){const y=fecha.getUTCFullYear(),m=fecha.getUTCMonth()+1;fecha=fechaMensual(y,m);}
  else fecha=new Date(fecha.getTime()+(deuda.periodicidad==="SEMANAL"?7:15)*DIA);
 }
 return eventos;
}
module.exports={calendarioObligacion};