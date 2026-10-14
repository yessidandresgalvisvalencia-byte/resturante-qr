"use strict";
function diagnosticarRiesgoCuotas({cuotas,disponibleHoyMinor=null,saldoVerificado=false,ingresoMensualLibreMinor=null,cuotasExistentesMinor=null}){
 if(!Array.isArray(cuotas)||cuotas.length===0||cuotas.length>360||cuotas.some(x=>typeof x!=="number"||!Number.isFinite(x)||x<=0))throw new TypeError("Cuotas inválidas");
 for(const n of [disponibleHoyMinor,ingresoMensualLibreMinor,cuotasExistentesMinor])if(n!==null&&(!Number.isSafeInteger(n)||n<0))throw new TypeError("Importe de capacidad inválido");
 const maxCuotaMinor=Math.ceil(Math.max(...cuotas)*100);
 const cuotasMinor=cuotas.map(x=>Math.round(x*100));
 const entradaConocida=saldoVerificado&&disponibleHoyMinor!==null;
 const cubrePrimeraCuota=entradaConocida?disponibleHoyMinor>=cuotasMinor[0]:null;
 const flujoMensualConocido=ingresoMensualLibreMinor!==null&&cuotasExistentesMinor!==null;
 const margenMensualMinor=flujoMensualConocido?ingresoMensualLibreMinor-cuotasExistentesMinor-maxCuotaMinor:null;
 const diagnostico=!entradaConocida||!flujoMensualConocido?"INFORMACION_INSUFICIENTE":!cubrePrimeraCuota||margenMensualMinor<0?"RIESGO_ALTO":"CAPACIDAD_PRELIMINAR";
 return{diagnostico,primeraCuotaMinor:cuotasMinor[0],maxCuotaMinor,cubrePrimeraCuota,margenMensualMinor,datosFaltantes:[...(!entradaConocida?["SALDO_DISPONIBLE_VERIFICADO"]:[]),...(!flujoMensualConocido?["FLUJO_MENSUAL_LIBRE_Y_CUOTAS_EXISTENTES"]:[])],soloLectura:true,advertencia:"El disponible de hoy no acredita capacidad de pago para los meses futuros. Una capacidad preliminar tampoco constituye aprobación de crédito."};
}
module.exports={diagnosticarRiesgoCuotas};