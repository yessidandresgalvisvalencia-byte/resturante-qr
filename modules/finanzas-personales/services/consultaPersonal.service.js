"use strict";
const ledger=require("./resumenLedgerPersonal.service");const patrimonio=require("./patrimonioCanonico.service");const Prestamo=require("../models/prestamoPersonal.model");
function money(n){return new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n);}
async function consultar(usuarioId,pregunta){const q=String(pregunta||"").trim().toLowerCase();if(!q)throw Object.assign(new Error("Pregunta requerida"),{statusCode:400});
 if(q.includes("patrimonio")){const p=await patrimonio.obtener(usuarioId);return{tipo:"PATRIMONIO",respuesta:"Tu patrimonio neto financiero registrado es "+money(p.patrimonioNetoMinor)+". Activos e inversiones suman "+money(p.activosMinor+p.inversionesMinor)+" y las deudas patrimoniales registradas suman "+money(p.deudasMinor)+".",datos:p,fuente:"patrimonio_canonico_v2"};}
 const r=await ledger.resumen(usuarioId);
 if(q.includes("deuda")||q.includes("credito")||q.includes("crédito")){const d=await Prestamo.find({usuarioId,direccion:"POR_PAGAR",estado:"ACTIVO"}).lean(),saldo=d.reduce((s,x)=>s+x.saldoMinor,0),cuotas=d.reduce((s,x)=>s+(x.cuotaMinor||0),0);return{tipo:"DEUDA",respuesta:"Tienes "+money(saldo)+" pendientes en deudas activas registradas y "+money(cuotas)+" en cuotas mensuales registradas.",datos:{saldoMinor:saldo,cuotasMinor:cuotas,deudas:d}};}
 if(q.includes("invert"))return{tipo:"INVERSION",respuesta:r.flujoLibreMinor>0?"El flujo libre del mes es "+money(r.flujoLibreMinor)+". Antes de asignarlo a inversión, GRUK debe comprobar liquidez, deuda, horizonte y tolerancia a pérdida.":"No hay flujo libre positivo este mes para asignar a inversión.",datos:r};
 return{tipo:"RESUMEN",respuesta:"Este mes: ingresos "+money(r.ingresosMinor)+", gastos "+money(r.gastosMinor)+", pagos de deuda "+money(r.pagosDeudaMinor)+" y flujo libre "+money(r.flujoLibreMinor)+".",datos:r};}
module.exports={consultar};
