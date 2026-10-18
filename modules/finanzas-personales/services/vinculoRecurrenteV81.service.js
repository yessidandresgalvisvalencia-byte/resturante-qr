"use strict";
// Validador puro del corte temporal para pagos de obligaciones recurrentes.
// No autoriza pagos futuros ni fechas inválidas; la propiedad del origen se
// comprueba por usuarioId dentro de la transacción MongoDB que persiste el pago.
function validarFechaPagoVinculado({fechaPago,fechaOrigen,ahora=new Date()}){
 const pago=new Date(fechaPago);
 const origen=new Date(fechaOrigen);
 const corte=new Date(ahora);
 if(!Number.isFinite(pago.getTime())||!Number.isFinite(origen.getTime())||
    !Number.isFinite(corte.getTime()))
  throw Object.assign(new TypeError("Fechas inválidas para pago recurrente"),{statusCode:400});
 if(pago<origen)
  throw Object.assign(new RangeError("Pago anterior a la obligación recurrente"),{statusCode:400});
 if(pago>corte)
  throw Object.assign(new RangeError("Pago recurrente futuro no puede registrarse como realizado"),{statusCode:400});
 return true;
}
// El movimiento original GASTO es un asiento de caja. Otro pago ligado
// a ese mismo origen y fecha civil duplicaría el débito ya registrado.
function validarNoDuplicarOrigenHoy({fechaPago,fechaOrigen,origenImpactoCaja=true}){
 const pago=new Date(fechaPago),origen=new Date(fechaOrigen);
 if(!Number.isFinite(pago.getTime())||!Number.isFinite(origen.getTime()))
  throw Object.assign(new TypeError("Fechas inválidas del movimiento"),{statusCode:400});
 if(origenImpactoCaja!==true)return true;
 const dia=d=>{
  const fmt=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"});
  return fmt.formatToParts(d).filter(p=>["year","month","day"].includes(p.type)).map(p=>p.value).join("-");
 };
 if(dia(pago)===dia(origen))
  throw Object.assign(new RangeError("El gasto recurrente original ya afecta caja en esta fecha; un pago adicional lo duplicaría"),{statusCode:409});
 return true;
}
// Rango de fecha civil de Bogotá (UTC-5, sin horario de verano).
function ventanaPagoColombia(fecha){
 const instante=new Date(fecha);
 if(!Number.isFinite(instante.getTime()))
  throw Object.assign(new TypeError("Fecha de pago inválida"),{statusCode:400});
 const partes=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(instante);
 const dato=t=>Number(partes.find(p=>p.type===t)?.value);
 const inicio=new Date(Date.UTC(dato("year"),dato("month")-1,dato("day"),5));
 return {inicio,fin:new Date(inicio.getTime()+86400000)};
}
function validarTotalPeriodoRecurrente({importeObligacionMinor,yaPagadoMinor,nuevoPagoMinor}){
 for(const n of [importeObligacionMinor,yaPagadoMinor,nuevoPagoMinor])
  if(!Number.isSafeInteger(n)||n<0)
   throw Object.assign(new TypeError("Importes recurrentes requieren enteros seguros"),{statusCode:400});
 if(importeObligacionMinor===0||nuevoPagoMinor===0||BigInt(yaPagadoMinor)+BigInt(nuevoPagoMinor)>BigInt(importeObligacionMinor))
  throw Object.assign(new RangeError("El pago supera el saldo de esta recurrencia"),{statusCode:409});
 return importeObligacionMinor-yaPagadoMinor-nuevoPagoMinor;
}
module.exports={validarFechaPagoVinculado,validarNoDuplicarOrigenHoy,ventanaPagoColombia,validarTotalPeriodoRecurrente};
