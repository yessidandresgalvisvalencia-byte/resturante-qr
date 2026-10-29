"use strict";
const {calcularFlujo}=require("./totalesFlujoCompensadoPersonal.service");
function agrupar(rows,key){
 const grupos=new Map();
 for(const x of rows){if(x.estado==="ANULADA"||!["INGRESO","GASTO"].includes(x.tipo))continue;
  const k=key(x),grupo=grupos.get(k)||[];grupo.push(x);grupos.set(k,grupo);
 }
 return grupos;
}
function resumenDesde(rows){
 const movimientos=rows.filter(x=>["INGRESO","GASTO"].includes(x.tipo));
 const t=calcularFlujo(movimientos);
 const categorias=Object.fromEntries([...agrupar(movimientos,x=>x.categoria||"Sin categoría")].map(([k,g])=>{
  const s=calcularFlujo(g);return[k,{ingresos:s.ingresosMinor,gastos:s.gastosMinor}];
 }));
 return{ingresos:t.ingresosMinor,gastos:t.gastosMinor,balance:t.flujoNetoMinor,categorias};
}
function diarioDesde(rows,limit){
 const ordenados=rows.filter(x=>x.estado!=="ANULADA"&&["INGRESO","GASTO"].includes(x.tipo))
  .sort((a,b)=>+new Date(b.fecha)-+new Date(a.fecha)||+new Date(b.createdAt)-+new Date(a.createdAt))
  .slice(0,limit);
 return [...agrupar(ordenados,x=>new Date(x.fecha).toISOString().slice(0,10))].map(([fecha,g])=>{
  const t=calcularFlujo(g);return{fecha,ingresos:t.ingresosMinor,gastos:t.gastosMinor,
   balance:t.flujoNetoMinor,movimientos:g.map(x=>({...x,monto:x.montoMinor}))};
 }).sort((a,b)=>b.fecha.localeCompare(a.fecha));
}
module.exports={resumenDesde,diarioDesde};
