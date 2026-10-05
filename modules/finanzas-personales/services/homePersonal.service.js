"use strict";
const Transaccion=require("../models/TransaccionPersonal");
const Prestamo=require("../models/prestamoPersonal.model");
const DeudaPersonal=require("../models/DeudaPersonal");
const {pagoExigible}=require("./tarjetaCreditoPersonal.service");
const patrimonio=require("./patrimonioPersonal.service");
const Calendario=require("../models/calendarioFinanciero.model");
const truth=require("./financialTruth.service");

function partesColombia(d=new Date()){const p=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);const v=Object.fromEntries(p.map(x=>[x.type,x.value]));return{y:Number(v.year),m:Number(v.month),d:Number(v.day)};}
function inicioDiaColombiaUTC(y,m,d){return new Date(Date.UTC(y,m-1,d,5,0,0,0));}
function monthStart(d=new Date()){const p=partesColombia(d);return inicioDiaColombiaUTC(p.y,p.m,1);}
function nextMonth(d=new Date()){const p=partesColombia(d),y=p.m===12?p.y+1:p.y,m=p.m===12?1:p.m+1;return inicioDiaColombiaUTC(y,m,1);}
function diasEnMesUTC(y,m){return new Date(Date.UTC(y,m,0)).getUTCDate();}
function fechaCivilColombia(y,m,d){return inicioDiaColombiaUTC(y,m,Math.min(d,diasEnMesUTC(y,m)));}
function siguienteFechaRecurrente(tx,now){
 if(!tx||tx.tipo!=="INGRESO"||!tx.recurrente||tx.frecuencia==="NINGUNA")return null;
 const base=new Date(tx.fecha);if(Number.isNaN(base.getTime()))return null;
 const b=partesColombia(base),n=partesColombia(now);let y=b.y,m=b.m,d=b.d,guard=0;
 const avanzar=()=>{if(tx.frecuencia==="DIARIA"){const z=new Date(Date.UTC(y,m-1,d+1));y=z.getUTCFullYear();m=z.getUTCMonth()+1;d=z.getUTCDate();}else if(tx.frecuencia==="SEMANAL"||tx.frecuencia==="QUINCENAL"){const z=new Date(Date.UTC(y,m-1,d+(tx.frecuencia==="SEMANAL"?7:15)));y=z.getUTCFullYear();m=z.getUTCMonth()+1;d=z.getUTCDate();}else if(tx.frecuencia==="MENSUAL"){m++;if(m>12){m=1;y++;}d=Math.min(b.d,diasEnMesUTC(y,m));}else if(tx.frecuencia==="ANUAL"){y++;d=Math.min(b.d,diasEnMesUTC(y,m));}};
 let next=fechaCivilColombia(y,m,d);while(next<=now&&guard++<1000){avanzar();next=fechaCivilColombia(y,m,d);}return next>now?next:null;
}
function cuotaDelPeriodo(deuda,inicio,fin){
 if(!deuda||deuda.direccion!=="POR_PAGAR"||!["ACTIVO","VENCIDO"].includes(deuda.estado)||deuda.saldoMinor<=0)return 0;
 if(!deuda.fechaVencimiento)return 0;
 const venc=new Date(deuda.fechaVencimiento);
 if(venc<inicio||venc>=fin)return 0;
 return Math.min(Number(deuda.cuotaMinor||deuda.saldoMinor),Number(deuda.saldoMinor));
}
function gastoAfectaCaja(tx){return Boolean(tx&&tx.tipo==="GASTO"&&tx.medioPago!=="CREDITO");}
function resolverSaldoAsesor(pat){
 const derivado=pat&&pat.hayMovimientosLedger&&Number.isSafeInteger(pat.saldoDerivadoLedgerMinor);
 if(pat&&pat.saldoVerificado)return{montoMinor:pat.liquidezMinor,conocido:true,confiabilidad:"VERIFICADO",fuente:pat.fuenteLiquidez||"CUENTAS",requiereReconciliacion:false};
 if(derivado)return{montoMinor:Math.max(0,pat.saldoDerivadoLedgerMinor),conocido:true,confiabilidad:"RECONSTRUIDO_SIN_ANCLA",fuente:"LEDGER_DERIVADO",requiereReconciliacion:true};
 return{montoMinor:Number(pat?.liquidezMinor||0),conocido:false,confiabilidad:"NO_VERIFICADO",fuente:pat?.fuenteLiquidez||"NO_VERIFICADO",requiereReconciliacion:true};
}
function calcularDisponibleHoy({saldoMinor,gastosFijosAntesProximoIngresoMinor=0}){for(const n of [saldoMinor,gastosFijosAntesProximoIngresoMinor])if(!Number.isSafeInteger(n)||n<0)throw new TypeError("Disponible Hoy requiere enteros seguros no negativos");const colchonMinor=Math.floor(saldoMinor/10);const baseMinor=saldoMinor-gastosFijosAntesProximoIngresoMinor-colchonMinor;if(!Number.isSafeInteger(baseMinor))throw new RangeError("Disponible Hoy excede el rango monetario seguro");return{colchonMinor,baseMinor,disponibleHoyMinor:Math.max(0,baseMinor),estaEnRojo:baseMinor<0};}
function calcularFlujoMes({ingresosMinor=0,gastosMinor=0,pagosDeudaRegistradosMinor=0,cuotasVencenMesMinor=0}){for(const n of [ingresosMinor,gastosMinor,pagosDeudaRegistradosMinor,cuotasVencenMesMinor])if(!Number.isSafeInteger(n)||n<0)throw new TypeError("Los importes del flujo deben ser enteros seguros no negativos");const cuotasPendientesMesMinor=Math.max(0,cuotasVencenMesMinor-pagosDeudaRegistradosMinor);const flujoRealizadoMinor=ingresosMinor-gastosMinor-pagosDeudaRegistradosMinor;const flujoProyectadoMesMinor=flujoRealizadoMinor-cuotasPendientesMesMinor;if(!Number.isSafeInteger(flujoRealizadoMinor)||!Number.isSafeInteger(flujoProyectadoMesMinor))throw new RangeError("El flujo calculado excede el rango monetario seguro");return{cuotasPendientesMesMinor,flujoRealizadoMinor,flujoProyectadoMesMinor};}

