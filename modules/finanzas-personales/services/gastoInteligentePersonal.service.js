"use strict";
const home=require("./homePersonal.service");
function money(n){return new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n);}
function exacto(n){return Number.isSafeInteger(n)&&n>=0;}
function diaCivilBogota(date){
 const p=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
 const x=Object.fromEntries(p.map(v=>[v.type,v.value]));
 return Date.UTC(Number(x.year),Number(x.month)-1,Number(x.day));
}
function consecuenciaDiaria({disponibleMinor,montoMinor,fechaIngreso,ahora=new Date()}){
 if(!exacto(disponibleMinor)||!Number.isSafeInteger(montoMinor)||montoMinor<=0)
  throw new TypeError("Consecuencia requiere importes enteros seguros");
 const restante=disponibleMinor-montoMinor;
 if(!Number.isSafeInteger(restante))throw new RangeError("Consecuencia fuera de rango");
 const ingreso=new Date(fechaIngreso);
 if(Number.isNaN(ingreso.getTime())||!(ahora instanceof Date)||Number.isNaN(ahora.getTime()))
  return {restanteMinor:restante,diasHastaIngreso:null,promedioDiarioMinor:null,estimacion:"FECHA_NO_VERIFICADA"};
 const dias=Math.round((diaCivilBogota(ingreso)-diaCivilBogota(ahora))/86400000);
 if(dias<=0)return {restanteMinor:restante,diasHastaIngreso:null,promedioDiarioMinor:null,estimacion:"INGRESO_NO_FUTURO"};
 return {restanteMinor:restante,diasHastaIngreso:dias,promedioDiarioMinor:Math.floor(Math.max(0,restante)/dias),estimacion:"PROYECCION_NO_PRESUPUESTO"};
}
function alertarVencimientoProximo({compromisos,fechaIngreso,ahora=new Date()}){
 if(!Array.isArray(compromisos)||!(ahora instanceof Date)||!Number.isFinite(ahora.getTime()))return null;
 const ingreso=new Date(fechaIngreso);
 if(!Number.isFinite(ingreso.getTime()))return null;
 const hoy=diaCivilBogota(ahora),limite=diaCivilBogota(ingreso);
 const proximos=compromisos.filter(c=>{
  if(!c||!Number.isSafeInteger(c.montoMinor)||c.montoMinor<=0||typeof c.concepto!=="string")return false;
  const fecha=new Date(c.fecha);
  if(!Number.isFinite(fecha.getTime()))return false;
  const dia=diaCivilBogota(fecha);
  return dia>=hoy&&dia<limite&&dia-hoy<=7*86400000;
 }).map(c=>({...c,diasRestantes:Math.round((diaCivilBogota(new Date(c.fecha))-hoy)/86400000)}))
 .sort((a,b)=>a.diasRestantes-b.diasRestantes||a.concepto.localeCompare(b.concepto));
 const primero=proximos[0];
 if(!primero)return null;
 return {tipo:"VENCIMIENTO_PROXIMO",prioridad:primero.diasRestantes<=2?"ALTA":"MEDIA",
  concepto:primero.concepto.slice(0,100),montoMinor:primero.montoMinor,diasRestantes:primero.diasRestantes,
  descripcion:"El compromiso ya se descontó al calcular Disponible Hoy; no es un cobro adicional."};
}
async function evaluar(usuarioId,input){
 const {montoMinor,obligatorio=false}=input;if(!Number.isSafeInteger(montoMinor)||montoMinor<1)throw Object.assign(new Error("Necesito el precio exacto."),{statusCode:400});
 const h=await home.obtener(usuarioId),a=h.asesor;if(!a.aptoParaDisponibleHoy||!Number.isSafeInteger(a.disponibleHoyMinor)||!a.proximoIngresoConocido||!a.proximoIngreso?.fecha)return{estado:"FALTAN_DATOS",mensaje:"Necesito saldo conciliado, obligaciones confirmadas y fecha del próximo ingreso para evaluar esa compra sin inventar."};
 const despues=a.disponibleHoyMinor-montoMinor;
 const consecuencia=consecuenciaDiaria({disponibleMinor:a.disponibleHoyMinor,montoMinor,fechaIngreso:a.proximoIngreso.fecha});
 const alerta=alertarVencimientoProximo({compromisos:a.compromisosAntesProximoIngreso,fechaIngreso:a.proximoIngreso.fecha});
 const advertencia=alerta?" Atención: "+alerta.concepto+" vence "+(alerta.diasRestantes===0?"hoy":"en "+alerta.diasRestantes+" día(s)")+" por "+money(alerta.montoMinor)+". Ese compromiso ya está separado del disponible; no lo gastes dos veces.":"";
 const explicacion=consecuencia.diasHastaIngreso===null?" Verifica la fecha del ingreso antes de estimar cuánto podrías gastar por día.":" Si haces esta compra, quedarían "+money(Math.max(0,despues))+" para "+consecuencia.diasHastaIngreso+" día(s) hasta el próximo ingreso: "+money(consecuencia.promedioDiarioMinor)+" diarios como referencia, no como garantía de suficiencia.";
 const metodos=[{metodo:"EFECTIVO_DEBITO",costoTotalMinor:montoMinor,conocido:true,criterio:"No agrega intereses ni cargos financieros al precio informado."}];
 if(input.credito){const {interesesMinor,cargosMinor,cuotas}=input.credito;if(exacto(interesesMinor)&&exacto(cargosMinor)&&Number.isSafeInteger(cuotas)&&cuotas>0){const total=montoMinor+interesesMinor+cargosMinor;if(!Number.isSafeInteger(total))throw Object.assign(new Error("El costo total del crédito excede el rango monetario seguro."),{statusCode:400});metodos.push({metodo:"CREDITO",costoTotalMinor:total,conocido:true,cuotas,criterio:"Costo calculado solo con intereses y cargos exactos informados."});}else metodos.push({metodo:"CREDITO",conocido:false,criterio:"Faltan intereses, cargos o número de cuotas exactos; GRUK no adivina el costo del crédito."});}
 const conocidos=metodos.filter(x=>x.conocido).sort((x,y)=>x.costoTotalMinor-y.costoTotalMinor);
 const metodoMenorCosto=conocidos[0]?.metodo||null;
 if(!obligatorio&&despues<0)return{estado:"NO_CABE",impactoMinor:-despues,consecuencia,alerta,metodos,metodoMenorCosto,mensaje:"Cuesta "+money(montoMinor)+" y supera tu gasto libre por "+money(-despues)+". Hacerla hoy tocaría dinero protegido."+explicacion+advertencia};
 if(obligatorio&&despues<0)return{estado:"REQUIERE_PLAN",impactoMinor:-despues,consecuencia,alerta,metodos,metodoMenorCosto,mensaje:"Es una obligación y faltan "+money(-despues)+". Hay que resolver la obligación, no esconderla: compara renegociar, reprogramar o sustituir con costos reales."+explicacion+advertencia};
 return{estado:"CABE",restanteMinor:despues,consecuencia,alerta,metodos,metodoMenorCosto,mensaje:"Cabe por "+money(montoMinor)+" y quedarían "+money(despues)+" libres."+explicacion+advertencia+" El método de menor costo conocido es "+metodoMenorCosto+"; si existe un beneficio real de otro método, debe superar sus cargos e intereses exactos."};
}
module.exports={evaluar,consecuenciaDiaria,alertarVencimientoProximo};
