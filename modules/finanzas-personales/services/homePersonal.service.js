"use strict";
const Transaccion=require("../models/TransaccionPersonal");
const Prestamo=require("../models/prestamoPersonal.model");
const DeudaPersonal=require("../models/DeudaPersonal");
const {pagoExigible}=require("./tarjetaCreditoPersonal.service");
const patrimonio=require("./patrimonioPersonal.service");
const Calendario=require("../models/calendarioFinanciero.model");
const truth=require("./financialTruth.service");
const {maximoGastoHoyConGmf}=require("./dineroExactoV81.service");
const {periodoRecurrenteColombia}=require("./vinculoRecurrenteV81.service");

function partesColombia(d=new Date()){const p=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);const v=Object.fromEntries(p.map(x=>[x.type,x.value]));return{y:Number(v.year),m:Number(v.month),d:Number(v.day)};}
function inicioDiaColombiaUTC(y,m,d){return new Date(Date.UTC(y,m-1,d,5,0,0,0));}
function monthStart(d=new Date()){const p=partesColombia(d);return inicioDiaColombiaUTC(p.y,p.m,1);}
function nextMonth(d=new Date()){const p=partesColombia(d),y=p.m===12?p.y+1:p.y,m=p.m===12?1:p.m+1;return inicioDiaColombiaUTC(y,m,1);}
function diasEnMesUTC(y,m){return new Date(Date.UTC(y,m,0)).getUTCDate();}
function fechaCivilColombia(y,m,d){return inicioDiaColombiaUTC(y,m,Math.min(d,diasEnMesUTC(y,m)));}
function siguienteFechaRecurrente(tx,now){
 if(!tx||tx.tipo!=="INGRESO"||!tx.recurrente||tx.frecuencia==="NINGUNA")return null;
 const base=new Date(tx.fecha);if(Number.isNaN(base.getTime()))return null;
 const b=partesColombia(base),n=partesColombia(now);
 // Saltar directamente al próximo vencimiento, aunque el ingreso tenga muchos años.
 // Se usan fechas civiles de Bogotá en UTC para evitar deriva por horas o DST.
 const periodoDias=tx.frecuencia==="DIARIA"?1:
  tx.frecuencia==="SEMANAL"?7:
  tx.frecuencia==="QUINCENAL"?15:null;
 if(periodoDias){
  const inicio=Date.UTC(b.y,b.m-1,b.d);
  const hoy=Date.UTC(n.y,n.m-1,n.d);
  const transcurridos=Math.floor((hoy-inicio)/86400000);
  const pasos=transcurridos>=0?Math.floor(transcurridos/periodoDias)+1:0;
  const siguiente=new Date(inicio+pasos*periodoDias*86400000);
  return fechaCivilColombia(siguiente.getUTCFullYear(),siguiente.getUTCMonth()+1,siguiente.getUTCDate());
 }
 if(tx.frecuencia==="MENSUAL"){
  // Se calcula por diferencia de meses, siempre anclada al día original.
  // Ej.: día 31 -> 28/29 de febrero -> vuelve al 31 en marzo.
  let meses=Math.max(0,(n.y-b.y)*12+n.m-b.m);
  const candidato=(offset)=>{
   const fecha=new Date(Date.UTC(b.y,b.m-1+offset,1));
   return fechaCivilColombia(fecha.getUTCFullYear(),fecha.getUTCMonth()+1,b.d);
  };
  let proxima=candidato(meses);
  if(proxima<=now)proxima=candidato(++meses);
  return proxima;
 }
 if(tx.frecuencia==="ANUAL"){
  // El 29 de febrero reaparece en el siguiente año bisiesto, no se fija al 28.
  let anios=Math.max(0,n.y-b.y);
  const candidato=(offset)=>fechaCivilColombia(b.y+offset,b.m,b.d);
  let proxima=candidato(anios);
  if(proxima<=now)proxima=candidato(++anios);
  return proxima;
 }
 return null;
}
// Una cuota no registrada (0 por defecto en Mongo) NO significa saldo total exigible.
// Excepción: pago único expresamente confirmado con vencimiento registrado.
// Si una recurrencia vence hoy, no se presupone pagada ni se resta dos veces.
// Devuelve booleano: el motor de decisión exigirá confirmación del pago.
function gastoRecurrenteVenceHoy(tx,now){
 if(!tx||tx.tipo!=="GASTO"||!tx.recurrente||!(now instanceof Date)||Number.isNaN(now.getTime()))return false;
 const p=partesColombia(now);
 const inicio=fechaCivilColombia(p.y,p.m,p.d);
 const previa=new Date(inicio.getTime()-1);
 const proxima=siguienteFechaRecurrente({...tx,tipo:"INGRESO"},previa);
 return Boolean(proxima&&proxima.getTime()===inicio.getTime());
}
function sumarAbonosRecurrentesPeriodo({origenId,inicio,fin,pagos}){
 if(!origenId||!(inicio instanceof Date)||!(fin instanceof Date)||
    !Number.isFinite(inicio.getTime())||!Number.isFinite(fin.getTime())||inicio>=fin||
    !Array.isArray(pagos))throw new TypeError("Período y pagos recurrentes inválidos");
 let total=0;
 for(const p of pagos){
  if(String(p.recurrenteOrigenId)!==String(origenId))continue;
  const fecha=new Date(p.fecha);
  if(!Number.isFinite(fecha.getTime())||fecha<inicio||fecha>=fin)continue;
  if(!Number.isSafeInteger(p.montoMinor)||p.montoMinor<=0)
   throw new TypeError("Abono recurrente inválido");
  total+=p.montoMinor;
  if(!Number.isSafeInteger(total))throw new RangeError("Abonos recurrentes exceden rango seguro");
 }
 return total;
}
function gastoRecurrenteHoySinConfirmacion(g,now,pagosVinculadosMinor=0){
 if(!Number.isSafeInteger(pagosVinculadosMinor)||pagosVinculadosMinor<0)
  throw new TypeError("Pagos vinculados requieren monto entero seguro no negativo");
 if(!gastoRecurrenteVenceHoy(g,now))return false;
 if(Number.isSafeInteger(g.montoMinor)&&g.montoMinor>0&&pagosVinculadosMinor>=g.montoMinor)
  return false;
 const registrado=new Date(g.fecha);
 if(Number.isNaN(registrado.getTime()))return true;
 const diaRegistro=partesColombia(registrado),diaHoy=partesColombia(now);
 // Solo el MISMO evento de ledger con fecha de hoy prueba un registro actual.
 return !(diaRegistro.y===diaHoy.y&&diaRegistro.m===diaHoy.m&&diaRegistro.d===diaHoy.d&&
  g.estado!=="ANULADA"&&g.impactoCaja!==false);
}
function cuotaExigibleMinor(deuda){
 if(!deuda||!Number.isSafeInteger(deuda.saldoMinor)||deuda.saldoMinor<=0)return 0;
 if(Number.isSafeInteger(deuda.cuotaMinor)&&deuda.cuotaMinor>0)
  return Math.min(deuda.cuotaMinor,deuda.saldoMinor);
 if(deuda.periodicidad==="UNICA"&&deuda.periodicidadConfirmada===true&&deuda.fechaVencimiento)
  return deuda.saldoMinor;
 return 0;
}
function cuotaDelPeriodo(deuda,inicio,fin){
 if(!deuda||deuda.direccion!=="POR_PAGAR"||!["ACTIVO","VENCIDO"].includes(deuda.estado)||deuda.saldoMinor<=0)return 0;
 if(!deuda.fechaVencimiento)return 0;
 const venc=new Date(deuda.fechaVencimiento);
 if(venc<inicio||venc>=fin)return 0;
 return cuotaExigibleMinor(deuda);
}
function montoPagoDeudaMinor(tx){
 if(!tx||tx.tipo!=="PAGO_DEUDA")throw new TypeError("Se requiere pago de deuda");
 const monto=tx.montoPagadoRealMinor===null||tx.montoPagadoRealMinor===undefined
  ?tx.montoMinor:tx.montoPagadoRealMinor;
 if(!Number.isSafeInteger(monto)||monto<=0)throw new TypeError("Pago real inválido");
 return monto;
}
function saldoCuotaPendienteMinor(deuda,abonadoMinor=0){
 const cuota=cuotaExigibleMinor(deuda);
 if(!Number.isSafeInteger(abonadoMinor)||abonadoMinor<0)
  throw new TypeError("Abono debe ser entero seguro no negativo");
 return Math.max(0,cuota-abonadoMinor);
}
function seleccionarVencimientosAtrasados(deudas,now){
 if(!Array.isArray(deudas)||!(now instanceof Date)||Number.isNaN(now.getTime()))
  throw new TypeError("Vencimientos requieren lista y fecha válida");
 return deudas.filter(d=>{
  if(!d||!d.fechaVencimiento||!Number.isSafeInteger(d.saldoMinor)||d.saldoMinor<=0)return false;
  if(!["ACTIVO","VENCIDO"].includes(d.estado)||d.direccion!=="POR_PAGAR")return false;
  const fecha=new Date(d.fechaVencimiento);
  return !Number.isNaN(fecha.getTime())&&fecha<now;
 });
}
function gastoAfectaCaja(tx){return Boolean(tx&&tx.tipo==="GASTO"&&tx.medioPago!=="CREDITO");}
function resolverSaldoAsesor(pat){
 const derivado=pat&&pat.hayMovimientosLedger&&Number.isSafeInteger(pat.saldoDerivadoLedgerMinor);
 if(pat&&pat.saldoVerificado)return{montoMinor:pat.liquidezMinor,conocido:true,confiabilidad:"VERIFICADO",fuente:pat.fuenteLiquidez||"CUENTAS",requiereReconciliacion:false};
 if(derivado)return{montoMinor:Math.max(0,pat.saldoDerivadoLedgerMinor),conocido:true,confiabilidad:"RECONSTRUIDO_SIN_ANCLA",fuente:"LEDGER_DERIVADO",requiereReconciliacion:true};
 return{montoMinor:Number(pat?.liquidezMinor||0),conocido:false,confiabilidad:"NO_VERIFICADO",fuente:pat?.fuenteLiquidez||"NO_VERIFICADO",requiereReconciliacion:true};
}
function calcularDisponibleHoy({saldoMinor,gastosFijosAntesProximoIngresoMinor=0}){for(const n of [saldoMinor,gastosFijosAntesProximoIngresoMinor])if(!Number.isSafeInteger(n)||n<0)throw new TypeError("Disponible Hoy requiere enteros seguros no negativos");const colchonMinor=Math.floor(saldoMinor/10);const baseMinor=saldoMinor-gastosFijosAntesProximoIngresoMinor-colchonMinor;if(!Number.isSafeInteger(baseMinor))throw new RangeError("Disponible Hoy excede el rango monetario seguro");return{colchonMinor,baseMinor,disponibleHoyMinor:Math.max(0,baseMinor),estaEnRojo:baseMinor<0};}
function calcularEscenarioGmfGravado({saldoMinor,gastosFijosAntesProximoIngresoMinor=0}){
 const base=calcularDisponibleHoy({saldoMinor,gastosFijosAntesProximoIngresoMinor});
 const escenario=maximoGastoHoyConGmf({
  saldoCentavos:BigInt(saldoMinor),
  porVencer7dCentavos:BigInt(gastosFijosAntesProximoIngresoMinor),
  gravado:true
 });
 const gastoMaximoSiGravadoMinor=Number(escenario.gastoMaximoCentavos);
 const reservaGmfSiGravadoMinor=Number(escenario.reserva4x1000Centavos);
 if(!Number.isSafeInteger(gastoMaximoSiGravadoMinor)||!Number.isSafeInteger(reservaGmfSiGravadoMinor))
  throw new RangeError("Escenario GMF excede rango monetario seguro");
 if(gastoMaximoSiGravadoMinor+reservaGmfSiGravadoMinor>base.disponibleHoyMinor)
  throw new Error("Escenario GMF supera disponible");
 return {gastoMaximoSiGravadoMinor,reservaGmfSiGravadoMinor};
}
function crearDecisionDisponibleHoy({disponibleHoyMinor,aptoParaDisponibleHoy,corte}){
 if(!Number.isSafeInteger(disponibleHoyMinor)||disponibleHoyMinor<0)
  throw new TypeError("Disponible Hoy requiere un importe seguro no negativo");
 if(typeof aptoParaDisponibleHoy!=="boolean")
  throw new TypeError("Estado de conciliación obligatorio");
 // Nunca publicar una recomendación monetaria positiva si falta conciliación.
 return truth.decision({
  montoMinor:aptoParaDisponibleHoy?disponibleHoyMinor:0,
  fuente:aptoParaDisponibleHoy?"REGLA_DISPONIBLE_HOY":"SALDO_PENDIENTE_CONCILIACION",
  corte,confianza:aptoParaDisponibleHoy?"ALTA":"NO_VERIFICADO",
  requiereReconciliacion:!aptoParaDisponibleHoy
 });
}
function calcularFlujoMes({ingresosMinor=0,gastosMinor=0,pagosDeudaRegistradosMinor=0,cuotasVencenMesMinor=0}){for(const n of [ingresosMinor,gastosMinor,pagosDeudaRegistradosMinor,cuotasVencenMesMinor])if(!Number.isSafeInteger(n)||n<0)throw new TypeError("Los importes del flujo deben ser enteros seguros no negativos");const cuotasPendientesMesMinor=Math.max(0,cuotasVencenMesMinor-pagosDeudaRegistradosMinor);const flujoRealizadoMinor=ingresosMinor-gastosMinor-pagosDeudaRegistradosMinor;const flujoProyectadoMesMinor=flujoRealizadoMinor-cuotasPendientesMesMinor;if(!Number.isSafeInteger(flujoRealizadoMinor)||!Number.isSafeInteger(flujoProyectadoMesMinor))throw new RangeError("El flujo calculado excede el rango monetario seguro");return{cuotasPendientesMesMinor,flujoRealizadoMinor,flujoProyectadoMesMinor};}

