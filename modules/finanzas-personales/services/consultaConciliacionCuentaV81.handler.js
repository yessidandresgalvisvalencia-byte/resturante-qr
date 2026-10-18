"use strict";
const {resolverUsuarioAutorizadoV81}=require("./autorizacionV81.service");
const {parsearCopACentavos}=require("./dineroExactoV81.service");
const {conciliarHistoricoCuentaV81}=require("./conciliacionHistoricoCuentaV81.service");
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
   const saldoInicialCentavos=parsearCopACentavos(q.saldoInicialCop);
   const saldoObservadoCentavos=parsearCopACentavos(q.saldoObservadoCop);
   const conciliacion=await consultar({usuarioId,cuentaId:q.cuentaId,desde:q.desde,hastaExclusivo:q.hastaExclusivo,saldoInicialCentavos,saldoObservadoCentavos});
   return res.set("Cache-Control","no-store").status(200).json({ok:true,conciliacion});
  }catch(e){
   const status=e.statusCode===401?401:e instanceof TypeError?400:e.message?.includes("no clasificable")?409:500;
   return res.status(status).json({ok:false,error:status===401?"Autenticación requerida":status===400?"Parámetros de conciliación inválidos":status===409?"Conciliación requiere clasificar movimientos":"Conciliación no disponible"});
  }
 };
}
module.exports={crearConsultaConciliacionCuentaV81};
