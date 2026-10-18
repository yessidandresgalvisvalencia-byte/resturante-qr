"use strict";
const home=require("./homePersonal.service");
function money(n){return new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n);}
function exacto(n){return Number.isSafeInteger(n)&&n>=0;}
async function evaluar(usuarioId,input){
 const {montoMinor,obligatorio=false}=input;if(!Number.isSafeInteger(montoMinor)||montoMinor<1)throw Object.assign(new Error("Necesito el precio exacto."),{statusCode:400});
 const h=await home.obtener(usuarioId),a=h.asesor;if(!a.saldoRealConocido||!a.proximoIngresoConocido)return{estado:"FALTAN_DATOS",mensaje:"Necesito saldo real y próximo ingreso confirmados para evaluar esa compra sin inventar."};
 const despues=a.disponibleHoyMinor-montoMinor;
 const metodos=[{metodo:"EFECTIVO_DEBITO",costoTotalMinor:montoMinor,conocido:true,criterio:"No agrega intereses ni cargos financieros al precio informado."}];
 if(input.credito){const {interesesMinor,cargosMinor,cuotas}=input.credito;if(exacto(interesesMinor)&&exacto(cargosMinor)&&Number.isSafeInteger(cuotas)&&cuotas>0){const total=montoMinor+interesesMinor+cargosMinor;if(!Number.isSafeInteger(total))throw Object.assign(new Error("El costo total del crédito excede el rango monetario seguro."),{statusCode:400});metodos.push({metodo:"CREDITO",costoTotalMinor:total,conocido:true,cuotas,criterio:"Costo calculado solo con intereses y cargos exactos informados."});}else metodos.push({metodo:"CREDITO",conocido:false,criterio:"Faltan intereses, cargos o número de cuotas exactos; GRUK no adivina el costo del crédito."});}
 const conocidos=metodos.filter(x=>x.conocido).sort((x,y)=>x.costoTotalMinor-y.costoTotalMinor);
 const metodoMenorCosto=conocidos[0]?.metodo||null;
 if(!obligatorio&&despues<0)return{estado:"NO_CABE",impactoMinor:-despues,metodos,metodoMenorCosto,mensaje:"Cuesta "+money(montoMinor)+" y supera tu gasto libre por "+money(-despues)+". Hacerla hoy tocaría dinero protegido."};
 if(obligatorio&&despues<0)return{estado:"REQUIERE_PLAN",impactoMinor:-despues,metodos,metodoMenorCosto,mensaje:"Es una obligación y faltan "+money(-despues)+". Hay que resolver la obligación, no esconderla: compara renegociar, reprogramar o sustituir con costos reales."};
 return{estado:"CABE",restanteMinor:despues,metodos,metodoMenorCosto,mensaje:"Cabe por "+money(montoMinor)+" y quedarían "+money(despues)+" libres. El método de menor costo conocido es "+metodoMenorCosto+"; si existe un beneficio real de otro método, debe superar sus cargos e intereses exactos."};
}
module.exports={evaluar};
