"use strict";
// Proyección de saldos: solo a partir de una cadena íntegra y valores BigInt.
// Correcciones/anulaciones se contabilizan como reversas del evento original.
function proyectarSaldoV81(eventos){
 if(!Array.isArray(eventos))throw new TypeError("Eventos inválidos");
 const originales=new Map(),revertidos=new Set();
 let saldo=0n,ingresos=0n,gastos=0n;
 for(const e of eventos){
  if(!e||typeof e.id!=="string"||typeof e.tipo!=="string"||
     typeof e.montoCentavos!=="bigint"||e.montoCentavos<0n)throw new TypeError("Evento inválido");
  if(e.tipo==="INGRESO"||e.tipo==="GASTO"){
   if(originales.has(e.id))throw new Error("Evento duplicado");
   originales.set(e.id,{tipo:e.tipo,montoCentavos:e.montoCentavos});
   if(e.tipo==="INGRESO"){saldo+=e.montoCentavos;ingresos+=e.montoCentavos;}
   else{saldo-=e.montoCentavos;gastos+=e.montoCentavos;}
  }else if(e.tipo==="ANULACION"){
   if(typeof e.corrigeId!=="string"||!originales.has(e.corrigeId)||revertidos.has(e.corrigeId))
    throw new Error("Anulación inválida");
   const origen=originales.get(e.corrigeId);
   if(origen.tipo==="INGRESO"){saldo-=origen.montoCentavos;ingresos-=origen.montoCentavos;}
   else{saldo+=origen.montoCentavos;gastos-=origen.montoCentavos;}
   revertidos.add(e.corrigeId);
  }else throw new Error("Proyección de correcciones no implementada: no inferir saldos");
 }
 return Object.freeze({saldoCentavos:saldo,ingresosCentavos:ingresos,gastosCentavos:gastos,cantidad:eventos.length});
}
function conciliarContraReferenciaV81(proyeccion,saldoReferenciaCentavos){
 if(typeof saldoReferenciaCentavos!=="bigint"||typeof proyeccion?.saldoCentavos!=="bigint")
  throw new TypeError("Saldos BigInt requeridos");
 const diferenciaCentavos=proyeccion.saldoCentavos-saldoReferenciaCentavos;
 return Object.freeze({coincide:diferenciaCentavos===0n,diferenciaCentavos});
}
module.exports={proyectarSaldoV81,conciliarContraReferenciaV81};
