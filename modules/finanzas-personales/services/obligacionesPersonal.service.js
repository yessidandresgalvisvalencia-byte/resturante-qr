"use strict";
const home=require("./homePersonal.service");
function money(n){return new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n);}
function entero(n){return Number.isSafeInteger(n)&&n>=0;}
async function evaluar(usuarioId,input={}){
 const monto=input.montoMinor;
 if(!Number.isSafeInteger(monto)||monto<1)throw Object.assign(new Error("Necesito el valor exacto de la obligación."),{statusCode:400});
 const h=await home.obtener(usuarioId),a=h.asesor||{};
 if(!a.saldoRealConocido||!a.proximoIngresoConocido)return{estado:"FALTAN_DATOS",quePaso:"Hay una obligación por "+money(monto)+".",porQue:"No conozco con certeza el saldo real y el próximo ingreso; decidir sin eso sería inventar.",accion:"Confirma saldo real y próximo ingreso.",alternativas:[]};
 const libre=Number(a.disponibleHoyMinor||0),faltante=Math.max(0,monto-libre);
 const alternativas=[{tipo:"CONSERVAR",viable:faltante===0,impactoMinor:monto,criterio:faltante===0?"Cabe dentro del dinero libre registrado.":"Hoy invade dinero protegido por "+money(faltante)+"."}];
 const agregar=(tipo,costo,consecuencia)=>{if(entero(costo))alternativas.push({tipo,viable:true,impactoMinor:costo,criterio:consecuencia||"Costo exacto suministrado por el usuario."});};
 agregar("RENEGOCIAR",input.costoRenegociarMinor,input.consecuenciaRenegociar);
 agregar("REPROGRAMAR",input.costoReprogramarMinor,input.consecuenciaReprogramar);
 agregar("SUSTITUIR",input.costoSustituirMinor,input.consecuenciaSustituir);
 const conocidas=alternativas.filter(x=>x.viable&&entero(x.impactoMinor)).sort((x,y)=>x.impactoMinor-y.impactoMinor);
 const mejor=conocidas[0]||null;
 return{estado:faltante?"REQUIERE_PLAN":"CABE",quePaso:"Debes cubrir "+money(monto)+(input.concepto?" por "+input.concepto:"")+".",porQue:faltante?"Con el dinero libre registrado faltan "+money(faltante)+". GRUK no recomienda incumplir una obligación esencial solo para ahorrar.":"La obligación cabe sin tocar el dinero que GRUK tiene protegido.",calculo:{montoMinor:monto,disponibleHoyMinor:libre,faltanteMinor:faltante},alternativas,recomendacion:mejor?{tipo:mejor.tipo,justificacion:"Entre las alternativas con costos exactos disponibles, esta conserva más liquidez. Antes de ejecutar deben respetarse consecuencias contractuales y de servicio."}:null,accion:faltante?"Obtén el costo y la consecuencia exactos de renegociar, reprogramar o sustituir; GRUK los comparará sin inventar.":"Puedes conservar el pago; registra el pago real cuando ocurra."};
}
module.exports={evaluar};
