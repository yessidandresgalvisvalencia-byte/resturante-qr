"use strict";
// Conciliación de caja por cuenta: saldo inicial + movimientos netos = saldo esperado.
// Sólo importa enteros BigInt en centavos. Nunca deducir saldo inicial del flujo histórico.
function conciliarCuentaV81({saldoInicialCentavos,movimientos=[],saldoObservadoCentavos}={}){
 if(typeof saldoInicialCentavos!=="bigint"||typeof saldoObservadoCentavos!=="bigint"||!Array.isArray(movimientos))
  throw new TypeError("Se requiere saldo inicial y observado explícitos en BigInt");
 let entradas=0n,salidas=0n;
 const ids=new Set();
 for(const m of movimientos){
  if(!m||typeof m.id!=="string"||!m.id||ids.has(m.id)||typeof m.montoCentavos!=="bigint"||m.montoCentavos<=0n)
   throw new TypeError("Movimiento inválido o duplicado");
  ids.add(m.id);
  if(m.tipo==="ENTRADA")entradas+=m.montoCentavos;
  else if(m.tipo==="SALIDA")salidas+=m.montoCentavos;
  else throw new TypeError("Movimiento no clasificado: no inventar impacto en caja");
 }
 const saldoEsperadoCentavos=saldoInicialCentavos+entradas-salidas;
 const diferenciaCentavos=saldoObservadoCentavos-saldoEsperadoCentavos;
 return Object.freeze({estado:diferenciaCentavos===0n?"CONCILIADA":"DIFERENCIA",saldoEsperadoCentavos:saldoEsperadoCentavos.toString(),diferenciaCentavos:diferenciaCentavos.toString(),movimientosEvaluados:ids.size});
}
module.exports={conciliarCuentaV81};
