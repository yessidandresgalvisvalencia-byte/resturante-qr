"use strict";
const home=require("./homePersonal.service"),D=require("./disponibleConversacionalPersonal.service");
const tipos={renegociar:"RENEGOCIAR",reprogramar:"REPROGRAMAR",sustituir:"SUSTITUIR"},legacy={costoRenegociarMinor:"renegociar",consecuenciaRenegociar:"renegociar",costoReprogramarMinor:"reprogramar",consecuenciaReprogramar:"reprogramar",costoSustituirMinor:"sustituir",consecuenciaSustituir:"sustituir"};
const falla=m=>Object.assign(new Error(m),{statusCode:400}),obj=x=>x&&typeof x==="object"&&!Array.isArray(x),entero=n=>Number.isSafeInteger(n)&&n>=0,texto=(x,n)=>typeof x==="string"&&x.length<=n&&!/[\u0000-\u001f\u007f]/.test(x),money=n=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n);
function validarEntrada(input){
 if(!obj(input)||Object.keys(input).some(k=>!["montoMinor","concepto",...Object.keys(tipos),...Object.keys(legacy)].includes(k))||!entero(input.montoMinor)||input.montoMinor<1||input.concepto!==undefined&&!texto(input.concepto,140))throw falla("Confirma valor entero exacto, concepto y campos de la obligación.");
 const r={montoMinor:input.montoMinor,concepto:input.concepto||"",alternativas:[]};
 for(const [campo,tipo] of Object.entries(tipos)){
  const planos=Object.keys(legacy).filter(k=>legacy[k]===campo&&Object.hasOwn(input,k));
  if(input[campo]!==undefined&&planos.length)throw falla("No mezcles dos contratos de la misma alternativa.");
  if(input[campo]!==undefined){
   const a=input[campo];if(!obj(a)||Object.keys(a).some(k=>!["costoMinor","pagoAhoraMinor","consecuencia","cumpleObligacion"].includes(k))||a.costoMinor!==undefined&&!entero(a.costoMinor)||a.pagoAhoraMinor!==undefined&&!entero(a.pagoAhoraMinor)||a.consecuencia!==undefined&&!texto(a.consecuencia,240)||a.cumpleObligacion!==undefined&&typeof a.cumpleObligacion!=="boolean")throw falla("Alternativa inválida: confirma costo, pago actual y cumplimiento.");
   const total=a.costoMinor===undefined?null:BigInt(r.montoMinor)+BigInt(a.costoMinor);
   if(total!==null&&(total>BigInt(Number.MAX_SAFE_INTEGER)||a.pagoAhoraMinor!==undefined&&BigInt(a.pagoAhoraMinor)>total))throw falla("El costo total o el pago actual están fuera del rango verificable.");
   if(total===null||a.pagoAhoraMinor===undefined||!a.consecuencia?.trim()||a.cumpleObligacion===undefined)r.alternativas.push({tipo,conocida:false,razon:"Falta costo, pago actual, consecuencia o confirmación explícita de cumplimiento."});
   else r.alternativas.push({tipo,conocida:true,pagoAhoraMinor:a.pagoAhoraMinor,costoTotalMinor:Number(total),costoExtraMinor:a.costoMinor,consecuencia:a.consecuencia,cumpleObligacion:a.cumpleObligacion,fuente:"DATOS_DECLARADOS_POR_USUARIO",confirmadaPorTercero:false});
  }else if(planos.length){
   for(const p of planos)if(p.startsWith("costo")?!entero(input[p]):!texto(input[p],240))throw falla("Costo o consecuencia anterior inválidos.");
   r.alternativas.push({tipo,conocida:false,razon:"El contrato anterior no confirma pago actual ni cumplimiento. Informa la alternativa completa."});
  }
 }
 return r;
}
function evaluarEstado(h,input,ahora=new Date()){
 const r=validarEntrada(input),v=D.validar(h,ahora),base={soloLectura:true,afectaCaja:false,autorizaPago:false,ingresoGarantizado:false,obligacionYaReservada:"NO_VERIFICADO"};
 if(!v.autorizado)return{...base,respuesta:["🟡 No hay una evaluación financiera autorizada.",v.mensaje,"Acción: "+v.accion].join("\n"),estado:"FALTAN_DATOS",quePaso:"Hay una obligación de "+money(r.montoMinor)+".",porQue:v.mensaje,calculo:null,alternativas:[],recomendacion:null,motivo:v.codigo,accion:v.accion};
 const disponible=v.datos.disponibleHoyMinor,monto=r.montoMinor,faltante=Number(BigInt(monto)>BigInt(disponible)?BigInt(monto)-BigInt(disponible):0n),alts=[{tipo:"CONSERVAR",conocida:true,pagoAhoraMinor:monto,costoTotalMinor:monto,costoExtraMinor:0,consecuencia:"Compara únicamente el importe informado con el disponible libre; revisa las condiciones y si ya estaba reservado.",cumpleObligacion:null,fuente:"IMPORTE_INFORMADO",confirmadaPorTercero:false},...r.alternativas],viables=alts.filter(x=>x.conocida&&(x.tipo==="CONSERVAR"||x.cumpleObligacion===true)&&x.pagoAhoraMinor<=disponible).sort((a,b)=>a.costoTotalMinor===b.costoTotalMinor?(a.pagoAhoraMinor===b.pagoAhoraMinor?0:a.pagoAhoraMinor<b.pagoAhoraMinor?-1:1):a.costoTotalMinor<b.costoTotalMinor?-1:1),mejor=viables[0]||null;
 const estado=faltante===0?"CUMPLIBLE":mejor?"ALTERNATIVA_VIABLE":"REQUIERE_PLAN",accion=estado==="CUMPLIBLE"?"El importe cabe en el disponible libre registrado. Confirma sus condiciones y si ya está reservado antes de pagar.":mejor?"La alternativa "+mejor.tipo+" cabe en el disponible con las condiciones que declaraste. Confírmalas con la contraparte antes de actuar.":"Revisa un plan para cubrir "+money(faltante)+" sin incumplir obligaciones esenciales.";
 return{...base,respuesta:[(estado==="REQUIERE_PLAN"?"🔴":estado==="CUMPLIBLE"?"🟢":"🟡")+" Valor informado: "+money(monto)+".","Disponible libre verificado: "+money(disponible)+".","Revisa si esta obligación ya está reservada; no se registra un pago.","Incluye impuestos y cargos en los importes; no se confirman exenciones.",...(mejor&&mejor.tipo!=="CONSERVAR"?["Alternativa según tus datos: "+mejor.tipo+"; no está confirmada por la contraparte."]:[]),"Acción: "+accion].join("\n"),estado,corte:v.datos.corte,quePaso:"Valor informado: "+money(monto)+(r.concepto?" por "+r.concepto:"")+".",porQue: "Comparación con el disponible libre verificado; no determina si esta obligación ya fue descontada.",calculo:{montoMinor:monto,disponibleMinor:disponible,faltanteMinor:faltante},alternativas:alts,recomendacion:mejor,accion};
}
function crearEvaluador({obtener=home.obtener}={}){return async(usuarioId,input,{ahora=new Date()}={})=>{
 validarEntrada(input);if(!require("mongoose").isObjectIdOrHexString(usuarioId)||!(ahora instanceof Date)||!Number.isFinite(+ahora))throw falla("Usuario o fecha de consulta inválidos.");
 const corte=new Date(+ahora),h=await obtener(usuarioId,new Date(+corte));return evaluarEstado(h,input,corte);
};}
module.exports={validarEntrada,evaluarEstado,crearEvaluador,evaluar:crearEvaluador()};
