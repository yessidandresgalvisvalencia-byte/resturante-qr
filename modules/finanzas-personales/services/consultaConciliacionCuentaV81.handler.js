"use strict";
const {resolverUsuarioAutorizadoV81}=require("./autorizacionV81.service");
const {parsearCopACentavos}=require("./dineroExactoV81.service");
const {conciliarHistoricoCuentaV81}=require("./conciliacionHistoricoCuentaV81.service");
// Los saldos observados pueden ser negativos (sobregiro). Los gastos y
// movimientos siguen exigiendo montos positivos en sus propios validadores.
function parsearSaldoFirmadoCopACentavos(valor){
 const negativo=typeof valor==="string"&&valor.startsWith("-");
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
     !/^\d{4}-\d{2}-\d{2}$/.test(q.desde)||!/^\d{4}-\d{2}-\d{2}$/.test(q.hastaExclusivo))
    throw new TypeError("Período inválido");
   const saldoInicialCentavos=parsearSaldoFirmadoCopACentavos(q.saldoInicialCop);
   const saldoObservadoCentavos=parsearSaldoFirmadoCopACentavos(q.saldoObservadoCop);
   const conciliacion=await consultar({usuarioId,cuentaId:q.cuentaId,desde:q.desde,hastaExclusivo:q.hastaExclusivo,saldoInicialCentavos,saldoObservadoCentavos});
   // Un saldo aportado por el solicitante no autoriza recomendaciones ni se convierte en saldo verificado.
   return res.set("Cache-Control","no-store").status(200).json({ok:true,conciliacion:{...conciliacion,saldoBancarioVerificado:false,aptoParaDisponibleHoy:false,usoPermitido:"DIAGNOSTICO_CONTABLE"}});
  }catch(e){
   const status=e.statusCode===401?401:e.statusCode===404?404:e.statusCode===409?409:e instanceof TypeError?400:e.message?.includes("no clasificable")?409:500;
   return res.set("Cache-Control","no-store").status(status).json({ok:false,error:status===401?"Autenticación requerida":status===400?"Parámetros de conciliación inválidos":status===409?"Conciliación bloqueada: existen movimientos sin vincular o sin clasificar":status===404?"Cuenta no encontrada":"Conciliación no disponible"});
  }
 };
}
module.exports={crearConsultaConciliacionCuentaV81,parsearSaldoFirmadoCopACentavos};
