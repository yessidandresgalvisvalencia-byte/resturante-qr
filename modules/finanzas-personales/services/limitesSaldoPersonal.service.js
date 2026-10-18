"use strict";
// Un $inc de MongoDB no ejecuta por defecto los validadores del documento.
// Condicionar el saldo en el MISMO update evita desbordamientos por concurrencia.
function filtroSaldoSeguro(delta,{permitirNegativo=false}={}){
 if(!Number.isSafeInteger(delta))throw Object.assign(new TypeError("Delta monetario fuera de rango seguro"),{statusCode:400});
 const min=permitirNegativo?Number.MIN_SAFE_INTEGER:0;
 const max=Number.MAX_SAFE_INTEGER;
 if(delta<0)return {saldoMinor:{$gte:Math.max(min,min-delta),$lte:max}};
 if(delta>0)return {saldoMinor:{$gte:min,$lte:max-delta}};
 return {saldoMinor:{$gte:min,$lte:max}};
}
module.exports={filtroSaldoSeguro};
