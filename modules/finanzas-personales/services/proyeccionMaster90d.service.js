"use strict";
const home=require("./homePersonal.service");
const HORIZONTES=Object.freeze([30,60,90]);
function proyectarVentanas({corte=new Date(),saldoMinor=null,saldoVerificado=false,ingresos=[],obligaciones=[]}={}){
 const fechaCorte=new Date(corte);if(!Number.isFinite(fechaCorte.getTime()))throw new TypeError("Fecha de corte inválida");
 if(saldoMinor!==null&&(!Number.isSafeInteger(saldoMinor)||saldoMinor<0))throw new TypeError("Saldo inválido");
 const normalizar=(items,tipo)=>{
  if(!Array.isArray(items))throw new TypeError("Eventos inválidos");
  return items.map(e=>{
   const montoMinor=Number(e.montoMinor),fecha=new Date(e.fecha);
   if(!Number.isSafeInteger(montoMinor)||montoMinor<0||!Number.isFinite(fecha.getTime()))throw new TypeError("Evento financiero inválido");
   return{tipo,concepto:String(e.concepto||""),montoMinor,fecha};
  }).filter(e=>e.fecha>fechaCorte);
 };
 const eventos=[...normalizar(ingresos,"INGRESO_CONFIRMADO"),...normalizar(obligaciones,"OBLIGACION_REGISTRADA")];
 return HORIZONTES.map(dias=>{
  const fechaLimite=new Date(fechaCorte.getTime()+dias*86400000);
  const periodo=eventos.filter(e=>e.fecha<=fechaLimite);
  const ingresosMinor=periodo.filter(e=>e.tipo==="INGRESO_CONFIRMADO").reduce((a,e)=>a+e.montoMinor,0);
  const compromisosMinor=periodo.filter(e=>e.tipo==="OBLIGACION_REGISTRADA").reduce((a,e)=>a+e.montoMinor,0);
  const saldoCondicionalMinor=saldoVerificado&&saldoMinor!==null?saldoMinor+ingresosMinor-compromisosMinor:null;
  if(saldoCondicionalMinor!==null&&!Number.isSafeInteger(saldoCondicionalMinor))throw new RangeError("Proyección fuera de rango");
  return{dias,fechaLimite,ingresosConFechaMinor:ingresosMinor,obligacionesConFechaMinor:compromisosMinor,saldoCondicionalMinor,estado:"PARCIAL",soloLectura:true,advertencia:"Escenario parcial: no se presume recurrencia de ingresos, cobro de cuentas pendientes ni gastos futuros no registrados. No es un saldo garantizado."};
 });
}
async function analizar(usuarioId){
 const h=await home.obtener(usuarioId),a=h.asesor||{};
 const proximo=a.proximoIngresoConocido&&a.proximoIngreso?[a.proximoIngreso]:[];
 const compromisos=Array.isArray(a.compromisosAntesProximoIngreso)?a.compromisosAntesProximoIngreso:[];
 return{ventanas:proyectarVentanas({corte:h.corte,saldoMinor:a.saldoRealConocido?a.saldoRealMinor:null,saldoVerificado:a.saldoConfiabilidad==="VERIFICADO",ingresos:proximo,obligaciones:compromisos}),cobertura:"SOLO_EVENTOS_CONOCIDOS_ANTES_PROXIMO_INGRESO",fuente:"HOME_PERSONAL",soloLectura:true};
}
module.exports={proyectarVentanas,analizar};
