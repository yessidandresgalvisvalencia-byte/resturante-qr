"use strict";
const home=require("./homePersonal.service");
function money(n){return new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n);}
const {reservarGmfCentavos}=require("./dineroExactoV81.service");
function exacto(n){return Number.isSafeInteger(n)&&n>=0;}
const {fechaVerificable,diaCivilBogota}=require("./fechaPersonal.service");
// Minor conserva la unidad entera usada por home; la reserva escala linealmente.
// Simula una salida gravada. No establece si la cuenta, compra o persona es exenta.
function simularCompraGravada(disponibleMinor,montoMinor){
 if(!exacto(disponibleMinor)||!Number.isSafeInteger(montoMinor)||montoMinor<=0)throw new TypeError("Compra requiere importes enteros seguros");
 const reserva=reservarGmfCentavos(BigInt(montoMinor)),total=BigInt(montoMinor)+reserva;
 if(total>BigInt(Number.MAX_SAFE_INTEGER))throw Object.assign(new RangeError("Precio y reserva simulada exceden el rango monetario seguro."),{statusCode:400});
 const totalSalidaMinor=Number(total),restanteMinor=disponibleMinor-totalSalidaMinor;
 return {escenario:"SIMULACION_GRAVADO_NO_VERIFICADO",exencionVerificada:false,precioMinor:montoMinor,reservaGmfMinor:Number(reserva),totalSalidaMinor,restanteMinor,cabe:restanteMinor>=0};
}
function consecuenciaDiaria({disponibleMinor,montoMinor,fechaIngreso,ahora=new Date()}){
 if(!exacto(disponibleMinor)||!Number.isSafeInteger(montoMinor)||montoMinor<=0)
  throw new TypeError("Consecuencia requiere importes enteros seguros");
 const restante=disponibleMinor-montoMinor;
 if(!Number.isSafeInteger(restante))throw new RangeError("Consecuencia fuera de rango");
 const ingreso=fechaVerificable(fechaIngreso);
 if(!ingreso||!(ahora instanceof Date)||Number.isNaN(ahora.getTime()))
  return {restanteMinor:restante,diasHastaIngreso:null,promedioDiarioMinor:null,estimacion:"FECHA_NO_VERIFICADA"};
 const dias=Math.round((diaCivilBogota(ingreso)-diaCivilBogota(ahora))/86400000);
 if(dias<=0)return {restanteMinor:restante,diasHastaIngreso:null,promedioDiarioMinor:null,estimacion:"INGRESO_NO_FUTURO"};
 return {restanteMinor:restante,diasHastaIngreso:dias,promedioDiarioMinor:Math.floor(Math.max(0,restante)/dias),estimacion:"PROYECCION_NO_PRESUPUESTO"};
}
function alertarVencimientoProximo({compromisos,fechaIngreso,ahora=new Date()}){
 if(!Array.isArray(compromisos)||!(ahora instanceof Date)||!Number.isFinite(ahora.getTime()))return null;
 const ingreso=fechaVerificable(fechaIngreso);
 if(!ingreso)return null;
 const hoy=diaCivilBogota(ahora),limite=diaCivilBogota(ingreso);
 const proximos=compromisos.filter(c=>{
  if(!c||!Number.isSafeInteger(c.montoMinor)||c.montoMinor<=0||typeof c.concepto!=="string")return false;
  const fecha=fechaVerificable(c.fecha);
  if(!fecha)return false;
  const dia=diaCivilBogota(fecha);
  return dia>=hoy&&dia<limite&&dia-hoy<=7*86400000;
 }).map(c=>({...c,diasRestantes:Math.round((diaCivilBogota(fechaVerificable(c.fecha))-hoy)/86400000)}))
 .sort((a,b)=>a.diasRestantes-b.diasRestantes||a.concepto.localeCompare(b.concepto));
 const primero=proximos[0];
 if(!primero)return null;
 return {tipo:"VENCIMIENTO_PROXIMO",prioridad:primero.diasRestantes<=2?"ALTA":"MEDIA",
  concepto:primero.concepto.slice(0,100),montoMinor:primero.montoMinor,diasRestantes:primero.diasRestantes,
  descripcion:"El compromiso ya se descontó al calcular Disponible Hoy; no es un cobro adicional."};
}
async function evaluar(usuarioId,input,{ahora=new Date()}={}){
 const {montoMinor,obligatorio=false}=input||{};if(!Number.isSafeInteger(montoMinor)||montoMinor<1||typeof obligatorio!=="boolean")throw Object.assign(new Error("Necesito el precio exacto y confirmar si es obligatorio."),{statusCode:400});
 const h=await home.obtener(usuarioId,ahora),a=h?.asesor;
 const faltanDatos=()=>({estado:"FALTAN_DATOS",mensaje:"Necesito saldo conciliado, obligaciones confirmadas y una fecha futura válida con importe del próximo ingreso para evaluar esa compra sin inventar."});
 if(!require("./disponibleConversacionalPersonal.service").validar(h,ahora).autorizado)return faltanDatos();
 const consecuencia=consecuenciaDiaria({disponibleMinor:a.disponibleHoyMinor,montoMinor,fechaIngreso:a.proximoIngreso.fecha,ahora});
 // Una advertencia no basta: sin horizonte verificable no hay evaluación monetaria.
 if(consecuencia.diasHastaIngreso===null)return faltanDatos();
 const despues=a.disponibleHoyMinor-montoMinor;
 const escenarioGravado=simularCompraGravada(a.disponibleHoyMinor,montoMinor);
 const consecuenciaSiGravado=consecuenciaDiaria({disponibleMinor:a.disponibleHoyMinor,montoMinor:escenarioGravado.totalSalidaMinor,fechaIngreso:a.proximoIngreso.fecha,ahora});
 const alerta=alertarVencimientoProximo({compromisos:a.compromisosAntesProximoIngreso,fechaIngreso:a.proximoIngreso.fecha,ahora});
 const advertencia=alerta?" Atención: "+alerta.concepto+" vence "+(alerta.diasRestantes===0?"hoy":"en "+alerta.diasRestantes+" día(s)")+" por "+money(alerta.montoMinor)+". Ese compromiso ya está separado del disponible; no lo gastes dos veces.":"";
 const explicacion=consecuencia.diasHastaIngreso===null?" Verifica la fecha del ingreso antes de estimar cuánto podrías gastar por día.":" Si haces esta compra, quedarían "+money(Math.max(0,despues))+" para "+consecuencia.diasHastaIngreso+" día(s) hasta el próximo ingreso: "+money(consecuencia.promedioDiarioMinor)+" diarios como referencia, no como garantía de suficiencia.";
 const metodos=[{metodo:"EFECTIVO_DEBITO",costoTotalMinor:montoMinor,conocido:true,criterio:"No agrega intereses ni cargos financieros al precio informado."}];
 if(input.credito){const {interesesMinor,cargosMinor,cuotas}=input.credito;if(exacto(interesesMinor)&&exacto(cargosMinor)&&Number.isSafeInteger(cuotas)&&cuotas>0){const total=montoMinor+interesesMinor+cargosMinor;if(!Number.isSafeInteger(total))throw Object.assign(new Error("El costo total del crédito excede el rango monetario seguro."),{statusCode:400});metodos.push({metodo:"CREDITO",costoTotalMinor:total,conocido:true,cuotas,criterio:"Costo calculado solo con intereses y cargos exactos informados."});}else metodos.push({metodo:"CREDITO",conocido:false,criterio:"Faltan intereses, cargos o número de cuotas exactos; GRUK no adivina el costo del crédito."});}
 const conocidos=metodos.filter(x=>x.conocido).sort((x,y)=>x.costoTotalMinor-y.costoTotalMinor);
 const metodoMenorCosto=conocidos[0]?.metodo||null;
 if(!obligatorio&&despues<0)return{estado:"NO_CABE",impactoMinor:-despues,consecuencia,escenarioGravado,consecuenciaSiGravado,alerta,metodos,metodoMenorCosto,mensaje:"Cuesta "+money(montoMinor)+" y supera tu gasto libre por "+money(-despues)+". Hacerla hoy tocaría dinero protegido."+explicacion+advertencia};
 if(obligatorio&&despues<0)return{estado:"REQUIERE_PLAN",impactoMinor:-despues,consecuencia,escenarioGravado,consecuenciaSiGravado,alerta,metodos,metodoMenorCosto,mensaje:"Es una obligación y faltan "+money(-despues)+". Hay que resolver la obligación, no esconderla: compara renegociar, reprogramar o sustituir con costos reales."+explicacion+advertencia};
 if(!escenarioGravado.cabe)return{estado:obligatorio?"REQUIERE_PLAN":"GMF_POR_VERIFICAR",restanteMinor:despues,impactoMinor:-escenarioGravado.restanteMinor,consecuencia,escenarioGravado,consecuenciaSiGravado,alerta,metodos,metodoMenorCosto,mensaje:"🟡 El precio cabe, pero precio más reserva simulada de 4×1.000 supera el disponible por "+money(-escenarioGravado.restanteMinor)+".\nNo hay exención verificada; no autorizo esta compra.\nAcción: verifica el medio de pago y sus cargos antes de decidir."+advertencia};
 return{estado:"CABE",restanteMinor:despues,consecuencia,escenarioGravado,consecuenciaSiGravado,alerta,metodos,metodoMenorCosto,mensaje:"🟢 El precio informado de "+money(montoMinor)+" cabe en el disponible registrado.\nSi la salida está gravada, separa "+money(escenarioGravado.reservaGmfMinor)+" de 4×1.000: quedarían "+money(escenarioGravado.restanteMinor)+" (referencia de "+money(consecuenciaSiGravado.promedioDiarioMinor)+" por día hasta el ingreso previsto).\nEs una simulación; no confirma exención ni garantiza la llegada del ingreso.\nLa comparación de crédito usa solo precio, intereses y cargos informados; no acredita cuotas futuras cubiertas.\nAcción: no superes el disponible entre precio, impuestos y cargos."+advertencia};
}
module.exports={evaluar,simularCompraGravada,consecuenciaDiaria,alertarVencimientoProximo,fechaVerificable,diaCivilBogota};
