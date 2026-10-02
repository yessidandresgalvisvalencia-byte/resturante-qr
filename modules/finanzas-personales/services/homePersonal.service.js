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
 const fmt=n=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(Math.round(Number(n||0)));
 const activosDetalle=(pat.activos||[]).map(x=>({nombre:x.nombre,tipo:x.tipo,valorMinor:x.valorMinor}));
 const deudasDetalle=deudas.map(x=>({concepto:x.concepto,principalMinor:x.principalMinor,saldoMinor:x.saldoMinor,abonadoMinor:Math.max(0,(x.principalMinor||0)-(x.saldoMinor||0)),cuotaMinor:x.cuotaMinor||0,fechaVencimiento:x.fechaVencimiento}));
 const explicaciones={
  disponible:{titulo:"Disponible después de compromisos",calculo:fmt(pat.liquidezMinor)+" − "+fmt(cuotasPendientesMesMinor)+" = "+fmt(disponibleDespuesCompromisosMinor),origen:{liquidezMinor:pat.liquidezMinor,compromisosMinor:cuotasPendientesMesMinor},significado:disponibleDespuesCompromisosMinor<0?"No significa que debas este valor hoy. Significa que la liquidez registrada no alcanza para cubrir los compromisos pendientes del mes.":"La liquidez registrada alcanza para cubrir los compromisos pendientes del mes.",accion:disponibleDespuesCompromisosMinor<0?"Necesitas aumentar liquidez o reducir/reprogramar compromisos por "+fmt(Math.abs(disponibleDespuesCompromisosMinor))+".":"Mantén reservado el dinero comprometido."},
  comprometido:{titulo:"Comprometido este mes",calculo:deudasDetalle.filter(x=>x.fechaVencimiento&&new Date(x.fechaVencimiento)>=inicio&&new Date(x.fechaVencimiento)<fin).map(x=>x.concepto+" "+fmt(Math.min(x.cuotaMinor||x.saldoMinor,x.saldoMinor))).join(" + ")||fmt(0),origen:{compromisos:deudasDetalle},significado:"Son cuotas pendientes con vencimiento dentro del mes; no es el saldo total de tus deudas.",accion:"Reserva "+fmt(cuotasPendientesMesMinor)+" para los vencimientos del mes."},
  flujoRealizado:{titulo:"Flujo realizado",calculo:fmt(ingresosMinor)+" − "+fmt(gastosMinor)+" − "+fmt(pagosDeudaRegistradosMinor)+" = "+fmt(flujoRealizadoMinor),origen:{ingresosMinor,gastosMinor,pagosDeudaRegistradosMinor},significado:flujoRealizadoMinor>=0?"Hasta ahora has generado "+fmt(flujoRealizadoMinor)+" más de lo que ha salido de tu flujo registrado.":"Hasta ahora las salidas registradas superan los ingresos en "+fmt(Math.abs(flujoRealizadoMinor))+".",accion:"Este indicador describe lo ocurrido; no descuenta cuotas futuras."},
  flujoProyectado:{titulo:"Flujo proyectado del mes",calculo:fmt(flujoRealizadoMinor)+" − "+fmt(cuotasPendientesMesMinor)+" = "+fmt(flujoProyectadoMesMinor),origen:{flujoRealizadoMinor,cuotasPendientesMesMinor},significado:flujoProyectadoMesMinor<0?"No significa que hayas perdido "+fmt(Math.abs(flujoProyectadoMesMinor))+". Al reservar los compromisos pendientes, el mes quedaría proyectado en negativo.":"Después de reservar los compromisos pendientes, el flujo proyectado permanece no negativo.",accion:flujoProyectadoMesMinor<0?"Para terminar el mes en $0 necesitas generar "+fmt(Math.abs(flujoProyectadoMesMinor))+" adicionales o reducir/reprogramar compromisos por ese valor.":"No hay brecha proyectada con los datos registrados."},
  patrimonio:{titulo:"Patrimonio neto registrado",calculo:fmt(pat.activosTotalesMinor)+" + "+fmt(pat.cuentasPorCobrarMinor)+" − "+fmt(pat.pasivosMinor)+" = "+fmt(pat.patrimonioFinancieroNetoMinor),origen:{activos:activosDetalle,cuentasPorCobrarMinor:pat.cuentasPorCobrarMinor,deudas:deudasDetalle},significado:"Es el valor neto registrado de activos y derechos menos deudas. No es dinero disponible para gastar.",accion:"Actualiza valores de activos cuando cambien para mantener el patrimonio preciso."},
  deuda:{titulo:"Deuda registrada",calculo:deudasDetalle.map(x=>x.concepto+" "+fmt(x.saldoMinor)).join(" + ")+" = "+fmt(deudaTotalMinor),origen:{deudas:deudasDetalle},significado:"Es el saldo pendiente total. GRUK solo lleva al flujo mensual las cuotas que vencen en el mes, no toda la deuda.",accion:"Cumple las cuotas según sus vencimientos; el saldo total permanece en patrimonio hasta ser pagado."}
 };
 const decisiones=[];
 if(proxima){const cuota=Math.min(proxima.cuotaMinor||proxima.saldoMinor,proxima.saldoMinor);decisiones.push({tipo:"OBLIGACION",prioridad:"ALTA",titulo:"Próximo compromiso: "+proxima.concepto,detalle:"Reserva la cuota pendiente antes de aumentar gasto discrecional.",montoMinor:cuota,fecha:proxima.fechaVencimiento,accion:"REVISAR_DEUDA"});}
 if(disponibleDespuesCompromisosMinor<0)decisiones.unshift({tipo:"CAJA",prioridad:"CRITICA",titulo:"Caja insuficiente para compromisos registrados",detalle:"La liquidez registrada no cubre las cuotas pendientes que vencen este mes.",montoMinor:Math.abs(disponibleDespuesCompromisosMinor),accion:"PROTEGER_CAJA"});
 else if(cuotasPendientesMesMinor>0)decisiones.push({tipo:"CAJA",prioridad:"MEDIA",titulo:"Dinero comprometido este mes",detalle:"Esta cifra corresponde solo a cuotas pendientes con vencimiento dentro del mes, no al saldo total de tus deudas.",montoMinor:cuotasPendientesMesMinor,accion:"RESERVAR"});
 if(flujoProyectadoMesMinor<0)decisiones.unshift({tipo:"FLUJO",prioridad:"CRITICA",titulo:"El flujo proyectado del mes es negativo",detalle:"Ingresos del mes menos gastos registrados, pagos de deuda ya realizados y cuotas pendientes que vencen este mes. El saldo total de la deuda no se descuenta del flujo mensual.",montoMinor:flujoProyectadoMesMinor,accion:"REVISAR_FLUJO"});
 return{corte:now,moneda:"COP",mes:{ingresosMinor,gastosMinor,pagosDeudaRegistradosMinor,cuotasPendientesMesMinor,flujoRealizadoMinor,flujoMinor:flujoProyectadoMesMinor},caja:{saldoLiquidoMinor:pat.liquidezMinor,comprometidoMinor:cuotasPendientesMesMinor,disponibleDespuesCompromisosMinor},patrimonio:{netoMinor:pat.patrimonioFinancieroNetoMinor,deudaTotalMinor:pat.pasivosMinor,liquidezMinor:pat.liquidezMinor,cuentasPorCobrarMinor:pat.cuentasPorCobrarMinor},proximaObligacion:proxima?{id:proxima._id,concepto:proxima.concepto,montoMinor:Math.min(proxima.cuotaMinor||proxima.saldoMinor,proxima.saldoMinor),fecha:proxima.fechaVencimiento}:null,decisiones:decisiones.slice(0,5),explicaciones,fuente:"ledger_personal_canonico"};
}
module.exports={obtener,cuotaDelPeriodo};
