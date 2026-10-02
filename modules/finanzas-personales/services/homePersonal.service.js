"use strict";
const Transaccion=require("../models/TransaccionPersonal");
const Prestamo=require("../models/prestamoPersonal.model");
const patrimonio=require("./patrimonioCanonico.service");
function monthStart(d=new Date()){return new Date(d.getFullYear(),d.getMonth(),1);}
async function obtener(usuarioId,now=new Date()){
 const inicio=monthStart(now),fin=new Date(now.getFullYear(),now.getMonth()+1,1);
 const [tx,deudas,pat]=await Promise.all([
  Transaccion.find({usuarioId,fecha:{$gte:inicio,$lt:fin},tipo:{$in:["INGRESO","GASTO"]}}).lean(),
  Prestamo.find({usuarioId,direccion:"POR_PAGAR",estado:"ACTIVO"}).sort({fechaVencimiento:1,createdAt:1}).lean(),
  patrimonio.obtener(usuarioId)
 ]);
 const ingresosMinor=tx.filter(x=>x.tipo==="INGRESO").reduce((s,x)=>s+x.montoMinor,0);
 const gastosMinor=tx.filter(x=>x.tipo==="GASTO").reduce((s,x)=>s+x.montoMinor,0);
 const flujoMinor=ingresosMinor-gastosMinor;
 const deudaTotalMinor=deudas.reduce((s,x)=>s+x.saldoMinor,0);
 const proxima=deudas.find(x=>x.fechaVencimiento&&x.saldoMinor>0)||null;
 const cuotasProximasMinor=deudas.filter(x=>x.fechaVencimiento&&x.fechaVencimiento>=now&&x.fechaVencimiento<fin).reduce((s,x)=>s+Math.min(x.cuotaMinor||x.saldoMinor,x.saldoMinor),0);
 const disponibleDespuesCompromisosMinor=pat.saldoLiquidoMinor-cuotasProximasMinor;
 const decisiones=[];
 if(proxima){const cuota=Math.min(proxima.cuotaMinor||proxima.saldoMinor,proxima.saldoMinor);decisiones.push({tipo:"OBLIGACION",prioridad:"ALTA",titulo:"Próximo compromiso: "+proxima.concepto,detalle:"Reserva la cuota antes de aumentar gasto discrecional.",montoMinor:cuota,fecha:proxima.fechaVencimiento,accion:"REVISAR_DEUDA"});}
 if(disponibleDespuesCompromisosMinor<0)decisiones.unshift({tipo:"CAJA",prioridad:"CRITICA",titulo:"Caja insuficiente para compromisos registrados",detalle:"El saldo líquido registrado no cubre las cuotas que vencen este mes.",montoMinor:Math.abs(disponibleDespuesCompromisosMinor),accion:"PROTEGER_CAJA"});
 else if(cuotasProximasMinor>0)decisiones.push({tipo:"CAJA",prioridad:"MEDIA",titulo:"Dinero comprometido este mes",detalle:"No lo trates como disponible para gasto libre.",montoMinor:cuotasProximasMinor,accion:"RESERVAR"});
 if(flujoMinor<0)decisiones.unshift({tipo:"FLUJO",prioridad:"CRITICA",titulo:"El mes está consumiendo más caja de la que genera",detalle:"Los gastos registrados superan los ingresos registrados del mes.",montoMinor:Math.abs(flujoMinor),accion:"REVISAR_GASTOS"});
 return{corte:now,moneda:"COP",mes:{ingresosMinor,gastosMinor,flujoMinor},caja:{saldoLiquidoMinor:pat.saldoLiquidoMinor,comprometidoMinor:cuotasProximasMinor,disponibleDespuesCompromisosMinor},patrimonio:{netoMinor:pat.patrimonioNetoMinor,deudaTotalMinor},proximaObligacion:proxima?{id:proxima._id,concepto:proxima.concepto,montoMinor:Math.min(proxima.cuotaMinor||proxima.saldoMinor,proxima.saldoMinor),fecha:proxima.fechaVencimiento}:null,decisiones:decisiones.slice(0,5),fuente:"ledger_canonico"};
}
module.exports={obtener};
