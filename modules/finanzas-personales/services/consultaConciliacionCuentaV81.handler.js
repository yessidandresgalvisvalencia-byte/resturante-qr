"use strict";
const {resolverUsuarioAutorizadoV81}=require("./autorizacionV81.service");
const {parsearCopACentavos}=require("./dineroExactoV81.service");
const {conciliarHistoricoCuentaV81,fechaCalendarioValidaV81}=require("./conciliacionHistoricoCuentaV81.service");
// Los saldos observados pueden ser negativos (sobregiro). Los gastos y
// movimientos siguen exigiendo montos positivos en sus propios validadores.
function parsearSaldoFirmadoCopACentavos(valor){
 // Limitar la entrada antes de BigInt evita procesar importes de tamaño
 // arbitrario; 15 cifras enteras superan ampliamente el uso personal COP.
 if(typeof valor!=="string"||!(/^-?(?:0|[1-9][0-9]{0,14})(?:\.[0-9]{1,2})?$/.test(valor)))
  throw new TypeError("Saldo COP inválido o demasiado grande");
 const negativo=valor.startsWith("-");
 const sinSigno=negativo?valor.slice(1):valor;
 const centavos=parsearCopACentavos(sinSigno);
 return negativo?-centavos:centavos;
}
function crearConsultaConciliacionCuentaV81(consultar=conciliarHistoricoCuentaV81){
 return async(req,res)=>{
  try{
   const usuarioId=resolverUsuarioAutorizadoV81({autenticado:req.personalAuth?.verificado===true,usuarioId:req.personalAuth?.userId});
   const q=req.query;
   if(!q||typeof q!=="object"||Object.keys(q).some(k=>!["cuentaId","desde","hastaExclusivo","saldoInicialCop","saldoObservadoCop"].includes(k)))
    throw new TypeError("Parámetros inválidos");
   if(typeof q.cuentaId!=="string"||!/^[a-f0-9]{24}$/i.test(q.cuentaId))throw new TypeError("Cuenta inválida");
   if(typeof q.desde!=="string"||typeof q.hastaExclusivo!=="string"||
     !fechaCalendarioValidaV81(q.desde)||!fechaCalendarioValidaV81(q.hastaExclusivo)||q.desde>=q.hastaExclusivo)
    throw new TypeError("Período inválido");
   const saldoInicialCentavos=parsearSaldoFirmadoCopACentavos(q.saldoInicialCop);
   const saldoObservadoCentavos=parsearSaldoFirmadoCopACentavos(q.saldoObservadoCop);
   const conciliacion=await consultar({usuarioId,cuentaId:q.cuentaId,desde:q.desde,hastaExclusivo:q.hastaExclusivo,saldoInicialCentavos,saldoObservadoCentavos});
   // Un saldo aportado por el solicitante no autoriza recomendaciones ni se convierte en saldo verificado.
   return res.set("Cache-Control","no-store").status(200).json({ok:true,conciliacion:{...conciliacion,saldoBancarioVerificado:false,aptoParaDisponibleHoy:false,usoPermitido:"DIAGNOSTICO_CONTABLE"}});
  }catch(e){
   const timeoutMongo=e?.code===50||e?.codeName==="MaxTimeMSExpired";
   const status=timeoutMongo?503:e.statusCode===401?401:e.statusCode===404?404:e.statusCode===409?409:e instanceof TypeError?400:e.message?.includes("no clasificable")?409:500;
   return res.set("Cache-Control","no-store").status(status).json({ok:false,error:status===401?"Autenticación requerida":status===400?"Parámetros de conciliación inválidos":status===409?"Conciliación bloqueada: existen movimientos sin vincular o sin clasificar":status===404?"Cuenta no encontrada":status===503?"Conciliación temporalmente no disponible; reintenta":"Conciliación no disponible"});
  }
 };
}
module.exports={crearConsultaConciliacionCuentaV81,parsearSaldoFirmadoCopACentavos};
