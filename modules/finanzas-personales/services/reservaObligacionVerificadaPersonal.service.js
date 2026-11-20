"use strict";
const {fechaVerificable}=require("./fechaPersonal.service");
const id=v=>typeof v==="string"&&/^[a-f0-9]{24}$/.test(v),entero=n=>Number.isSafeInteger(n)&&n>=0;
function resolverReserva(h,prestamoId,ahora){
 if(!id(prestamoId))return null;
 const a=h?.asesor,xs=a?.compromisosAntesProximoIngreso,prueba=h?.explicaciones?.disponibleHoy?.origen?.compromisosAntesIngreso,ingreso=fechaVerificable(a?.proximoIngreso?.fecha);
 if(!Array.isArray(xs)||!Array.isArray(prueba)||xs.length>5000||prueba.length!==xs.length||!ingreso)return null;
 const convertir=rows=>rows.map(x=>{const f=fechaVerificable(x?.fecha);if(!x||!f||+f<+ahora||+f>=+ingreso||!entero(x.montoMinor)||x.montoMinor<1||typeof x.concepto!=="string"||!x.concepto.trim()||x.deudaId!==undefined&&!id(x.deudaId))throw Error();return{tipo:x.tipo??null,deudaId:x.deudaId??null,concepto:x.concepto,montoMinor:x.montoMinor,fecha:f.toISOString()};});
 try{
  const filas=convertir(xs),evidencia=convertir(prueba);
  if(JSON.stringify(filas)!==JSON.stringify(evidencia)||filas.reduce((n,x)=>n+BigInt(x.montoMinor),0n)!==BigInt(a.gastosFijosAntesProximoIngresoMinor))return null;
  const ids=new Set();for(const x of filas)if(x.deudaId){const k=x.tipo+":"+x.deudaId;if(ids.has(k))return null;ids.add(k);}
  const propias=filas.filter(x=>x.tipo==="PRESTAMO"&&x.deudaId===prestamoId);if(propias.length!==1)return null;
  const c=propias[0];return{tipo:"PRESTAMO",prestamoId,fecha:c.fecha,montoReservadoMinor:c.montoMinor,fuente:"COMPROMISO_HOME_MISMO_SNAPSHOT",esDineroSeparado:false};
 }catch{return null;}
}
module.exports={resolverReserva};
