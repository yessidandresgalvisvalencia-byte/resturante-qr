"use strict";
function validarDeudaConversacional(x){
 const principalMinor=x.principalMinor??x.montoMinor,saldoMinor=x.saldoMinor??principalMinor,cuotaMinor=x.cuotaMinor??0;
 const invalido=()=>{throw Object.assign(new Error("Capital, saldo y abonos de la deuda requieren importes exactos y coherentes"),{statusCode:422});};
 if(!Number.isSafeInteger(principalMinor)||principalMinor<1||!Number.isSafeInteger(saldoMinor)||saldoMinor<0||
  saldoMinor>principalMinor||!Number.isSafeInteger(cuotaMinor)||cuotaMinor<0)invalido();
 if(x.abonadoMinor!==undefined&&(!Number.isSafeInteger(x.abonadoMinor)||x.abonadoMinor<0||
  BigInt(x.abonadoMinor)+BigInt(saldoMinor)!==BigInt(principalMinor)))invalido();
 const tasaConfirmada=x.tasaMensualPct!==null&&x.tasaMensualPct!==undefined;
 if(tasaConfirmada&&(typeof x.tasaMensualPct!=="number"||!Number.isFinite(x.tasaMensualPct)||x.tasaMensualPct<0||x.tasaMensualPct>100))invalido();
 return {principalMinor,saldoMinor,cuotaMinor,tasaMensualPct:tasaConfirmada?x.tasaMensualPct:0,
  tasaConfirmada,estado:saldoMinor===0?"PAGADO":"ACTIVO"};
}
function calendarioDeudaConversacional(x,ahora=new Date()){
 if(x.diaPago===undefined||x.diaPago===null)
  return {diaPago:null,periodicidad:null,periodicidadConfirmada:false,fechaVencimiento:null};
 if(!Number.isInteger(x.diaPago)||x.diaPago<1||x.diaPago>31||
  x.frecuencia!==undefined&&x.frecuencia!=="MENSUAL"||!(ahora instanceof Date)||!Number.isFinite(+ahora))
  throw Object.assign(new Error("Calendario de deuda inválido"),{statusCode:422});
 const partes=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota",
  year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(ahora).map(p=>[p.type,p.value]));
 const year=Number(partes.year),mes=Number(partes.month)-1,dia=Number(partes.day);
 const fecha=mes=>new Date(Date.UTC(year,mes,Math.min(x.diaPago,new Date(Date.UTC(year,mes+1,0)).getUTCDate()),17));
 const vencimiento=fecha(mes);
 return {diaPago:x.diaPago,periodicidad:"MENSUAL",periodicidadConfirmada:Number.isSafeInteger(x.cuotaMinor)&&x.cuotaMinor>0,
  fechaVencimiento:vencimiento.getUTCDate()<dia?fecha(mes+1):vencimiento};
}
module.exports={validarDeudaConversacional,calendarioDeudaConversacional};
