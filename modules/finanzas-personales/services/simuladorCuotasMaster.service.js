"use strict";
function simularCuotas({precio,numeroCuotas,tasaPct,metodo="SOBRE_CUOTA_BASE"}){
 if(!Number.isSafeInteger(precio)||precio<=0||precio>Number.MAX_SAFE_INTEGER/100)throw new RangeError("Precio inválido");
 if(!Number.isInteger(numeroCuotas)||numeroCuotas<1||numeroCuotas>360)throw new RangeError("Cantidad de cuotas inválida");
 if(typeof tasaPct!=="number"||!Number.isFinite(tasaPct)||tasaPct<0||tasaPct>100)throw new RangeError("Tasa inválida");
 if(!["SOBRE_CUOTA_BASE","SALDO_DECRECIENTE"].includes(metodo))throw new RangeError("Método de intereses no soportado");
 const capitalCentavos=precio*100;
 const r=tasaPct/100;
 let cuotasCentavos=[],interesesCentavos=0,saldo=capitalCentavos;
 if(metodo==="SOBRE_CUOTA_BASE"){
  const totalInteres=Math.round(capitalCentavos*r);
  const total=capitalCentavos+totalInteres;
  const base=Math.floor(total/numeroCuotas);
  cuotasCentavos=Array(numeroCuotas).fill(base);
  cuotasCentavos[cuotasCentavos.length-1]+=total-base*numeroCuotas;
  interesesCentavos=totalInteres;
 }else{
  const cuotaTeorica=r===0?capitalCentavos/numeroCuotas:capitalCentavos*r/(1-Math.pow(1+r,-numeroCuotas));
  for(let i=0;i<numeroCuotas;i++){
   const interes=Math.round(saldo*r);
   const cuota=i===numeroCuotas-1?saldo+interes:Math.min(Math.round(cuotaTeorica),saldo+interes);
   cuotasCentavos.push(cuota);interesesCentavos+=interes;saldo=Math.max(0,saldo+interes-cuota);
  }
 }
 const totalCentavos=cuotasCentavos.reduce((s,n)=>s+n,0);
 if(!Number.isSafeInteger(totalCentavos))throw new RangeError("Total fuera de rango");
 return {precio,numeroCuotas,tasaPct,metodo,cuotas:cuotasCentavos.map(c=>c/100),total:totalCentavos/100,intereses:(totalCentavos-capitalCentavos)/100,soloSimulacion:true};
}
function interpretarSimulacion(texto){
 const t=String(texto||"").toLowerCase();
 if(!/(cuotas|financia|inter[eé]s|cr[eé]dito)/i.test(t))return null;
 const precioMatch=t.match(/(?:valen|cuestan|cuesta|vale|precio(?: de)?|por|de)\s*\$?\s*(\d{1,3}(?:[.,]\d{3})+|\d{4,9}|\d{1,3})\s*(mil)?\b/i);
 const cuotasMatch=t.match(/(?:a|en)\s*(\d{1,3}|dos|tres|cuatro|seis|doce)\s*cuotas/i);
 const tasaMatch=t.match(/(\d+(?:[.,]\d+)?)\s*%/);
 if(!precioMatch||!cuotasMatch||!tasaMatch)return null;
 const tabla={dos:2,tres:3,cuatro:4,seis:6,doce:12};
 const precio=Number(precioMatch[1].replace(/[.,]/g,""))*(precioMatch[2]?1000:1);
 const numeroCuotas=tabla[cuotasMatch[1]]||Number(cuotasMatch[1]);
 const tasaPct=Number(tasaMatch[1].replace(",","."));
 if(!Number.isSafeInteger(precio)||precio<1000||!Number.isInteger(numeroCuotas)||numeroCuotas<1||numeroCuotas>360||!Number.isFinite(tasaPct)||tasaPct<0||tasaPct>100)return null;
 return {precio,numeroCuotas,tasaPct};
}
module.exports={simularCuotas,interpretarSimulacion};