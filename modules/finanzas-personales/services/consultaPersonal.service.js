"use strict";
const legacy=require("./finanzasPersonales.service");const ledger=require("./resumenLedgerPersonal.service");
function money(n){return new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n);}
async function consultar(usuarioId,pregunta){const q=String(pregunta||"").trim().toLowerCase();if(!q)throw Object.assign(new Error("Pregunta requerida"),{statusCode:400});
 if(q.includes("patrimonio")){const p=await legacy.patrimonio(usuarioId);return{tipo:"PATRIMONIO",respuesta:"Patrimonio neto registrado: "+money(p.patrimonioNeto)+".",datos:p,fuente:"patrimonio_legacy_pendiente_migracion"};}
 const r=await ledger.resumen(usuarioId);
 if(q.includes("deuda")||q.includes("credito")||q.includes("crédito"))return{tipo:"DEUDA",respuesta:"Pagos de deuda registrados este mes: "+money(r.pagosDeudaMinor)+". Saldo total de obligaciones: "+money(r.deudaTotalLegacy)+".",datos:r};
 if(q.includes("invert"))return{tipo:"INVERSION",respuesta:r.flujoLibreMinor>0?"El flujo libre del mes es "+money(r.flujoLibreMinor)+". Antes de asignarlo a inversión, GRUK debe comprobar liquidez, deuda y perfil de riesgo.":"No hay flujo libre positivo este mes para asignar a inversión.",datos:r};
 return{tipo:"RESUMEN",respuesta:"Este mes: ingresos "+money(r.ingresosMinor)+", gastos "+money(r.gastosMinor)+", pagos de deuda "+money(r.pagosDeudaMinor)+" y flujo libre "+money(r.flujoLibreMinor)+".",datos:r};}
module.exports={consultar};