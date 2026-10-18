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
module.exports={validarFechaPagoVinculado};
