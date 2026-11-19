"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),I=require("../../modules/finanzas-personales/services/interpreteFinanciero.service");
test("hechos de hoy no inventan mediodía futuro y ayer conserva el día colombiano",()=>{
 const RealDate=Date;
 try{
  for(const instante of ["2026-11-19T05:00:00.000Z","2026-11-19T15:00:00.000Z","2026-11-20T04:59:59.000Z"]){
   global.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[instante]));}static now(){return +new RealDate(instante);}};
   for(const texto of ["Gasté 100 pesos en mercado","Recibí 100 pesos","Le presté 100 pesos a Ana","Me prestaron 100 pesos","Ahorré 100 pesos en ahorro","Pasé 100 pesos de Nequi a Bancolombia","Ana me pagó 100 pesos","Debo 1000 pesos, pago cuota 100 pesos cada 15"]){
    const item=I.interpretarSegmentoBase(texto);assert.equal(item.fecha.toISOString(),instante,texto);assert.ok(+item.fecha<=Date.now(),texto);
   }
   const ayer=I.interpretarSegmentoBase("Gasté ayer 100 pesos en mercado");assert.equal(ayer.fecha.toISOString(),"2026-11-18T17:00:00.000Z");
   const cobrar=I.cuentaPorCobrar("Ana me debe 100 pesos y me paga el 20");assert.equal(cobrar.fecha.toISOString(),instante);assert.equal(cobrar.estado,"REQUIERE_REVISION");
  }
 }finally{global.Date=RealDate;}
});
