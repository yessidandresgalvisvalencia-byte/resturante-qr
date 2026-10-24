"use strict";
// Proyección civil, no un ledger: genera vencimientos teóricos, NO determina
// cuotas pagadas, mora ni Disponible Hoy. Fecha civil America/Bogota UTC-05.
const DIA=86400000,MAX_OCURRENCIAS=1000,MAX_HORIZONTE=366*DIA;
function fallo(mensaje,statusCode=400){throw Object.assign(new Error(mensaje),{statusCode});}
function partesBogota(fecha){
 const local=new Date(fecha.getTime()-5*3600000);
 return {y:local.getUTCFullYear(),m:local.getUTCMonth()+1,d:local.getUTCDate(),
  hora:local.getUTCHours(),min:local.getUTCMinutes(),seg:local.getUTCSeconds(),
  ms:local.getUTCMilliseconds()};
}
function calendario(y,m,d,hora,min,seg,ms){
 const max=new Date(Date.UTC(y,m,0)).getUTCDate();
 return new Date(Date.UTC(y,m-1,Math.min(d,max),hora+5,min,seg,ms));
}
function programarVencimientosBrutos({origen,desde,hasta,cancelada=false}){
 const base=new Date(origen?.fecha),inicio=new Date(desde),fin=new Date(hasta);
 if(!Number.isFinite(base.getTime())||!Number.isFinite(inicio.getTime())||
    !Number.isFinite(fin.getTime())||inicio>=fin||fin-inicio>MAX_HORIZONTE)
  fallo("Ventana de programación inválida o mayor a 366 días");
 if(typeof cancelada!=="boolean"||
    !Number.isSafeInteger(origen.montoMinor)||origen.montoMinor<=0)
  fallo("Obligación inválida");
 if(cancelada)return [];
 const frecuencia=origen.frecuencia;
 if(!origen.recurrente&&frecuencia!=="NINGUNA"||
    origen.recurrente&&frecuencia==="NINGUNA")fallo("Periodicidad inconsistente");
 if(!origen.recurrente){
  return base>=inicio&&base<fin?[{fecha:base,montoMinor:origen.montoMinor}]:[];
 }
 const b=partesBogota(base);
 const diaBase=Date.UTC(b.y,b.m-1,b.d);
 const diaInicio=Date.UTC(partesBogota(inicio).y,partesBogota(inicio).m-1,
  partesBogota(inicio).d);
 let desdeIndice=0,creador;
 const duracion=frecuencia==="DIARIA"?1:
  frecuencia==="SEMANAL"?7:frecuencia==="QUINCENAL"?15:null;
 if(duracion){
  desdeIndice=Math.max(0,Math.floor((diaInicio-diaBase)/(DIA*duracion))-1);
  creador=k=>new Date(base.getTime()+k*duracion*DIA);
 }else if(frecuencia==="MENSUAL"){
  const p=partesBogota(inicio);
  desdeIndice=Math.max(0,(p.y-b.y)*12+p.m-b.m-1);
  creador=k=>{
   const first=new Date(Date.UTC(b.y,b.m-1+k,1));
   return calendario(first.getUTCFullYear(),first.getUTCMonth()+1,b.d,
    b.hora,b.min,b.seg,b.ms);
  };
 }else if(frecuencia==="ANUAL"){
  const p=partesBogota(inicio);
  desdeIndice=Math.max(0,p.y-b.y-1);
  creador=k=>calendario(b.y+k,b.m,b.d,b.hora,b.min,b.seg,b.ms);
 }else fallo("Frecuencia no soportada");
 const resultados=[];
 for(let i=desdeIndice;i<desdeIndice+MAX_OCURRENCIAS;i++){
  const fecha=creador(i);
  if(!Number.isFinite(fecha.getTime()))fallo("Vencimiento excede rango",503);
  if(fecha>=fin)return resultados;
  if(fecha>=inicio&&fecha>=base)
   resultados.push({fecha,montoMinor:origen.montoMinor});
 }
 fallo("Demasiados vencimientos para proyectar",503);
}
module.exports={programarVencimientosBrutos,MAX_OCURRENCIAS};
