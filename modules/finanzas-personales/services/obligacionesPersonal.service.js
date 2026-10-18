"use strict";
const home=require("./homePersonal.service");
function money(n){return new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n);}
function entero(n){return Number.isSafeInteger(n)&&n>=0;}
function alternativa(tipo,a,base){
 if(!a)return null;
 if(!entero(a.costoMinor))return{tipo,conocida:false,razon:"Falta el costo exacto; GRUK no puede afirmar que sea mejor."};
 const pagoAhora=entero(a.pagoAhoraMinor)?a.pagoAhoraMinor:base;
 const costoTotal=base+a.costoMinor;
 return{tipo,conocida:true,pagoAhoraMinor:pagoAhora,costoTotalMinor:costoTotal,costoExtraMinor:a.costoMinor,consecuencia:String(a.consecuencia||"Consecuencia no informada; debe confirmarse antes de aprobar."),cumpleObligacion:a.cumpleObligacion!==false};
}
async function evaluar(usuarioId,input){
 const monto=input.montoMinor;if(!entero(monto)||monto<1)throw Object.assign(new Error("Necesito el valor exacto de la obligación."),{statusCode:400});
 const h=await home.obtener(usuarioId),a=h.asesor;
 if(!a.saldoRealConocido||!a.proximoIngresoConocido)return{estado:"FALTAN_DATOS",quePaso:"Hay una obligación de "+money(monto)+".",porQue:"No tengo saldo real y próximo ingreso confirmados; decidir sin eso sería inventar.",calculo:null,alternativas:[],accion:"Confirma esos dos datos."};
 const disponible=a.disponibleHoyMinor,faltante=Math.max(0,monto-disponible),alts=[
  {tipo:"CONSERVAR",conocida:true,pagoAhoraMinor:monto,costoTotalMinor:monto,costoExtraMinor:0,consecuencia:"Cumple la obligación en las condiciones registradas.",cumpleObligacion:true},
  alternativa("RENEGOCIAR",input.renegociar,monto),alternativa("REPROGRAMAR",input.reprogramar,monto),alternativa("SUSTITUIR",input.sustituir,monto)
 ].filter(Boolean);
 const viables=alts.filter(x=>x.conocida&&x.cumpleObligacion).sort((x,y)=>(x.costoTotalMinor-y.costoTotalMinor)||(x.pagoAhoraMinor-y.pagoAhoraMinor));
 const mejor=viables[0]||null;
 let estado,accion;
 if(!faltante){estado="CUMPLIBLE";accion="Puedes cumplirla con el disponible registrado. Antes de cambiarla, una alternativa debe mejorar costo o liquidez sin dejar la obligación incumplida.";}
 else if(mejor&&mejor.pagoAhoraMinor<=disponible){estado="ALTERNATIVA_VIABLE";accion="Con los datos registrados, "+mejor.tipo+" cabe en la caja actual. Verifica la consecuencia indicada antes de aprobar.";}
 else{estado="REQUIERE_PLAN";accion="Faltan "+money(faltante)+". No recomiendo dejar de pagar una obligación esencial solo para ahorrar. Necesitas aumentar caja o una alternativa que realmente subsane la obligación.";}
 return{estado,quePaso:"Debes cubrir "+money(monto)+(input.concepto?" por "+input.concepto:"")+".",porQue:faltante?"El disponible protegido no alcanza por "+money(faltante)+".":"El disponible protegido sí cubre el valor.",calculo:{montoMinor:monto,disponibleMinor:disponible,faltanteMinor:faltante},alternativas:alts,recomendacion:mejor,accion};
}
module.exports={evaluar};
