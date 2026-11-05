"use strict";
const consulta=require("./consultaPersonal.service");
const proyeccion=require("./proyeccionMaster90d.service");

const NORMALIZAR=s=>String(s||"").trim();
const SEGUIMIENTO=/^(?:¿?\s*(?:y si|entonces|en ese caso|con eso|y con eso|qué pasaría si|que pasaria si|en vez de|mejor|pero si|cuánto sería|cuanto seria|por qué|por que|explícame|explicame|y si no))\b/i;
const DECISION=/(?:conviene|recomiendas|aconsejas|deber[ií]a|ser[ií]a mejor|qu[eé] hago|qu[eé] har[ií]as|me alcanza|puedo pagar|podr[ií]a pagar|vale la pena)/i;
function seguimiento(texto){return SEGUIMIENTO.test(NORMALIZAR(texto));}
function encontrarContexto(turnos,texto){
 if(!seguimiento(texto))return null;
 const candidatos=turnos.filter(t=>t&&typeof t.mensaje==="string"&&t.mensaje.trim()&&t.mensaje.trim()!==texto);
 return candidatos[0]||null;
}
function estadoConocido(h,ahora=h?.corte){
 const observacion=require("./disponibleConversacionalPersonal.service").validar(h,ahora),a=observacion.autorizado?observacion.datos:null;
 return{saldoConocido:!!a,disponible:a?.disponibleHoyMinor??null,compromisos:a?.gastosFijosAntesProximoIngresoMinor??null,confiabilidad:a?"VERIFICADO":"NO_VERIFICADO",observacion};
}
function armarRespuesta(_base,datos){
 const D=require("./disponibleConversacionalPersonal.service"),r=D.presentar(datos?.observacion||D.validar(null,new Date()));
 return r.respuesta+" No se creó ningún movimiento.";
}
const FUENTES_VALIDADAS=new Set(["ASESOR_HOME_VERIFICADO","PRESTAMO_PERSONAL_EN_SNAPSHOT","HOME_SNAPSHOT_COMPENSADO","PRESTAMOS_PERSONALES_SNAPSHOT","FUENTES_PERSONALES","snapshot_personal_v81"]);
async function orientar(usuarioId,pregunta,{turnos=[],guardarContexto=true}={}){
 const mongoose=require("mongoose"),actual=NORMALIZAR(pregunta);if(!mongoose.isObjectIdOrHexString(usuarioId)||!actual)throw Object.assign(Error("Consulta personal inválida"),{statusCode:400});
 const propios=Array.isArray(turnos)?turnos.filter(t=>String(t.usuarioId)===String(usuarioId)):[],anterior=encontrarContexto(propios,actual);
 const contextoPrevio=anterior?{id:String(anterior._id||""),fecha:anterior.createdAt||null,esReferenciaHistorica:true}:null;
 if(/(?:proyecci[oó]n|proyecta|pr[oó]ximos? (?:30|60|90) d[ií]as|(?:30|60|90) d[ií]as|futuro de mi caja)/i.test(actual)&&/(?:caja|finanzas|dinero|saldo|ingresos|gastos|pagos|proyecci[oó]n|proyecta)/i.test(actual)){
  try{const resultado=await proyeccion.analizar(usuarioId);return presentarProyeccion(resultado);}catch{return{tipo:"PROYECCION_NO_VERIFICABLE",respuesta:"🟡 No pude verificar la proyección completa.\nNo muestro sumas parciales ni las reemplazo por cero.\nAcción: revisa fechas, cuotas y fuentes antes de proyectar.",datos:{completo:false,ventanas:null,saldoCondicionalMinor:null,autorizaGasto:false}};}
 }
 const base=await consulta.consultar(usuarioId,actual,{guardarContexto});
 if(!DECISION.test(actual)&&!anterior)return{...base,contextoPrevio:null};
 // No mezclar una respuesta financiera validada con otro saldo observado después.
 if(FUENTES_VALIDADAS.has(base.fuente)||base.tipo==="GASTO_INTELIGENTE"||base.tipo==="DEUDA_NO_IDENTIFICADA"||base.tipo==="REFERENCIA_AMBIGUA")return{...base,contextoPrevio,datos:{...base.datos,contextoPrevio,requiereAprobacion:false}};
 const D=require("./disponibleConversacionalPersonal.service"),v=await D.observar(usuarioId),r=D.presentar(v);
 return{tipo:"ASESORIA_MASTER_CONTEXTO",respuesta:r.respuesta,fuente:r.fuente,contextoPrevio,datos:{...r.datos,soloLectura:true,contextoPrevio,autorizaCompra:false,cuotaRecomendadaMinor:null,requiereAprobacion:false}};
}
function presentarProyeccion(r){
 const money=n=>{if(!Number.isSafeInteger(n)||n<0)throw Error("Importe de proyección inválido");return new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n);};
 if(!r||r.contrato!==2||!Array.isArray(r.ventanas)||r.ventanas.length!==3)throw Error("Proyección inválida");
 const pendientes=r.pendientes;if(!pendientes||["montosCalendario","cuotasSinDefinir","deudasSinFecha","vencidasOHoy","calendariosHoy"].some(k=>!Number.isSafeInteger(pendientes[k])||pendientes[k]<0))throw Error("Pendientes inválidos");const sinResolver=Object.values(pendientes).reduce((a,n)=>a+n,0);
 const filas=r.ventanas.map((v,i)=>{if(v.dias!==[30,60,90][i]||v.saldoCondicionalMinor!==null)throw Error("Horizonte inválido");return "Días "+(i?i*30+1:1)+"–"+v.dias+": ingresos programados "+money(v.ingresosTramoMinor)+"; pagos registrados "+money(v.obligacionesTramoMinor)+".";});
 return{tipo:"PROYECCION_PARCIAL_30_60_90",respuesta:["🟡 Escenario parcial de eventos registrados, no presupuesto completo.",...filas,r.ingresosSinProgramar?"Sin ingresos programados no significa ingreso futuro cero; registros por verificar: "+sinResolver+".":"No calcula saldo futuro; registros por verificar: "+sinResolver+" y gastos/condiciones faltantes.","Acción: verifica fechas, cuotas y gastos antes de comprometer dinero."].join("\n"),datos:r};
}
module.exports={seguimiento,encontrarContexto,estadoConocido,armarRespuesta,orientar,presentarProyeccion};
