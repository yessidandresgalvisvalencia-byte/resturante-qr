"use strict";
// Valor civil canónico para input datetime-local con precisión de un segundo.
// Chromium omite :00 al serializar el valor; fill exige la misma representación.
function fechaHoraBogotaParaInput(fecha){
 if(!(fecha instanceof Date)||!Number.isFinite(+fecha))throw new TypeError("Fecha de ensayo inválida");
 const p=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(fecha),v=t=>p.find(x=>x.type===t).value;
 return v("year")+"-"+v("month")+"-"+v("day")+"T"+v("hour")+":"+v("minute")+(v("second")==="00"?"":":"+v("second"));
}
module.exports={fechaHoraBogotaParaInput};
