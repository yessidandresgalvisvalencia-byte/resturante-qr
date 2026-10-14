"use strict";
const home=require("./homePersonal.service");
const Calendario=require("../models/calendarioFinanciero.model");
const Prestamo=require("../models/prestamoPersonal.model");
const HORIZONTES=Object.freeze([30,60,90]);
function proyectarVentanas({corte=new Date(),saldoMinor=null,saldoVerificado=false,ingresos=[],obligaciones=[]}={}){
 const fechaCorte=new Date(corte);
 if(!Number.isFinite(fechaCorte.getTime()))throw new TypeError("Fecha de corte inválida");
 if(saldoMinor!==null&&(!Number.isSafeInteger(saldoMinor)||saldoMinor<0))throw new TypeError("Saldo inválido");
 const normalizar=(items,tipo)=>{
  if(!Array.isArray(items))throw new TypeError("Eventos inválidos");
  return items.map(e=>{
   const montoMinor=Number(e.montoMinor),fecha=new Date(e.fecha);
   if(!Number.isSafeInteger(montoMinor)||montoMinor<0||!Number.isFinite(fecha.getTime()))throw new TypeError("Evento financiero inválido");
   return{tipo,concepto:String(e.concepto||""),montoMinor,fecha,fuente:String(e.fuente||"REGISTRO")};
  }).filter(e=>e.fecha>fechaCorte);
 };
 const eventos=[...normalizar(ingresos,"INGRESO_PROGRAMADO"),...normalizar(obligaciones,"OBLIGACION_PROGRAMADA")];
 return HORIZONTES.map(dias=>{
  const fechaLimite=new Date(fechaCorte.getTime()+dias*86400000);
  const periodo=eventos.filter(e=>e.fecha<=fechaLimite);
  const ingresosMinor=periodo.filter(e=>e.tipo==="INGRESO_PROGRAMADO").reduce((a,e)=>a+e.montoMinor,0);
  const compromisosMinor=periodo.filter(e=>e.tipo==="OBLIGACION_PROGRAMADA").reduce((a,e)=>a+e.montoMinor,0);
  const saldoCondicionalMinor=saldoVerificado&&saldoMinor!==null?saldoMinor+ingresosMinor-compromisosMinor:null;
  if(saldoCondicionalMinor!==null&&!Number.isSafeInteger(saldoCondicionalMinor))throw new RangeError("Proyección fuera de rango");
  return{dias,fechaLimite,ingresosConFechaMinor:ingresosMinor,obligacionesConFechaMinor:compromisosMinor,saldoCondicionalMinor,numeroIngresos:periodo.filter(e=>e.tipo==="INGRESO_PROGRAMADO").length,numeroObligaciones:periodo.filter(e=>e.tipo==="OBLIGACION_PROGRAMADA").length,estado:"PARCIAL",soloLectura:true};
 });
}
function fechasCalendario(item,corte,diasMax=90){
 const fechas=[],local=new Date(corte.getTime()-5*3600000),limite=new Date(corte.getTime()+diasMax*86400000);
 let y=local.getUTCFullYear(),m=local.getUTCMonth();
 for(let i=0;i<5;i++){
  const ultimo=new Date(Date.UTC(y,m+1,0)).getUTCDate();
  const fecha=new Date(Date.UTC(y,m,Math.min(item.diaMes,ultimo),5,0,0));
  if(fecha>corte&&fecha<=limite)fechas.push(fecha);
  m++;if(m>11){m=0;y++;}
 }
 return fechas;
}
async function analizar(usuarioId){
 const h=await home.obtener(usuarioId),a=h.asesor||{},corte=new Date(h.corte||Date.now());
 const [calendarios,deudas]=await Promise.all([
  Calendario.find({usuarioId,activo:true,tipo:{$in:["INGRESO","GASTO_FIJO","OBLIGACION"]}}).lean(),
  Prestamo.find({usuarioId,direccion:"POR_PAGAR",estado:{$in:["ACTIVO","VENCIDO"]},saldoMinor:{$gt:0}}).lean()
 ]);
 const ingresos=[],obligaciones=[],deudasConCalendario=new Set();
 for(const c of calendarios){
  if(c.sourceId)deudasConCalendario.add(String(c.sourceId));
  for(const fecha of fechasCalendario(c,corte)){
   const item={fecha,montoMinor:c.montoMinor,concepto:c.concepto,fuente:"CALENDARIO_MENSUAL"};
   (c.tipo==="INGRESO"?ingresos:obligaciones).push(item);
  }
 }
 for(const d of deudas){
  if(!d.fechaVencimiento||deudasConCalendario.has(String(d._id)))continue;
  const venc=new Date(d.fechaVencimiento);
  if(venc<=corte)continue;
  obligaciones.push({fecha:venc,montoMinor:Math.min(d.cuotaMinor||d.saldoMinor,d.saldoMinor),concepto:d.concepto,fuente:"VENCIMIENTO_UNICO_CONOCIDO"});
 }
 const ventanas=proyectarVentanas({corte,saldoMinor:a.saldoRealConocido?a.saldoRealMinor:null,saldoVerificado:a.saldoConfiabilidad==="VERIFICADO",ingresos,obligaciones});
 return{ventanas,cobertura:"CALENDARIOS_MENSUALES_Y_VENCIMIENTOS_CONFIRMADOS",fuente:"CALENDARIO_PERSONAL_Y_PRESTAMOS",ingresosSinProgramar:ingresos.length===0,obligacionesSinFecha:deudas.filter(d=>!d.fechaVencimiento&&!deudasConCalendario.has(String(d._id))).length,deudasSinPeriodicidadConfirmada:deudas.filter(d=>d.fechaVencimiento&&!deudasConCalendario.has(String(d._id))&&d.cuotaMinor>0).length,saldoConfiabilidad:a.saldoConfiabilidad||"NO_VERIFICADO",soloLectura:true};
}
module.exports={proyectarVentanas,fechasCalendario,analizar};
