"use strict";
const Prestamo=require("../../models/prestamoPersonal.model");const Reporte=require("../../models/reporteNeuronaPersonal.model");
function getRequiredEvents(){return["PAGO_DEUDA","INGRESO_DETECTADO"];}
function avalanche(deudas,extra){return [...deudas].sort((a,b)=>b.tasaMensualPct-a.tasaMensualPct||a.saldoMinor-b.saldoMinor).map((x,i)=>({creditoId:x._id,nombre:x.concepto,orden:i+1,pagoExtraSugeridoMinor:i===0?extra:0,tasaMensualPct:x.tasaMensualPct,saldoMinor:x.saldoMinor}));}
function snowball(deudas,extra){return [...deudas].sort((a,b)=>a.saldoMinor-b.saldoMinor||b.tasaMensualPct-a.tasaMensualPct).map((x,i)=>({creditoId:x._id,nombre:x.concepto,orden:i+1,pagoExtraSugeridoMinor:i===0?extra:0,tasaMensualPct:x.tasaMensualPct,saldoMinor:x.saldoMinor}));}
async function analyze(usuarioId,{ingresoMensual=0,pagoExtraDisponible=0,umbralCargaPct=35}={}){
 const c=await Prestamo.find({usuarioId,direccion:"POR_PAGAR",estado:"ACTIVO"}).lean();
 const saldo=c.reduce((a,x)=>a+x.saldoMinor,0),cuotas=c.reduce((a,x)=>a+(x.cuotaMinor||0),0),carga=ingresoMensual?cuotas/ingresoMensual*100:0;
 const estado=!ingresoMensual&&cuotas>0?"CRITICO":carga>umbralCargaPct?"ALERTA":"OK",hallazgos=[];
 if(estado!=="OK")hallazgos.push({tipo:"CARGA_DEUDA",evidencia:"La carga mensual de deuda requiere atención según los datos y el umbral configurado.",impacto_anual_estimado:cuotas*12,confianza:100});
 const reporte=await Reporte.create({usuarioId,neurona:"DEUDA",periodo:{desde:new Date(),hasta:new Date()},kpi_principal:{nombre:"Carga mensual de deuda",valor_actual:Number(carga.toFixed(2)),valor_objetivo:umbralCargaPct,estado},hallazgos,necesita_decision_de_cerebro:estado!=="OK"});
 return{reporte,estrategias:{avalancha:avalanche(c,pagoExtraDisponible),bolaDeNieve:snowball(c,pagoExtraDisponible)},saldoTotalMinor:saldo};
}
module.exports={getRequiredEvents,analyze,avalanche,snowball};
