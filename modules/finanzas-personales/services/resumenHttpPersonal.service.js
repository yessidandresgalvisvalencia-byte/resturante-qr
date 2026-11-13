"use strict";
const mongoose=require("mongoose"),H=require("./homePersonal.service"),{consultarPeriodo}=require("./consultaCompensadaPersonal.service"),Meta=require("../models/meta.model"),Perfil=require("../models/perfil.model");
function ratio(n,d,{factor=1n,decimales=2}={}){
 if(typeof n!=="bigint"||typeof d!=="bigint"||d<0n)throw new TypeError("Ratio inválido");
 if(d===0n)return null;
 const negativo=n<0n,abs=negativo?-n:n,escala=10n**BigInt(decimales),bruto=abs*factor*escala,cociente=bruto/d,resto=bruto%d,redondeado=cociente+(resto*2n>=d?1n:0n),entero=redondeado/escala,fraccion=(redondeado%escala).toString().padStart(decimales,"0");
 return{numerador:n.toString(),denominador:d.toString(),factor:factor.toString(),decimal:(negativo&&redondeado!==0n?"-":"")+entero.toString()+"."+fraccion,redondeo:"MITAD_HACIA_ARRIBA",decimales};
}
function metasExactas(usuarioId,rows){
 if(!Array.isArray(rows)||rows.length>500)throw Object.assign(new Error("Metas fuera de capacidad verificable"),{statusCode:422});
 const ids=new Set();return rows.map(m=>{
  if(!m||String(m.userId)!==String(usuarioId)||!mongoose.isObjectIdOrHexString(m._id)||ids.has(String(m._id))||m.estado!=="ACTIVA"||!Number.isSafeInteger(m.objetivo)||m.objetivo<0||!Number.isSafeInteger(m.acumulado)||m.acumulado<0||typeof m.nombre!=="string"||/[\x00-\x1f]/.test(m.nombre))throw new TypeError("Meta no verificable");
  ids.add(String(m._id));const progreso=ratio(BigInt(m.acumulado),BigInt(m.objetivo),{factor:100n});
  return{id:String(m._id),nombre:m.nombre,objetivo:m.objetivo,acumulado:m.acumulado,objetivoValido:m.objetivo>0,progresoPct:progreso?.decimal??null,progresoRatio:progreso};
 });
}
function adaptar(h,historico,metas,perfil,corte,usuarioId){
 const r=require("./resumenConversacionalVerificadoPersonal.service").resumenHome(h,corte),m=h.mes;
 for(const n of [m.cuotasPendientesMesMinor,h.patrimonio?.deudaTotalMinor,h.patrimonio?.liquidezMinor])if(!Number.isSafeInteger(n)||n<0)throw new TypeError("Resumen requiere montos seguros");
 if(!Number.isSafeInteger(h.patrimonio?.netoMinor))throw new TypeError("Patrimonio registrado inválido");
 const fuentes=historico.filter(x=>x.tipo==="INGRESO"),ingresosHistoricos=H.sumarMontosHome(fuentes),cantidadIngresosHistoricos=fuentes.length;
 const deudas=h.explicaciones?.deuda?.origen?.deudas;
 const pagosImputados=h.asesor?.pagosPrestamoSinImputar===undefined||Array.isArray(h.asesor.pagosPrestamoSinImputar)&&h.asesor.pagosPrestamoSinImputar.length===0;
 const cuotasConocidas=pagosImputados&&Array.isArray(deudas)&&deudas.every(d=>Number.isSafeInteger(d.saldoMinor)&&d.saldoMinor>=0&&(d.saldoMinor===0||Number.isSafeInteger(d.cuotaMinor)&&d.cuotaMinor>0&&d.periodicidad==="MENSUAL"&&d.periodicidadConfirmada===true))&&["obligacionesSinFecha","cuotasSinDefinir","vencimientosAtrasados"].every(k=>Array.isArray(h.asesor?.[k])&&h.asesor[k].length===0);
 const flujoProyectado=cuotasConocidas?H.sumarImportesHome([r.flujoRealizadoMinor,-m.cuotasPendientesMesMinor]):null;
 const carga=cuotasConocidas?ratio(BigInt(r.pagosDeudaMinor)+BigInt(m.cuotasPendientesMesMinor),BigInt(r.ingresosMinor),{factor:100n}):null;
 const neto=flujoProyectado!==null?ratio(BigInt(flujoProyectado),BigInt(r.ingresosMinor),{factor:100n}):null;
 const saldo=h.caja?.liquidezConciliada===true?h.patrimonio.liquidezMinor:null;
 const cobertura=saldo!==null?ratio(BigInt(saldo),BigInt(r.gastosMinor)):null;
 if(perfil&&String(perfil.userId)!==String(usuarioId))throw new TypeError("Perfil ajeno");
 const objetivo=perfil&&Number.isSafeInteger(perfil.fondoEmergenciaObjetivoMeses)&&perfil.fondoEmergenciaObjetivoMeses>0?perfil.fondoEmergenciaObjetivoMeses:null;
 return{contrato:2,ingresos:r.ingresosMinor,ingresosHistoricos,cantidadIngresosHistoricos,gastos:r.gastosMinor,gastosConsumo:r.gastosConsumoMinor,cobrosRegistrados:r.cobrosRecibidosMinor,pagosDeudaRegistrados:r.pagosDeudaMinor,cuotasDeuda:cuotasConocidas?m.cuotasPendientesMesMinor:null,cuotasDeudaRegistradas:m.cuotasPendientesMesMinor,cuotasMensualesConocidas:cuotasConocidas,flujoRealizado:r.flujoRealizadoMinor,flujoProyectado,flujoLibre:null,deudaTotal:h.patrimonio.deudaTotalMinor,cargaDeudaPct:carga?.decimal??null,cargaDeudaRatio:carga,tasaAhorroPct:null,proporcionFlujoProyectadoPct:neto?.decimal??null,proporcionFlujoProyectadoRatio:neto,fondoEmergencia:{saldo,mesesCubiertos:null,objetivoMeses:objetivo,objetivoConfirmado:false,ratioLiquidezGastoRegistrado:cobertura,criterio:"Relación con gasto del período registrado, no meses de supervivencia ni cobertura futura certificada"},patrimonioNeto:h.patrimonio.netoMinor,metasActivas:metasExactas(usuarioId,metas),periodo:{desde:new Date(r.periodo.desde),hasta:new Date(+corte+1),corte:new Date(+corte),hastaExclusivo:new Date(+corte+1),zona:"America/Bogota"},autorizaGasto:false,fuente:"HOME_SNAPSHOT_MAS_HISTORICO_Y_METAS"};
}
async function resumen(usuarioId,now=new Date()){
 if(!mongoose.isObjectIdOrHexString(usuarioId)||!(now instanceof Date)||!Number.isFinite(+now))throw Object.assign(new Error("Consulta de resumen inválida"),{statusCode:400});
 if(mongoose.connection.readyState!==1)throw Object.assign(new Error("Resumen no disponible"),{statusCode:503});
 const corte=new Date(+now),session=await mongoose.startSession();let resultado;
 try{await session.withTransaction(async()=>{
  const h=await H.obtenerEnSesion(usuarioId,new Date(+corte),session);
  const historico=await consultarPeriodo({usuarioId,desde:"0001-01-01T00:00:00.000Z",hasta:new Date(+corte+1).toISOString()},{session});
  const metas=await Meta.find({userId:usuarioId}).limit(501).maxTimeMS(5000).session(session).lean();
  const perfil=await Perfil.findOne({userId:usuarioId}).maxTimeMS(5000).session(session).lean();
  const revisionMetas=await require("./creacionMetaRecuperablePersonal.service").contexto(usuarioId,metas,{session});resultado=adaptar(h,historico,revisionMetas.metas.filter(m=>m.estado==="ACTIVA"&&!m.retirada),perfil,corte,usuarioId);
 },{readConcern:{level:"snapshot"},readPreference:"primary"});return resultado;
 }finally{await session.endSession();}
}
module.exports={resumen,adaptar,ratio,metasExactas};
