"use strict";
// Adaptador de contrato: V2 y la consulta conversacional usan el snapshot personal.
// No incorpora saldos de perfiles ni copias de deuda histórica por parecido.
const mongoose=require("mongoose"),P=require("./patrimonioPersonal.service"),Deuda=require("../models/DeudaPersonal"),Credito=require("../models/credito.model"),Perfil=require("../models/UsuarioPatrimonio");
const falla=m=>Object.assign(new Error(m),{statusCode:409});
const exacto=v=>{if(!Number.isSafeInteger(v))throw falla("Importe patrimonial no exacto");return v;};
const noNegativo=v=>{if(exacto(v)<0)throw falla("Referencia histórica con importe negativo");return v;};
function referencias(u,deudas,creditos,perfiles){
 const salida=[];for(const [fuente,rows,owner,campo] of [["DEUDA_CANONICA_ANTERIOR",deudas,"usuarioId","saldoMinor"],["CREDITO_ORIGINAL_ANTERIOR",creditos,"userId","saldo"]]){
  if(!Array.isArray(rows)||rows.length>500)throw falla("Capacidad de revisión de referencias excedida");const ids=new Set();
  for(const x of rows){if(!x||!mongoose.isValidObjectId(x._id)||String(x[owner])!==String(u)||ids.has(String(x._id))||x.moneda!==undefined&&x.moneda!=="COP")throw falla("Referencia histórica no verificable");ids.add(String(x._id));if(fuente==="DEUDA_CANONICA_ANTERIOR"&&x.moneda!=="COP")throw falla("Moneda de deuda anterior no verificada");salida.push({fuente,id:String(x._id),saldoRegistradoMinor:noNegativo(x[campo]),incluidaAutomaticamente:false,requiereRevision:true});}
 }
 if(!Array.isArray(perfiles)||perfiles.length>1)throw falla("Perfil patrimonial duplicado");let perfil=null;
 if(perfiles.length){const x=perfiles[0];if(String(x.usuarioId)!==String(u)||x.monedaBase!=="COP"||!Number.isInteger(x.fondoEmergenciaObjetivoMeses)||x.fondoEmergenciaObjetivoMeses<1||x.fondoEmergenciaObjetivoMeses>24)throw falla("Perfil patrimonial no verificable");perfil={saldoRegistradoMinor:noNegativo(x.saldoLiquidoMinor),incluidoEnCaja:false,fondoEmergenciaObjetivoMeses:x.fondoEmergenciaObjetivoMeses};}
 return{deudas:salida,perfil};
}
function adaptar(p,r){
 for(const k of ["liquidezMinor","activosNoLiquidosMinor","valorInversionesMinor","capitalInvertidoMinor","resultadoInversionesMinor","pasivosMinor","cuentasPorCobrarMinor","patrimonioFinancieroNetoMinor"])exacto(p?.[k]);
 for(const k of ["activosNoLiquidosMinor","valorInversionesMinor","capitalInvertidoMinor","pasivosMinor","cuentasPorCobrarMinor"])noNegativo(p[k]);
 if(p.saldoVerificado===true)noNegativo(p.liquidezMinor);
 if(!Array.isArray(p.activosPreviosPorRevisar)||typeof p.saldoVerificado!=="boolean")throw falla("Snapshot patrimonial incompleto");
 const pendientes=r.deudas.length+p.activosPreviosPorRevisar.length,cajaConocida=p.saldoVerificado===true,completo=cajaConocida&&pendientes===0;
 const activos=cajaConocida?P.sumaPatrimonialSegura([p.liquidezMinor,p.activosNoLiquidosMinor]):null;
 // Todas las operaciones son exactas; no existe suma ni decisión financiera de IA.
 const neto=completo?P.sumaPatrimonialSegura([activos,p.valorInversionesMinor,p.cuentasPorCobrarMinor,-p.pasivosMinor]):null;
 if(completo&&neto!==p.patrimonioFinancieroNetoMinor)throw falla("Totales patrimoniales discrepantes");
 return{versionContrato:3,moneda:"COP",estado:pendientes?"REQUIERE_REVISION_HISTORICA":cajaConocida?"REGISTRADO":"REQUIERE_CONCILIACION",totalConocido:completo,activosMinor:completo?activos:null,bienesNoLiquidosMinor:p.activosNoLiquidosMinor,inversionesMinor:p.valorInversionesMinor,capitalInvertidoMinor:p.capitalInvertidoMinor,resultadoInversionesMinor:p.resultadoInversionesMinor,deudasMinor:pendientes?null:p.pasivosMinor,cuentasPorCobrarMinor:p.cuentasPorCobrarMinor,patrimonioNetoMinor:neto,saldoLiquidoMinor:cajaConocida?p.liquidezMinor:null,saldoVerificado:cajaConocida,fuenteLiquidez:p.fuenteLiquidez,fondoEmergenciaObjetivoMeses:r.perfil?.fondoEmergenciaObjetivoMeses??null,referenciasHistoricas:r,activosPreviosPorRevisar:p.activosPreviosPorRevisar,fuente:"snapshot_personal_v81",criterio:"Caja conciliada + bienes no líquidos + inversiones activas + cuentas por cobrar − deudas del snapshot personal. Retiros y compensaciones se verifican en la misma lectura. Las referencias históricas se conservan para revisión y el saldo de perfil no se convierte en caja; no acredita valor de mercado ni patrimonio externo no registrado."};
}
async function obtener(usuarioId){
 if(!mongoose.isValidObjectId(usuarioId))throw Object.assign(new Error("Usuario patrimonial inválido"),{statusCode:400});const s=await mongoose.startSession();let salida;
 try{await s.withTransaction(async()=>{
  const p=await P.snapshotEnSesion(usuarioId,s),d=await Deuda.find({usuarioId}).limit(501).maxTimeMS(5000).session(s).lean(),c=await Credito.find({userId:usuarioId}).limit(501).maxTimeMS(5000).session(s).lean(),f=await Perfil.find({usuarioId}).limit(2).maxTimeMS(5000).session(s).lean();salida=adaptar(p,referencias(usuarioId,d,c,f));
 },{readConcern:{level:"snapshot"},readPreference:"primary"});return salida;}finally{await s.endSession();}
}
module.exports={obtener,adaptar,referencias};
