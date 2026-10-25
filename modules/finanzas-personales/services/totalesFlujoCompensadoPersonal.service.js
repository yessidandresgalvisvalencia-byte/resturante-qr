"use strict";
function exacto(n){
 if(n>BigInt(Number.MAX_SAFE_INTEGER)||n<BigInt(Number.MIN_SAFE_INTEGER))
  throw new RangeError("Total de flujo fuera de rango seguro");
 return Number(n);
}
function calcularFlujo(rows,{incluirPrestamos=false}={}){
 if(!Array.isArray(rows))throw new TypeError("Movimientos obligatorios");
 let ingresos=0n,gastos=0n,pagos=0n;
 for(const x of rows){
  if(!x||!["ACTIVA","ANULADA"].includes(x.estado))throw new TypeError("Estado de movimiento inválido");
  if(x.estado==="ANULADA")continue;
  if(!Number.isSafeInteger(x.montoMinor)||x.montoMinor<=0)throw new TypeError("Monto de flujo inseguro");
  const monto=BigInt(x.montoMinor);
  if(x.tipo==="INGRESO"||incluirPrestamos&&["PRESTAMO_RECIBIDO","COBRO_PRESTAMO"].includes(x.tipo))ingresos+=monto;
  if(x.tipo==="GASTO"||incluirPrestamos&&x.tipo==="PRESTAMO_OTORGADO")gastos+=monto;
  if(x.tipo==="PAGO_DEUDA")pagos+=monto;
 }
 return {ingresosMinor:exacto(ingresos),gastosMinor:exacto(gastos),pagosDeudaMinor:exacto(pagos),
  flujoNetoMinor:exacto(ingresos-gastos-pagos),moneda:"COP"};
}
module.exports={calcularFlujo};
