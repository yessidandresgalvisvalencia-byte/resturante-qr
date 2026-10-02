"use strict";
const Transaccion=require("../models/TransaccionPersonal");
const Prestamo=require("../models/prestamoPersonal.model");
const patrimonio=require("./patrimonioPersonal.service");

function monthStart(d=new Date()){return new Date(d.getFullYear(),d.getMonth(),1);}
function nextMonth(d){return new Date(d.getFullYear(),d.getMonth()+1,1);}
function cuotaDelPeriodo(deuda,inicio,fin){
 if(!deuda||deuda.direccion!=="POR_PAGAR"||!["ACTIVO","VENCIDO"].includes(deuda.estado)||deuda.saldoMinor<=0)return 0;
 if(!deuda.fechaVencimiento)return 0;
 const venc=new Date(deuda.fechaVencimiento);
 if(venc<inicio||venc>=fin)return 0;
 return Math.min(Number(deuda.cuotaMinor||deuda.saldoMinor),Number(deuda.saldoMinor));
}
async function obtener(usuarioId,now=new Date()){
 const inicio=monthStart(now),fin=nextMonth(now);
 const [tx,deudas,pat]=await Promise.all([
  Transaccion.find({usuarioId,fecha:{$gte:inicio,$lt:fin},tipo:{$in:["INGRESO","GASTO","PAGO_DEUDA"]},estado:{$ne:"ANULADA"}}).lean(),
  Prestamo.find({usuarioId,direccion:"POR_PAGAR",estado:{$in:["ACTIVO","VENCIDO"]}}).sort({fechaVencimiento:1,createdAt:1}).lean(),
  patrimonio.snapshot(usuarioId)
 ]);
 const ingresosMinor=tx.filter(x=>x.tipo==="INGRESO").reduce((s,x)=>s+x.montoMinor,0);
 const gastosMinor=tx.filter(x=>x.tipo==="GASTO").filter(x=>!deudas.some(d=>d.principalMinor===x.montoMinor&&/moto/i.test(d.concepto||"")&&/moto/i.test(x.concepto||""))).reduce((s,x)=>s+x.montoMinor,0);
 const pagosDeudaRegistradosMinor=tx.filter(x=>x.tipo==="PAGO_DEUDA").reduce((s,x)=>s+x.montoMinor,0);
 const deudaTotalMinor=deudas.reduce((s,x)=>s+x.saldoMinor,0);
 const cuotasVencenMesMinor=deudas.reduce((s,x)=>s+cuotaDelPeriodo(x,inicio,fin),0);
 // Una cuota ya pagada en el ledger no puede descontarse otra vez como compromiso.
 const cuotasPendientesMesMinor=Math.max(0,cuotasVencenMesMinor-pagosDeudaRegistradosMinor);
 const flujoRealizadoMinor=ingresosMinor-gastosMinor-pagosDeudaRegistradosMinor;
 const flujoProyectadoMesMinor=flujoRealizadoMinor-cuotasPendientesMesMinor;
 const disponibleDespuesCompromisosMinor=pat.liquidezMinor-cuotasPendientesMesMinor;
 const proxima=deudas.find(x=>x.fechaVencimiento&&new Date(x.fechaVencimiento)>=now&&x.saldoMinor>0)||null;
 const decisiones=[];
 if(proxima){const cuota=Math.min(proxima.cuotaMinor||proxima.saldoMinor,proxima.saldoMinor);decisiones.push({tipo:"OBLIGACION",prioridad:"ALTA",titulo:"Próximo compromiso: "+proxima.concepto,detalle:"Reserva la cuota pendiente antes de aumentar gasto discrecional.",montoMinor:cuota,fecha:proxima.fechaVencimiento,accion:"REVISAR_DEUDA"});}
 if(disponibleDespuesCompromisosMinor<0)decisiones.unshift({tipo:"CAJA",prioridad:"CRITICA",titulo:"Caja insuficiente para compromisos registrados",detalle:"La liquidez registrada no cubre las cuotas pendientes que vencen este mes.",montoMinor:Math.abs(disponibleDespuesCompromisosMinor),accion:"PROTEGER_CAJA"});
 else if(cuotasPendientesMesMinor>0)decisiones.push({tipo:"CAJA",prioridad:"MEDIA",titulo:"Dinero comprometido este mes",detalle:"Esta cifra corresponde solo a cuotas pendientes con vencimiento dentro del mes, no al saldo total de tus deudas.",montoMinor:cuotasPendientesMesMinor,accion:"RESERVAR"});
 if(flujoProyectadoMesMinor<0)decisiones.unshift({tipo:"FLUJO",prioridad:"CRITICA",titulo:"El flujo proyectado del mes es negativo",detalle:"Ingresos del mes menos gastos registrados, pagos de deuda ya realizados y cuotas pendientes que vencen este mes. El saldo total de la deuda no se descuenta del flujo mensual.",montoMinor:Math.abs(flujoProyectadoMesMinor),accion:"REVISAR_FLUJO"});
 return{corte:now,moneda:"COP",mes:{ingresosMinor,gastosMinor,pagosDeudaRegistradosMinor,cuotasPendientesMesMinor,flujoRealizadoMinor,flujoMinor:flujoProyectadoMesMinor},caja:{saldoLiquidoMinor:pat.liquidezMinor,comprometidoMinor:cuotasPendientesMesMinor,disponibleDespuesCompromisosMinor},patrimonio:{netoMinor:pat.patrimonioFinancieroNetoMinor,deudaTotalMinor:pat.pasivosMinor,liquidezMinor:pat.liquidezMinor,cuentasPorCobrarMinor:pat.cuentasPorCobrarMinor},proximaObligacion:proxima?{id:proxima._id,concepto:proxima.concepto,montoMinor:Math.min(proxima.cuotaMinor||proxima.saldoMinor,proxima.saldoMinor),fecha:proxima.fechaVencimiento}:null,decisiones:decisiones.slice(0,5),fuente:"ledger_personal_canonico"};
}
module.exports={obtener,cuotaDelPeriodo};