async function obtener(usuarioId,now=new Date()){
 const inicio=monthStart(now),fin=nextMonth(now);
 const [tx,deudas,tarjetas,pat,ingresosRecurrentes,calendariosIngreso,cobros]=await Promise.all([
  Transaccion.find({usuarioId,fecha:{$gte:inicio,$lt:fin},tipo:{$in:["INGRESO","GASTO","PAGO_DEUDA"]},estado:{$ne:"ANULADA"}}).lean(),
  Prestamo.find({usuarioId,direccion:"POR_PAGAR",estado:{$in:["ACTIVO","VENCIDO"]}}).sort({fechaVencimiento:1,createdAt:1}).lean(),
  DeudaPersonal.find({usuarioId,tipo:"TARJETA_CREDITO",activa:true,saldoMinor:{$gt:0}}).lean(),
  patrimonio.snapshot(usuarioId),
  Transaccion.find({usuarioId,tipo:"INGRESO",recurrente:true,frecuencia:{$ne:"NINGUNA"},estado:{$ne:"ANULADA"},fecha:{$lte:now}}).sort({fecha:-1}).limit(100).lean(),
  Calendario.find({usuarioId,tipo:"INGRESO",activo:true}).lean(),
  Prestamo.find({usuarioId,direccion:"POR_COBRAR",estado:{$in:["ACTIVO","VENCIDO"]},saldoMinor:{$gt:0}}).sort({fechaVencimiento:1}).lean()
 ]);
 const ingresosMinor=tx.filter(x=>x.tipo==="INGRESO").reduce((s,x)=>s+x.montoMinor,0);
 const gastosConsumoMinor=tx.filter(x=>x.tipo==="GASTO").filter(x=>!deudas.some(d=>d.principalMinor===x.montoMinor&&/moto/i.test(d.concepto||"")&&/moto/i.test(x.concepto||""))).reduce((s,x)=>s+x.montoMinor,0);
 const gastosMinor=tx.filter(gastoAfectaCaja).filter(x=>!deudas.some(d=>d.principalMinor===x.montoMinor&&/moto/i.test(d.concepto||"")&&/moto/i.test(x.concepto||""))).reduce((s,x)=>s+x.montoMinor,0);
 const pagosDeudaRegistradosMinor=tx.filter(x=>x.tipo==="PAGO_DEUDA").reduce((s,x)=>s+x.montoMinor,0);
 const deudaTotalMinor=deudas.reduce((s,x)=>s+x.saldoMinor,0);
 const cuotasVencenMesMinor=deudas.reduce((s,x)=>s+cuotaDelPeriodo(x,inicio,fin),0);
 // Una cuota ya pagada en el ledger no puede descontarse otra vez como compromiso.
 const {cuotasPendientesMesMinor,flujoRealizadoMinor,flujoProyectadoMesMinor}=calcularFlujoMes({ingresosMinor,gastosMinor,pagosDeudaRegistradosMinor,cuotasVencenMesMinor});
 const calendarioProximos=calendariosIngreso.map(x=>{const p=partesColombia(now);let y=p.y,m=p.m,d=Math.min(x.diaMes,diasEnMesUTC(y,m));let fecha=fechaCivilColombia(y,m,d);if(fecha<=now){m++;if(m>12){m=1;y++;}d=Math.min(x.diaMes,diasEnMesUTC(y,m));fecha=fechaCivilColombia(y,m,d);}return{tx:{montoMinor:x.montoMinor,concepto:x.concepto},fecha};});
 const proximosIngresos=(calendarioProximos.length?calendarioProximos:ingresosRecurrentes.map(x=>({tx:x,fecha:siguienteFechaRecurrente(x,now)}))).filter(x=>x.fecha).sort((a,b)=>a.fecha-b.fecha);
 const proximoIngreso=proximosIngresos[0]||null;
 const limiteCompromisos=proximoIngreso?proximoIngreso.fecha:fin;
 const pHoy=partesColombia(now);
 const vencimientoTarjeta=t=>{let y=pHoy.y,m=pHoy.m,d=Math.min(Number(t.diaPago),diasEnMesUTC(y,m));let fecha=fechaCivilColombia(y,m,d);if(fecha<now){m++;if(m>12){m=1;y++;}fecha=fechaCivilColombia(y,m,Math.min(Number(t.diaPago),diasEnMesUTC(y,m)));}return fecha;};
 const compromisosTarjeta=tarjetas.map(t=>({concepto:"Pago tarjeta "+t.nombre,montoMinor:pagoExigible(t),fecha:vencimientoTarjeta(t),deudaId:String(t._id)})).filter(x=>x.montoMinor>0);
 const pagosDeudaIds=new Set(tx.filter(x=>x.tipo==="PAGO_DEUDA"&&x.prestamoId).map(x=>String(x.prestamoId)));
 const compromisosAntesIngreso=deudas.filter(d=>d.fechaVencimiento&&new Date(d.fechaVencimiento)>=now&&new Date(d.fechaVencimiento)<limiteCompromisos&&!pagosDeudaIds.has(String(d._id))).map(d=>({concepto:d.concepto,montoMinor:Math.min(Number(d.cuotaMinor||d.saldoMinor),Number(d.saldoMinor)),fecha:d.fechaVencimiento})); compromisosAntesIngreso.push(...compromisosTarjeta.filter(x=>x.fecha>=now&&x.fecha<limiteCompromisos));
 const gastosFijosRecurrentes=await Transaccion.find({usuarioId,tipo:"GASTO",recurrente:true,frecuencia:{$ne:"NINGUNA"},estado:{$ne:"ANULADA"},fecha:{$lte:now}}).sort({fecha:-1}).limit(100).lean();
 for(const g of gastosFijosRecurrentes){const fecha=siguienteFechaRecurrente({...g,tipo:"INGRESO"},now);if(fecha&&fecha<limiteCompromisos)compromisosAntesIngreso.push({concepto:g.concepto,montoMinor:g.montoMinor,fecha});}
 const gastosFijosAntesProximoIngresoMinor=compromisosAntesIngreso.reduce((s,x)=>s+x.montoMinor,0);
 const saldoEstado=resolverSaldoAsesor(pat);
 const saldoAsesorMinor=saldoEstado.montoMinor;
 const {colchonMinor,baseMinor:disponibleBaseMinor,disponibleHoyMinor,estaEnRojo}=calcularDisponibleHoy({saldoMinor:saldoAsesorMinor,gastosFijosAntesProximoIngresoMinor});
 const disponibleDespuesCompromisosMinor=pat.liquidezMinor-cuotasPendientesMesMinor;
 const proxima=deudas.find(x=>x.fechaVencimiento&&new Date(x.fechaVencimiento)>=now&&x.saldoMinor>0)||null;
 const fmt=n=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(Math.round(Number(n||0)));
 const activosDetalle=(pat.activos||[]).map(x=>({nombre:x.nombre,tipo:x.tipo,valorMinor:x.valorMinor}));
 const deudasDetalle=deudas.map(x=>({concepto:x.concepto,principalMinor:x.principalMinor,saldoMinor:x.saldoMinor,abonadoMinor:Math.max(0,(x.principalMinor||0)-(x.saldoMinor||0)),cuotaMinor:x.cuotaMinor||0,fechaVencimiento:x.fechaVencimiento}));
 const explicaciones={
  disponibleHoy:{titulo:"Puedes gastar hoy",calculo:fmt(saldoAsesorMinor)+" − "+fmt(gastosFijosAntesProximoIngresoMinor)+" − "+fmt(colchonMinor)+" = "+fmt(disponibleBaseMinor),origen:{saldoRealMinor:saldoAsesorMinor,gastosFijosAntesProximoIngresoMinor,colchonMinor,proximoIngreso:proximoIngreso?{fecha:proximoIngreso.fecha,montoMinor:proximoIngreso.tx.montoMinor,concepto:proximoIngreso.tx.concepto}:null,compromisosAntesIngreso},significado:estaEnRojo?"Estás en rojo: después de separar compromisos y el colchón no queda dinero disponible para gasto libre.":"Este es el máximo registrado que puedes gastar hoy sin tocar compromisos ni el colchón del 10%.",accion:estaEnRojo?"Hoy no aumentes gasto discrecional.":"No superes "+fmt(disponibleHoyMinor)+" de gasto libre con los datos registrados."},
  disponible:{titulo:"Disponible después de compromisos",calculo:fmt(pat.liquidezMinor)+" − "+fmt(cuotasPendientesMesMinor)+" = "+fmt(disponibleDespuesCompromisosMinor),origen:{liquidezMinor:pat.liquidezMinor,compromisosMinor:cuotasPendientesMesMinor},significado:disponibleDespuesCompromisosMinor<0?"No significa que debas este valor hoy. Significa que la liquidez registrada no alcanza para cubrir los compromisos pendientes del mes.":"La liquidez registrada alcanza para cubrir los compromisos pendientes del mes.",accion:disponibleDespuesCompromisosMinor<0?"Necesitas aumentar liquidez o reducir/reprogramar compromisos por "+fmt(Math.abs(disponibleDespuesCompromisosMinor))+".":"Mantén reservado el dinero comprometido."},
  comprometido:{titulo:"Comprometido este mes",calculo:deudasDetalle.filter(x=>x.fechaVencimiento&&new Date(x.fechaVencimiento)>=inicio&&new Date(x.fechaVencimiento)<fin).map(x=>x.concepto+" "+fmt(Math.min(x.cuotaMinor||x.saldoMinor,x.saldoMinor))).join(" + ")||fmt(0),origen:{compromisos:deudasDetalle},significado:"Son cuotas pendientes con vencimiento dentro del mes; no es el saldo total de tus deudas.",accion:"Reserva "+fmt(cuotasPendientesMesMinor)+" para los vencimientos del mes."},
  flujoRealizado:{titulo:"Flujo realizado",calculo:fmt(ingresosMinor)+" − "+fmt(gastosMinor)+" − "+fmt(pagosDeudaRegistradosMinor)+" = "+fmt(flujoRealizadoMinor),origen:{ingresosMinor,gastosMinor,pagosDeudaRegistradosMinor},significado:flujoRealizadoMinor>=0?"Hasta ahora has generado "+fmt(flujoRealizadoMinor)+" más de lo que ha salido de tu flujo registrado.":"Hasta ahora las salidas registradas superan los ingresos en "+fmt(Math.abs(flujoRealizadoMinor))+".",accion:"Este indicador describe lo ocurrido; no descuenta cuotas futuras."},
  flujoProyectado:{titulo:"Flujo proyectado del mes",calculo:fmt(flujoRealizadoMinor)+" − "+fmt(cuotasPendientesMesMinor)+" = "+fmt(flujoProyectadoMesMinor),origen:{flujoRealizadoMinor,cuotasPendientesMesMinor},significado:flujoProyectadoMesMinor<0?"No significa que hayas perdido "+fmt(Math.abs(flujoProyectadoMesMinor))+". Al reservar los compromisos pendientes, el mes quedaría proyectado en negativo.":"Después de reservar los compromisos pendientes, el flujo proyectado permanece no negativo.",accion:flujoProyectadoMesMinor<0?"Para terminar el mes en $0 necesitas generar "+fmt(Math.abs(flujoProyectadoMesMinor))+" adicionales o reducir/reprogramar compromisos por ese valor.":"No hay brecha proyectada con los datos registrados."},
  patrimonio:{titulo:"Patrimonio neto registrado",calculo:fmt(pat.activosTotalesMinor)+" + "+fmt(pat.cuentasPorCobrarMinor)+" − "+fmt(pat.pasivosMinor)+" = "+fmt(pat.patrimonioFinancieroNetoMinor),origen:{activos:activosDetalle,cuentasPorCobrarMinor:pat.cuentasPorCobrarMinor,deudas:deudasDetalle},significado:"Es el valor neto registrado de activos y derechos menos deudas. No es dinero disponible para gastar.",accion:"Actualiza valores de activos cuando cambien para mantener el patrimonio preciso."},
  deuda:{titulo:"Deuda registrada",calculo:deudasDetalle.map(x=>x.concepto+" "+fmt(x.saldoMinor)).join(" + ")+" = "+fmt(deudaTotalMinor),origen:{deudas:deudasDetalle},significado:"Es el saldo pendiente total. GRUK solo lleva al flujo mensual las cuotas que vencen en el mes, no toda la deuda.",accion:"Cumple las cuotas según sus vencimientos; el saldo total permanece en patrimonio hasta ser pagado."}
 };
 const decisiones=[];
 for(const cobro of cobros){if(cobro.fechaVencimiento&&new Date(cobro.fechaVencimiento)<=now)decisiones.push({tipo:"COBRO",prioridad:"ALTA",titulo:"Cobro pendiente: "+cobro.contraparte,detalle:"Tienes dinero por cobrar. No se cuenta como caja hasta recibirlo.",montoMinor:cobro.saldoMinor,fecha:cobro.fechaVencimiento,accion:"COBRAR"});}
 if(proxima){const cuota=Math.min(proxima.cuotaMinor||proxima.saldoMinor,proxima.saldoMinor);decisiones.push({tipo:"OBLIGACION",prioridad:"ALTA",titulo:"Próximo compromiso: "+proxima.concepto,detalle:"Reserva la cuota pendiente antes de aumentar gasto discrecional.",montoMinor:cuota,fecha:proxima.fechaVencimiento,accion:"REVISAR_DEUDA"});}
 if(disponibleDespuesCompromisosMinor<0)decisiones.unshift({tipo:"CAJA",prioridad:"CRITICA",titulo:"Caja insuficiente para compromisos registrados",detalle:"La liquidez registrada no cubre las cuotas pendientes que vencen este mes.",montoMinor:Math.abs(disponibleDespuesCompromisosMinor),accion:"PROTEGER_CAJA"});
 else if(cuotasPendientesMesMinor>0)decisiones.push({tipo:"CAJA",prioridad:"MEDIA",titulo:"Dinero comprometido este mes",detalle:"Esta cifra corresponde solo a cuotas pendientes con vencimiento dentro del mes, no al saldo total de tus deudas.",montoMinor:cuotasPendientesMesMinor,accion:"RESERVAR"});
 if(flujoProyectadoMesMinor<0)decisiones.unshift({tipo:"FLUJO",prioridad:"CRITICA",titulo:"El flujo proyectado del mes es negativo",detalle:"Ingresos del mes menos gastos registrados, pagos de deuda ya realizados y cuotas pendientes que vencen este mes. El saldo total de la deuda no se descuenta del flujo mensual.",montoMinor:flujoProyectadoMesMinor,accion:"REVISAR_FLUJO"});
 const verdadFinanciera={saldo:saldoEstado.confiabilidad==="VERIFICADO"?truth.hecho({montoMinor:saldoAsesorMinor,fuente:saldoEstado.fuente,corte:now,confianza:"VERIFICADO"}):truth.inferencia({montoMinor:saldoAsesorMinor,fuente:saldoEstado.fuente,corte:now,confianza:saldoEstado.conocido?"MEDIA":"NO_VERIFICADO",requiereReconciliacion:true}),flujoMes:truth.hecho({montoMinor:flujoRealizadoMinor,fuente:"LEDGER_PERSONAL",corte:now,confianza:"ALTA"}),flujoProyectado:truth.proyeccion({montoMinor:flujoProyectadoMesMinor,fuente:"LEDGER_MAS_COMPROMISOS",corte:now,confianza:saldoEstado.conocido?"MEDIA":"BAJA"}),disponibleHoy:truth.decision({montoMinor:disponibleHoyMinor,fuente:"REGLA_DISPONIBLE_HOY",corte:now,confianza:saldoEstado.confiabilidad==="VERIFICADO"?"ALTA":"MEDIA",requiereReconciliacion:saldoEstado.requiereReconciliacion})};
 return{corte:now,moneda:"COP",verdadFinanciera,asesor:{disponibleHoyMinor,colchonMinor,estaEnRojo,formula:"saldo_real - gastos_fijos_antes_proximo_ingreso - colchon_10pct",saldoRealMinor:saldoAsesorMinor,gastosFijosAntesProximoIngresoMinor,proximoIngreso:proximoIngreso?{fecha:proximoIngreso.fecha,montoMinor:proximoIngreso.tx.montoMinor,concepto:proximoIngreso.tx.concepto}:null,proximoIngresoConocido:Boolean(proximoIngreso),compromisosAntesProximoIngreso:compromisosAntesIngreso,saldoRealConocido:saldoEstado.conocido,saldoRequiereReconciliacion:saldoEstado.requiereReconciliacion,saldoDerivadoLedger:saldoEstado.confiabilidad==="RECONSTRUIDO_SIN_ANCLA",saldoConfiabilidad:saldoEstado.confiabilidad,fuenteSaldo:saldoEstado.fuente,fuentesSaldo:(pat.cuentas||[]).map(x=>({nombre:x.nombre,saldoMinor:x.saldoMinor}))},mes:{ingresosMinor,gastosMinor,gastosConsumoMinor,pagosDeudaRegistradosMinor,cuotasPendientesMesMinor,flujoRealizadoMinor,flujoMinor:flujoProyectadoMesMinor},caja:{saldoLiquidoMinor:pat.liquidezMinor,comprometidoMinor:cuotasPendientesMesMinor,disponibleDespuesCompromisosMinor},patrimonio:{netoMinor:pat.patrimonioFinancieroNetoMinor,deudaTotalMinor:pat.pasivosMinor,liquidezMinor:pat.liquidezMinor,cuentasPorCobrarMinor:pat.cuentasPorCobrarMinor},proximaObligacion:proxima?{id:proxima._id,concepto:proxima.concepto,montoMinor:Math.min(proxima.cuotaMinor||proxima.saldoMinor,proxima.saldoMinor),fecha:proxima.fechaVencimiento}:null,decisiones:decisiones.slice(0,5),explicaciones,fuente:"ledger_personal_canonico"};
}
module.exports={obtener,cuotaDelPeriodo,gastoAfectaCaja,resolverSaldoAsesor,calcularDisponibleHoy,calcularFlujoMes,_fechas:{partesColombia,monthStart,nextMonth,fechaCivilColombia,siguienteFechaRecurrente}};