async function obtener(usuarioId,now=new Date()){
 const inicio=monthStart(now),fin=nextMonth(now);
 const [tx,deudas,tarjetas,pat,ingresosRecurrentes,calendariosIngreso,cobros]=await Promise.all([
  Transaccion.find({usuarioId,fecha:{$gte:inicio,$lte:now},tipo:{$in:["INGRESO","GASTO","PAGO_DEUDA","COBRO_PRESTAMO"]},estado:{$ne:"ANULADA"}}).lean(),
  Prestamo.find({usuarioId,direccion:"POR_PAGAR",estado:{$in:["ACTIVO","VENCIDO"]}}).sort({fechaVencimiento:1,createdAt:1}).lean(),
  DeudaPersonal.find({usuarioId,tipo:"TARJETA_CREDITO",activa:true,saldoMinor:{$gt:0}}).lean(),
  patrimonio.snapshot(usuarioId),
  Transaccion.find({usuarioId,tipo:"INGRESO",recurrente:true,frecuencia:{$ne:"NINGUNA"},estado:{$ne:"ANULADA"},fecha:{$lte:now}}).sort({fecha:-1}).limit(100).lean(),
  Calendario.find({usuarioId,tipo:"INGRESO",activo:true}).lean(),
  Prestamo.find({usuarioId,direccion:"POR_COBRAR",estado:{$in:["ACTIVO","VENCIDO"]},saldoMinor:{$gt:0}}).sort({fechaVencimiento:1}).lean()
 ]);
 const ingresosMinor=tx.filter(x=>x.tipo==="INGRESO").reduce((s,x)=>s+x.montoMinor,0);
 const cobrosRecibidosMinor=tx.filter(x=>x.tipo==="COBRO_PRESTAMO").reduce((s,x)=>s+x.montoMinor,0);
 const gastosConsumoMinor=tx.filter(x=>x.tipo==="GASTO").reduce((s,x)=>s+x.montoMinor,0);
 const gastosMinor=tx.filter(gastoAfectaCaja).reduce((s,x)=>s+x.montoMinor,0);
 const pagosDeudaRegistradosMinor=tx.filter(x=>x.tipo==="PAGO_DEUDA"&&x.impactoCaja!==false).reduce((s,x)=>s+montoPagoDeudaMinor(x),0);
 const deudaTotalMinor=deudas.reduce((s,x)=>s+x.saldoMinor,0);
 const cuotasVencenMesMinor=deudas.reduce((s,x)=>s+cuotaDelPeriodo(x,inicio,fin),0);
 // Una cuota ya pagada en el ledger no puede descontarse otra vez como compromiso.
 const pagosPorDeuda=new Map();
 for(const t of tx){
  if(t.tipo!=="PAGO_DEUDA"||!t.prestamoId)continue;
  const id=String(t.prestamoId);
  pagosPorDeuda.set(id,(pagosPorDeuda.get(id)||0)+montoPagoDeudaMinor(t));
 }
 const cuotasPendientesMesMinor=deudas.reduce((total,d)=>total+Math.max(0,cuotaDelPeriodo(d,inicio,fin)-(pagosPorDeuda.get(String(d._id))||0)),0);
 const flujoOperativoMinor=ingresosMinor-gastosMinor-pagosDeudaRegistradosMinor;
 const flujoOperativoProyectadoMinor=flujoOperativoMinor-cuotasPendientesMesMinor;
 const flujoRealizadoMinor=flujoOperativoMinor+cobrosRecibidosMinor;
 const balancePeriodoMinor=ingresosMinor-gastosConsumoMinor;
 const gastosSinSalidaCajaMinor=gastosConsumoMinor-gastosMinor;
 const diferenciaBalanceFlujoMinor=gastosSinSalidaCajaMinor-pagosDeudaRegistradosMinor+cobrosRecibidosMinor;
 if(balancePeriodoMinor+diferenciaBalanceFlujoMinor!==flujoRealizadoMinor)throw new Error("Conciliación de balance y flujo inconsistente");
 const flujoProyectadoMesMinor=flujoOperativoProyectadoMinor+cobrosRecibidosMinor;
 const calendarioProximos=calendariosIngreso.map(x=>{const p=partesColombia(now);let y=p.y,m=p.m,d=Math.min(x.diaMes,diasEnMesUTC(y,m));let fecha=fechaCivilColombia(y,m,d);if(fecha<=now){m++;if(m>12){m=1;y++;}d=Math.min(x.diaMes,diasEnMesUTC(y,m));fecha=fechaCivilColombia(y,m,d);}return{tx:{montoMinor:x.montoMinor,concepto:x.concepto},fecha};});
 const proximosIngresos=(calendarioProximos.length?calendarioProximos:ingresosRecurrentes.map(x=>({tx:x,fecha:siguienteFechaRecurrente(x,now)}))).filter(x=>x.fecha).sort((a,b)=>a.fecha-b.fecha);
 const proximoIngreso=proximosIngresos[0]||null;
 const limiteCompromisos=proximoIngreso?proximoIngreso.fecha:fin;
 const pHoy=partesColombia(now);
 const vencimientoTarjeta=t=>{let y=pHoy.y,m=pHoy.m,d=Math.min(Number(t.diaPago),diasEnMesUTC(y,m));let fecha=fechaCivilColombia(y,m,d);if(fecha<now){m++;if(m>12){m=1;y++;}fecha=fechaCivilColombia(y,m,Math.min(Number(t.diaPago),diasEnMesUTC(y,m)));}return fecha;};
 const compromisosTarjeta=tarjetas.map(t=>({concepto:"Pago tarjeta "+t.nombre,montoMinor:pagoExigible(t),fecha:vencimientoTarjeta(t),deudaId:String(t._id)})).filter(x=>x.montoMinor>0);
 // Un abono parcial NO cancela automáticamente el compromiso restante.
 const pagoAplicado=d=>pagosPorDeuda.get(String(d._id))||0;
 const compromisosAntesIngreso=deudas.filter(d=>d.fechaVencimiento&&new Date(d.fechaVencimiento)>=now&&new Date(d.fechaVencimiento)<limiteCompromisos).map(d=>({concepto:d.concepto,montoMinor:saldoCuotaPendienteMinor(d,pagoAplicado(d)),fecha:d.fechaVencimiento})); for(let i=compromisosAntesIngreso.length-1;i>=0;i--)if(compromisosAntesIngreso[i].montoMinor<=0)compromisosAntesIngreso.splice(i,1); compromisosAntesIngreso.push(...compromisosTarjeta.filter(x=>x.fecha>=now&&x.fecha<limiteCompromisos));
 const cuotasSinDefinir=deudas.filter(d=>d.fechaVencimiento&&
  new Date(d.fechaVencimiento)>=now&&new Date(d.fechaVencimiento)<limiteCompromisos&&
  d.saldoMinor>0&&cuotaExigibleMinor(d)===0);
 // Vencimientos anteriores siguen requiriendo verificación; no se presumen pagados.
 // No volver a descontar automáticamente una deuda histórica sin conciliar pagos.
 const vencimientosAtrasados=seleccionarVencimientosAtrasados(deudas,now);
 const gastosFijosRecurrentes=await Transaccion.find({usuarioId,tipo:"GASTO",recurrente:true,frecuencia:{$ne:"NINGUNA"},estado:{$ne:"ANULADA"},fecha:{$lte:now}}).sort({fecha:-1}).limit(100).lean();
 for(const g of gastosFijosRecurrentes){const fecha=siguienteFechaRecurrente({...g,tipo:"INGRESO"},now);if(fecha&&fecha<limiteCompromisos)compromisosAntesIngreso.push({concepto:g.concepto,montoMinor:g.montoMinor,fecha});}
 // Conciliar el mismo ciclo definido por el validador de escritura, no solo
 // la fecha de hoy: un abono ayer también puede cubrir la cuota de hoy.
 const vencenHoy=gastosFijosRecurrentes.filter(g=>gastoRecurrenteVenceHoy(g,now));
 const periodosHoy=vencenHoy.map(g=>({
  gasto:g,...periodoRecurrenteColombia({fechaOrigen:g.fecha,fechaPago:now,frecuencia:g.frecuencia})
 }));
 const desde=periodosHoy.length?new Date(Math.min(...periodosHoy.map(x=>x.inicio.getTime()))):null;
 const pagosVinculados=desde?await Transaccion.find({
  usuarioId,tipo:"GASTO",recurrenteOrigenId:{$in:vencenHoy.map(x=>x._id)},
  estado:{$ne:"ANULADA"},impactoCaja:{$ne:false},
  fecha:{$gte:desde,$lte:now}
 }).select("recurrenteOrigenId montoMinor fecha").lean():[];
 const gastosRecurrentesHoySinConciliar=periodosHoy.filter(({gasto,inicio,fin})=>{
  const total=sumarAbonosRecurrentesPeriodo({
   origenId:gasto._id,inicio,fin,pagos:pagosVinculados
  });
  return gastoRecurrenteHoySinConfirmacion(gasto,now,total);
 }).map(x=>x.gasto);
 const gastosFijosAntesProximoIngresoMinor=compromisosAntesIngreso.reduce((s,x)=>s+x.montoMinor,0);
 const saldoEstado=resolverSaldoAsesor(pat);
 const saldoAsesorMinor=saldoEstado.montoMinor;
 const {colchonMinor,baseMinor:disponibleBaseMinor,disponibleHoyMinor,estaEnRojo}=calcularDisponibleHoy({saldoMinor:saldoAsesorMinor,gastosFijosAntesProximoIngresoMinor});
 const {gastoMaximoSiGravadoMinor,reservaGmfSiGravadoMinor}=calcularEscenarioGmfGravado({
  saldoMinor:saldoAsesorMinor,gastosFijosAntesProximoIngresoMinor
 });
 const aptoParaDisponibleHoy=saldoEstado.confiabilidad==="VERIFICADO"&&!saldoEstado.requiereReconciliacion&&cuotasSinDefinir.length===0&&vencimientosAtrasados.length===0&&gastosRecurrentesHoySinConciliar.length===0;
 const disponibleDespuesCompromisosMinor=pat.saldoVerificado?pat.liquidezMinor-cuotasPendientesMesMinor:null;
 const proxima=deudas.find(x=>x.fechaVencimiento&&new Date(x.fechaVencimiento)>=now&&saldoCuotaPendienteMinor(x,pagoAplicado(x))>0)||null;
 const fmt=n=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(Math.round(Number(n||0)));
 const activosDetalle=(pat.activos||[]).map(x=>({nombre:x.nombre,tipo:x.tipo,valorMinor:x.valorMinor}));
 const deudasDetalle=deudas.map(x=>({concepto:x.concepto,principalMinor:x.principalMinor,saldoMinor:x.saldoMinor,abonadoMinor:Math.max(0,(x.principalMinor||0)-(x.saldoMinor||0)),cuotaMinor:x.cuotaMinor||0,periodicidad:x.periodicidad,periodicidadConfirmada:x.periodicidadConfirmada,fechaVencimiento:x.fechaVencimiento}));
 const explicaciones={
  escenarioGmf:{
   titulo:"Simulación: gasto si aplica 4×1.000",
   calculo:aptoParaDisponibleHoy
    ?fmt(gastoMaximoSiGravadoMinor)+" de gasto + "+fmt(reservaGmfSiGravadoMinor)+" de GMF, dentro de "+fmt(disponibleHoyMinor)+" de disponible"
    :"Saldo u obligación sin conciliar: no se calcula gasto máximo autorizado",
   origen:{escenario:"SALIDA_TOTAL_GRAVADA",baseDisponibleMinor:aptoParaDisponibleHoy?disponibleHoyMinor:null,
    gastoMaximoSiGravadoMinor:aptoParaDisponibleHoy?gastoMaximoSiGravadoMinor:null,
    reservaGmfSiGravadoMinor:aptoParaDisponibleHoy?reservaGmfSiGravadoMinor:null},
   significado:"Simulación conservadora: supone que todo el gasto está gravado. No confirma que la cuenta tenga o no exención de GMF y no sustituye las condiciones del banco.",
   accion:!aptoParaDisponibleHoy?"Concilia primero el saldo real."
    :"Verifica con tu entidad financiera si tu movimiento paga GMF antes de decidir cuánto gastar."
  },
  disponibleHoy:{titulo:aptoParaDisponibleHoy?"Puedes gastar hoy":"Disponible Hoy pendiente de conciliación",calculo:aptoParaDisponibleHoy?fmt(saldoAsesorMinor)+" − "+fmt(gastosFijosAntesProximoIngresoMinor)+" − "+fmt(colchonMinor)+" = "+fmt(disponibleBaseMinor):"Sin saldo conciliado no se autoriza un monto para gastar",origen:{saldoRealMinor:saldoAsesorMinor,gastosFijosAntesProximoIngresoMinor,colchonMinor,proximoIngreso:proximoIngreso?{fecha:proximoIngreso.fecha,montoMinor:proximoIngreso.tx.montoMinor,concepto:proximoIngreso.tx.concepto}:null,compromisosAntesIngreso},significado:!aptoParaDisponibleHoy?"No hay autorización de gasto: concilia saldo y confirma cuotas pendientes.":estaEnRojo?"Estás en rojo: después de separar compromisos y el colchón no queda dinero disponible para gasto libre.":"Este es el máximo registrado que puedes gastar hoy sin tocar compromisos ni el colchón del 10%.",accion:!aptoParaDisponibleHoy?"Confirma el saldo real y las cuotas pendientes antes de gastar.":estaEnRojo?"Hoy no aumentes gasto discrecional.":"No superes "+fmt(disponibleHoyMinor)+" entre gasto e impuestos; revisa la simulación del 4×1.000 si el movimiento está gravado."},
  disponible:{titulo:"Disponible después de compromisos",calculo:pat.saldoVerificado?fmt(pat.liquidezMinor)+" − "+fmt(cuotasPendientesMesMinor)+" = "+fmt(disponibleDespuesCompromisosMinor):"Liquidez no verificada: no puede calcularse un disponible confiable",origen:{liquidezMinor:pat.liquidezMinor,compromisosMinor:cuotasPendientesMesMinor},significado:!pat.saldoVerificado?"No se ha conciliado el saldo de caja. Esta cifra no debe utilizarse para tomar decisiones.":disponibleDespuesCompromisosMinor<0?"No significa que debas este valor hoy. Significa que la liquidez registrada no alcanza para cubrir los compromisos pendientes del mes.":"La liquidez registrada alcanza para cubrir los compromisos pendientes del mes.",accion:!pat.saldoVerificado?"Verifica el saldo de tus cuentas y los compromisos antes de gastar.":disponibleDespuesCompromisosMinor<0?"Necesitas aumentar liquidez o reducir/reprogramar compromisos por "+fmt(Math.abs(disponibleDespuesCompromisosMinor))+".":"Mantén reservado el dinero comprometido."},
  comprometido:{titulo:"Comprometido este mes",calculo:deudasDetalle.filter(x=>x.fechaVencimiento&&new Date(x.fechaVencimiento)>=inicio&&new Date(x.fechaVencimiento)<fin).map(x=>x.concepto+" "+fmt(cuotaExigibleMinor(x))).join(" + ")||fmt(0),origen:{compromisos:deudasDetalle},significado:"Son cuotas pendientes con vencimiento dentro del mes; no es el saldo total de tus deudas.",accion:"Reserva "+fmt(cuotasPendientesMesMinor)+" para los vencimientos del mes."},
  flujoRealizado:{titulo:"Flujo realizado",calculo:fmt(ingresosMinor)+" − "+fmt(gastosMinor)+" − "+fmt(pagosDeudaRegistradosMinor)+" = "+fmt(flujoRealizadoMinor),origen:{ingresosMinor,gastosMinor,pagosDeudaRegistradosMinor},significado:flujoRealizadoMinor>=0?"Hasta ahora has generado "+fmt(flujoRealizadoMinor)+" más de lo que ha salido de tu flujo registrado.":"Hasta ahora las salidas registradas superan los ingresos en "+fmt(Math.abs(flujoRealizadoMinor))+".",accion:"Este indicador describe lo ocurrido; no descuenta cuotas futuras."},
  flujoProyectado:{titulo:"Flujo proyectado del mes",calculo:fmt(flujoRealizadoMinor)+" − "+fmt(cuotasPendientesMesMinor)+" = "+fmt(flujoProyectadoMesMinor),origen:{flujoRealizadoMinor,cuotasPendientesMesMinor},significado:flujoProyectadoMesMinor<0?"No significa que hayas perdido "+fmt(Math.abs(flujoProyectadoMesMinor))+". Al reservar los compromisos pendientes, el mes quedaría proyectado en negativo.":"Después de reservar los compromisos pendientes, el flujo proyectado permanece no negativo.",accion:flujoProyectadoMesMinor<0?"Para terminar el mes en $0 necesitas generar "+fmt(Math.abs(flujoProyectadoMesMinor))+" adicionales o reducir/reprogramar compromisos por ese valor.":"No hay brecha proyectada con los datos registrados."},
  patrimonio:{titulo:"Patrimonio neto registrado",calculo:fmt(pat.activosTotalesMinor)+" + "+fmt(pat.cuentasPorCobrarMinor)+" − "+fmt(pat.pasivosMinor)+" = "+fmt(pat.patrimonioFinancieroNetoMinor),origen:{activos:activosDetalle,cuentasPorCobrarMinor:pat.cuentasPorCobrarMinor,deudas:deudasDetalle},significado:"Es el valor neto registrado de activos y derechos menos deudas. No es dinero disponible para gastar.",accion:"Actualiza valores de activos cuando cambien para mantener el patrimonio preciso."},
  deuda:{titulo:"Deuda registrada",calculo:deudasDetalle.map(x=>x.concepto+" "+fmt(x.saldoMinor)).join(" + ")+" = "+fmt(deudaTotalMinor),origen:{deudas:deudasDetalle},significado:"Es el saldo pendiente total. GRUK solo lleva al flujo mensual las cuotas que vencen en el mes, no toda la deuda.",accion:"Cumple las cuotas según sus vencimientos; el saldo total permanece en patrimonio hasta ser pagado."}
 };
 const decisiones=[];
 for(const cobro of cobros){if(cobro.fechaVencimiento&&new Date(cobro.fechaVencimiento)<=now)decisiones.push({tipo:"COBRO",prioridad:"ALTA",titulo:"Cobro pendiente: "+cobro.contraparte,detalle:"Tienes dinero por cobrar. No se cuenta como caja hasta recibirlo.",montoMinor:cobro.saldoMinor,fecha:cobro.fechaVencimiento,accion:"COBRAR"});}
 if(gastosRecurrentesHoySinConciliar.length>0)decisiones.unshift({
  tipo:"CAJA",prioridad:"ALTA",titulo:"Gasto recurrente de hoy por confirmar",
  detalle:"Hay un gasto fijo previsto para hoy. Confirma si ya se pagó antes de usar Disponible Hoy.",
  montoMinor:null,accion:"CONFIRMAR_GASTO_RECURRENTE"
 });
 if(vencimientosAtrasados.length>0)decisiones.unshift({
  tipo:"OBLIGACION",prioridad:"ALTA",titulo:"Vencimiento atrasado por conciliar",
  detalle:"Hay deudas registradas como activas o vencidas con fecha anterior a hoy. Confirma pagos y saldo pendiente antes de autorizar gasto.",
  montoMinor:null,accion:"CONCILIAR_VENCIMIENTO"
 });
 if(cuotasSinDefinir.length>0)decisiones.unshift({
  tipo:"OBLIGACION",prioridad:"ALTA",titulo:"Cuota pendiente de confirmar",
  detalle:"Hay una deuda con vencimiento antes del próximo ingreso, pero no tiene cuota registrada. Confirma el valor antes de gastar.",
  montoMinor:null,accion:"CONFIRMAR_CUOTA"
 });
 if(proxima){const cuota=saldoCuotaPendienteMinor(proxima,pagoAplicado(proxima));if(cuota>0)decisiones.push({tipo:"OBLIGACION",prioridad:"ALTA",titulo:"Próximo compromiso: "+proxima.concepto,detalle:"Reserva la cuota pendiente antes de aumentar gasto discrecional.",montoMinor:cuota,fecha:proxima.fechaVencimiento,accion:"REVISAR_DEUDA"});}
 if(pat.saldoVerificado&&disponibleDespuesCompromisosMinor<0)decisiones.unshift({tipo:"CAJA",prioridad:"CRITICA",titulo:"Caja insuficiente para compromisos registrados",detalle:"La liquidez registrada no cubre las cuotas pendientes que vencen este mes.",montoMinor:Math.abs(disponibleDespuesCompromisosMinor),accion:"PROTEGER_CAJA"});
 else if(cuotasPendientesMesMinor>0)decisiones.push({tipo:"CAJA",prioridad:"MEDIA",titulo:"Dinero comprometido este mes",detalle:"Esta cifra corresponde solo a cuotas pendientes con vencimiento dentro del mes, no al saldo total de tus deudas.",montoMinor:cuotasPendientesMesMinor,accion:"RESERVAR"});
 if(flujoProyectadoMesMinor<0)decisiones.unshift({tipo:"FLUJO",prioridad:"CRITICA",titulo:"El flujo proyectado del mes es negativo",detalle:"Ingresos del mes menos gastos registrados, pagos de deuda ya realizados y cuotas pendientes que vencen este mes. El saldo total de la deuda no se descuenta del flujo mensual.",montoMinor:flujoProyectadoMesMinor,accion:"REVISAR_FLUJO"});
 const verdadFinanciera={saldo:saldoEstado.confiabilidad==="VERIFICADO"?truth.hecho({montoMinor:saldoAsesorMinor,fuente:saldoEstado.fuente,corte:now,confianza:"VERIFICADO"}):truth.inferencia({montoMinor:saldoAsesorMinor,fuente:saldoEstado.fuente,corte:now,confianza:saldoEstado.conocido?"MEDIA":"NO_VERIFICADO",requiereReconciliacion:true}),flujoMes:truth.hecho({montoMinor:flujoRealizadoMinor,fuente:"LEDGER_PERSONAL",corte:now,confianza:"ALTA"}),flujoProyectado:truth.proyeccion({montoMinor:flujoProyectadoMesMinor,fuente:"LEDGER_MAS_COMPROMISOS",corte:now,confianza:saldoEstado.conocido?"MEDIA":"BAJA"}),disponibleHoy:crearDecisionDisponibleHoy({disponibleHoyMinor,aptoParaDisponibleHoy,corte:now})};
 return{corte:now,moneda:"COP",verdadFinanciera,asesor:{gastosRecurrentesHoySinConciliar:gastosRecurrentesHoySinConciliar.map(g=>({id:String(g._id),concepto:g.concepto,montoMinor:g.montoMinor})),vencimientosAtrasados:vencimientosAtrasados.map(d=>({id:String(d._id),concepto:d.concepto,fecha:d.fechaVencimiento})),cuotasSinDefinir:cuotasSinDefinir.map(d=>({id:String(d._id),concepto:d.concepto,fecha:d.fechaVencimiento})),disponibleHoyMinor:aptoParaDisponibleHoy?disponibleHoyMinor:null,gastoMaximoSiGravadoMinor:aptoParaDisponibleHoy?gastoMaximoSiGravadoMinor:null,reservaGmfSiGravadoMinor:aptoParaDisponibleHoy?reservaGmfSiGravadoMinor:null,escenarioGmf:"SIMULACION_GRAVADO_NO_VERIFICADO",aptoParaDisponibleHoy,colchonMinor,estaEnRojo:aptoParaDisponibleHoy?estaEnRojo:null,formula:"saldo_real - gastos_fijos_antes_proximo_ingreso - colchon_10pct",saldoRealMinor:saldoAsesorMinor,gastosFijosAntesProximoIngresoMinor,proximoIngreso:proximoIngreso?{fecha:proximoIngreso.fecha,montoMinor:proximoIngreso.tx.montoMinor,concepto:proximoIngreso.tx.concepto}:null,proximoIngresoConocido:Boolean(proximoIngreso),compromisosAntesProximoIngreso:compromisosAntesIngreso,saldoRealConocido:saldoEstado.conocido,saldoRequiereReconciliacion:saldoEstado.requiereReconciliacion,saldoDerivadoLedger:saldoEstado.confiabilidad==="RECONSTRUIDO_SIN_ANCLA",saldoConfiabilidad:saldoEstado.confiabilidad,fuenteSaldo:saldoEstado.fuente,fuentesSaldo:(pat.cuentas||[]).map(x=>({nombre:x.nombre,saldoMinor:x.saldoMinor}))},mes:{balancePeriodoMinor,diferenciaBalanceFlujoMinor,gastosSinSalidaCajaMinor,conciliacionBalanceFlujo:{balancePeriodoMinor,gastosSinSalidaCajaMinor,pagosDeudaRegistradosMinor,cobrosRecibidosMinor,flujoRealizadoMinor,diferenciaBalanceFlujoMinor},ingresosMinor,cobrosCuentasPorCobrarMinor:cobrosRecibidosMinor,gastosMinor,gastosConsumoMinor,pagosDeudaRegistradosMinor,cuotasPendientesMesMinor,flujoRealizadoMinor,flujoMinor:flujoProyectadoMesMinor},caja:{saldoLiquidoMinor:pat.liquidezMinor,comprometidoMinor:cuotasPendientesMesMinor,disponibleDespuesCompromisosMinor,liquidezConciliada:Boolean(pat.saldoVerificado)},patrimonio:{netoMinor:pat.patrimonioFinancieroNetoMinor,deudaTotalMinor:pat.pasivosMinor,liquidezMinor:pat.liquidezMinor,cuentasPorCobrarMinor:pat.cuentasPorCobrarMinor},proximaObligacion:proxima?{id:proxima._id,concepto:proxima.concepto,montoMinor:saldoCuotaPendienteMinor(proxima,pagoAplicado(proxima)),fecha:proxima.fechaVencimiento}:null,decisiones:decisiones.slice(0,5),explicaciones,fuente:"ledger_personal_canonico"};
}
module.exports={obtener,sumarAbonosRecurrentesPeriodo,gastoRecurrenteVenceHoy,gastoRecurrenteHoySinConfirmacion,seleccionarVencimientosAtrasados,saldoCuotaPendienteMinor,montoPagoDeudaMinor,cuotaDelPeriodo,gastoAfectaCaja,resolverSaldoAsesor,cuotaExigibleMinor,calcularDisponibleHoy,calcularEscenarioGmfGravado,crearDecisionDisponibleHoy,calcularFlujoMes,_fechas:{partesColombia,monthStart,nextMonth,fechaCivilColombia,siguienteFechaRecurrente}};
