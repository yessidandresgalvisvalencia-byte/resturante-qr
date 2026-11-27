"use strict";
const mongoose=require("mongoose"),Prestamo=require("../models/prestamoPersonal.model");
const tipos=["DEUDA_CONTEXTUAL","ASESORIA_DEUDA_CONTEXTUAL","COMPARACION_ABONO_DEUDA"];
const invalida=()=>Object.assign(new Error("Fuente de deuda no verificable"),{statusCode:409});
function decimalExacto(n,escala){const base=10n**BigInt(escala),entero=n/base,fraccion=(n%base).toString().padStart(escala,"0").replace(/0+$/,"");return entero.toString()+(fraccion?"."+fraccion:"");}
function calcular(deuda,usuarioId){
 if(!deuda||String(deuda.usuarioId)!==String(usuarioId)||!mongoose.isObjectIdOrHexString(deuda._id)||deuda.direccion!=="POR_PAGAR"||!["ACTIVO","VENCIDO"].includes(deuda.estado))throw invalida();
 for(const k of ["principalMinor","saldoMinor","cuotaMinor"])if(!Number.isSafeInteger(deuda[k])||deuda[k]<0)throw invalida();
 if(deuda.principalMinor===0||deuda.saldoMinor>deuda.principalMinor||typeof deuda.concepto!=="string"||!deuda.concepto.trim()||deuda.concepto.length>160||/[\r\n\x00-\x1f]/.test(deuda.concepto))throw invalida();
 const diferencia=Number(BigInt(deuda.principalMinor)-BigInt(deuda.saldoMinor));
 let escenario=null,motivoTasa="TASA_NO_CONFIRMADA";
 // Se interpreta el decimal canónico almacenado; nunca se multiplica dinero
 // por una tasa Number. Precisión mayor a seis decimales se deja pendiente.
 if(deuda.tasaConfirmada===true){const tasa=deuda.tasaMensualPct,texto=typeof tasa==="number"?String(tasa):"",m=/^(0|[1-9]\d*)(?:\.(\d{1,6}))?$/.exec(texto);
  if(Number.isFinite(tasa)&&tasa>=0&&tasa<=100&&m){const decimales=(m[2]||"").length,coeficiente=BigInt(m[1]+(m[2]||"")),escala=decimales+2,numerador=BigInt(deuda.saldoMinor)*coeficiente,denominador=10n**BigInt(escala);
   escenario={tasaMensualPctDecimal:texto,interesUnMesCopDecimal:decimalExacto(numerador,escala),numeradorCop:numerador.toString(),denominador:denominador.toString(),supuesto:"SALDO_FIJO_UN_MES_SIN_PAGOS_NI_OTROS_CARGOS",redondeo:"NINGUNO"};motivoTasa=null;
  }else motivoTasa="TASA_NO_VERIFICABLE";
 }
 return{deudaId:String(deuda._id),concepto:deuda.concepto,principalMinor:deuda.principalMinor,saldoMinor:deuda.saldoMinor,cuotaMinor:deuda.cuotaMinor>0?deuda.cuotaMinor:null,diferenciaPrincipalSaldoMinor:diferencia,abonadoMinor:null,mesesEstimados:null,disponibleMinor:null,abonoSugeridoMinor:null,requiereLiquidacion:true,tasaConfirmada:deuda.tasaConfirmada===true,tasaUtilizable:escenario!==null,motivoTasa,escenarioInteres:escenario};
}
const pesos=n=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n);
function pesosDecimales(texto){const [entero,decimal]=texto.split(".");return "$"+BigInt(entero).toLocaleString("es-CO")+(decimal?","+decimal:"");}
function presentar(datos,tipo,corte){
 const interes=datos.escenarioInteres?"Escenario de un mes a "+datos.escenarioInteres.tasaMensualPctDecimal.replace(".",",")+"% mensual: "+pesosDecimales(datos.escenarioInteres.interesUnMesCopDecimal)+" sin redondear.":"Tasa mensual pendiente de verificar; no presupongo interés cero.";
 const lineas=["🟡 Deuda registrada: "+datos.concepto+".","Saldo "+pesos(datos.saldoMinor)+"; principal "+pesos(datos.principalMinor)+(datos.cuotaMinor===null?"; cuota pendiente de confirmar.":"; cuota registrada "+pesos(datos.cuotaMinor)+"."),interes,"El escenario mantiene saldo fijo, sin pagos ni otros cargos; no es una liquidación.",tipo==="DEUDA_CONTEXTUAL"?"Principal menos saldo no prueba pagos; el plazo no se estima dividiendo por la cuota.":"No hay abono adicional autorizado ni ahorro de intereses confirmado.","Acción: pide liquidación y calendario al acreedor"+(tipo==="COMPARACION_ABONO_DEUDA"?", y condiciones de la inversión para comparar.":" antes de decidir pagos.")];
 return{tipo,respuesta:lineas.join("\n"),datos:{...datos,corte:corte.toISOString()},fuente:"PRESTAMO_PERSONAL_EN_SNAPSHOT"};
}
function noVerificable(tipo){return{tipo,respuesta:"🟡 No pude verificar la deuda vigente de tu cuenta.\nNo publico saldo, interés ni abono alternativos.\nAcción: actualiza la consulta y verifica la fuente de la deuda.",datos:{saldoMinor:null,cuotaMinor:null,abonadoMinor:null,mesesEstimados:null,disponibleMinor:null,abonoSugeridoMinor:null,escenarioInteres:null,motivo:"DEUDA_NO_VERIFICABLE"},fuente:"PRESTAMO_PERSONAL_EN_SNAPSHOT"};}
async function consultar(usuarioId,deudaId,{tipo="DEUDA_CONTEXTUAL"}={}){
 if(!mongoose.isObjectIdOrHexString(usuarioId)||!mongoose.isObjectIdOrHexString(deudaId)||!tipos.includes(tipo))throw Object.assign(new Error("Consulta de deuda inválida"),{statusCode:400});
 if(mongoose.connection.readyState!==1)return noVerificable(tipo);
 let session,datos,fallo=false;const corte=new Date();
 try{session=await mongoose.startSession();await session.withTransaction(async()=>{const d=await Prestamo.findOne({_id:deudaId,usuarioId,direccion:"POR_PAGAR",estado:{$in:["ACTIVO","VENCIDO"]}}).maxTimeMS(5000).session(session).lean();datos=calcular(d,usuarioId);},{readConcern:{level:"snapshot"},readPreference:"primary"});}catch{fallo=true;}
 finally{if(session)try{await session.endSession();}catch{fallo=true;}}
 return fallo?noVerificable(tipo):presentar(datos,tipo,corte);
}
module.exports={calcular,presentar,consultar};
