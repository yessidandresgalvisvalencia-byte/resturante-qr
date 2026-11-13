"use strict";
const H=require("../../../modules/finanzas-personales/services/homePersonal.service");
module.exports=function homeVerificado(corte,cambios={}){
 const saldo=cambios.saldoRealMinor??300000,fijos=cambios.gastosFijosAntesProximoIngresoMinor??20000;
 const calc=H.calcularDisponibleHoy({saldoMinor:saldo,gastosFijosAntesProximoIngresoMinor:fijos});
 return{moneda:"COP",corte,caja:{liquidezConciliada:true},asesor:{aptoParaDisponibleHoy:true,saldoRealConocido:true,saldoConfiabilidad:"VERIFICADO",saldoRequiereReconciliacion:false,fuenteSaldo:"ANCLA_RECONCILIADA",saldoRealMinor:saldo,gastosFijosAntesProximoIngresoMinor:fijos,...calc,...H.calcularEscenarioGmfGravado({saldoMinor:saldo,gastosFijosAntesProximoIngresoMinor:fijos}),escenarioGmf:"SIMULACION_GRAVADO_NO_VERIFICADO",proximoIngresoConocido:true,proximoIngreso:{fecha:new Date(+corte+2*86400000),montoMinor:1000000},obligacionesSinFecha:[],gastosRecurrentesHoySinConciliar:[],vencimientosAtrasados:[],cuotasSinDefinir:[],compromisosAntesProximoIngreso:[],...cambios},verdadFinanciera:{saldo:{tipo:"HECHO",confianza:"VERIFICADO",requiereReconciliacion:false,montoMinor:saldo,fuente:"ANCLA_RECONCILIADA",corte},disponibleHoy:{tipo:"DECISION",confianza:"ALTA",requiereReconciliacion:false,montoMinor:calc.disponibleHoyMinor,fuente:"REGLA_DISPONIBLE_HOY",corte}}};
};
