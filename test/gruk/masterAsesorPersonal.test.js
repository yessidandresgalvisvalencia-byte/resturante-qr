"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const m=require("../../modules/finanzas-personales/services/masterAsesorPersonal.service");
test("seguimientos se reconocen sin inventar una conversación",()=>{
 assert.equal(m.seguimiento("¿Y si pago después?"),true);
 assert.equal(m.seguimiento("Compré una moto"),false);
 assert.equal(m.encontrarContexto([],"¿Y si pago después?"),null);
 const ref=m.encontrarContexto([{mensaje:"Quiero financiar unos zapatos",clase:"INTENCION"}],"¿Y si pago después?");
 assert.equal(ref.mensaje,"Quiero financiar unos zapatos");
});
test("el asesor no presenta saldo sin verificar como confirmado",()=>{
 const estado=m.estadoConocido({asesor:{saldoRealConocido:false,saldoConfiabilidad:"NO_VERIFICADO"},caja:{comprometidoMinor:450000}});
 assert.equal(estado.disponible,null);
 assert.match(m.armarRespuesta("Análisis",estado),/No hay saldo disponible verificado/);
 assert.match(m.armarRespuesta("Análisis",estado),/No se creó ningún movimiento/);
});
