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
module.exports={validarDeudaConversacional};
