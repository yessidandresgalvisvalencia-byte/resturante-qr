"use strict";
// Validador puro del corte temporal para pagos de obligaciones recurrentes.
// No autoriza pagos futuros ni fechas inválidas; la propiedad del origen se
// comprueba por usuarioId dentro de la transacción MongoDB que persiste el pago.
function fechaEstrictaRecurrente(valor,etiqueta){
 if(!(valor instanceof Date)&&
   (typeof valor!=="string"||!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(valor)))
  throw Object.assign(new TypeError(etiqueta+" debe ser fecha ISO o Date"),{statusCode:400});
 // Validar el calendario civil escrito; Date.parse puede normalizar 30 de febrero.
 if(typeof valor==="string"){
  const offset=valor.match(/([+-])(\d{2}):(\d{2})$/);
  if(offset&&(Number(offset[2])>14||Number(offset[3])>59||
     (Number(offset[2])===14&&Number(offset[3])!==0)))
   throw Object.assign(new TypeError(etiqueta+" tiene un desfase horario inválido"),{statusCode:400});
  const [anio,mes,dia]=valor.slice(0,10).split("-").map(Number);
  const civil=new Date(0);
  civil.setUTCHours(0,0,0,0);
  civil.setUTCFullYear(anio,mes-1,dia);
  if(civil.getUTCFullYear()!==anio||civil.getUTCMonth()!==mes-1||civil.getUTCDate()!==dia)
   throw Object.assign(new TypeError(etiqueta+" contiene una fecha civil inexistente"),{statusCode:400});
 }
 const fecha=new Date(valor);
 if(!Number.isFinite(fecha.getTime()))
  throw Object.assign(new TypeError(etiqueta+" inválida"),{statusCode:400});
 return fecha;
}
function validarFechaPagoVinculado({fechaPago,fechaOrigen,ahora=new Date()}){
 const pago=fechaEstrictaRecurrente(fechaPago,"fechaPago");
 const origen=fechaEstrictaRecurrente(fechaOrigen,"fechaOrigen");
 const corte=fechaEstrictaRecurrente(ahora,"ahora");
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
 const pago=fechaEstrictaRecurrente(fechaPago,"fechaPago"),origen=fechaEstrictaRecurrente(fechaOrigen,"fechaOrigen");
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
 const instante=fechaEstrictaRecurrente(fecha,"fecha");
 if(!Number.isFinite(instante.getTime()))
  throw Object.assign(new TypeError("Fecha de pago inválida"),{statusCode:400});
 const partes=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(instante);
 const dato=t=>Number(partes.find(p=>p.type===t)?.value);
 const inicio=new Date(Date.UTC(dato("year"),dato("month")-1,dato("day"),5));
 return {inicio,fin:new Date(inicio.getTime()+86400000)};
}
// Períodos de vencimiento anclados a la fecha civil original en Colombia.
// Evita que un abono al día siguiente reinicie el cupo de una cuota mensual.
// La fecha final es exclusiva y usa UTC-5 (Bogotá no observa DST).
function periodoRecurrenteColombia({fechaOrigen,fechaPago,frecuencia}){
 const origen=fechaEstrictaRecurrente(fechaOrigen,"fechaOrigen"),pago=fechaEstrictaRecurrente(fechaPago,"fechaPago");
 if(!Number.isFinite(origen.getTime())||!Number.isFinite(pago.getTime()))
  throw Object.assign(new TypeError("Fecha de recurrencia inválida"),{statusCode:400});
 const civil=d=>{
  const p=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);
  const numero=x=>Number(p.find(v=>v.type===x)?.value);
  return {y:numero("year"),m:numero("month"),d:numero("day")};
 };
 const a=civil(origen),b=civil(pago);
 const diaUTC=x=>Date.UTC(x.y,x.m-1,x.d);
 const diaMes=(y,m,d)=>new Date(Date.UTC(y,m-1,Math.min(d,new Date(Date.UTC(y,m,0)).getUTCDate())));
 const inicioBase=diaUTC(a),pagoDia=diaUTC(b);
 if(pagoDia<inicioBase)
  throw Object.assign(new RangeError("Pago anterior a primera recurrencia"),{statusCode:400});
 let inicio,fin;
 const duracion=frecuencia==="DIARIA"?1:frecuencia==="SEMANAL"?7:frecuencia==="QUINCENAL"?15:null;
 if(duracion!==null){
  const paso=Math.floor((pagoDia-inicioBase)/(86400000*duracion));
  inicio=new Date(inicioBase+paso*duracion*86400000);
  fin=new Date(inicioBase+(paso+1)*duracion*86400000);
 }else if(frecuencia==="MENSUAL"){
  let n=(b.y-a.y)*12+b.m-a.m;
  const ocurrencia=k=>{
   const temp=new Date(Date.UTC(a.y,a.m-1+k,1));
   return diaMes(temp.getUTCFullYear(),temp.getUTCMonth()+1,a.d);
  };
  inicio=ocurrencia(n);
  if(inicio.getTime()>pagoDia){n--;inicio=ocurrencia(n);}
  fin=ocurrencia(n+1);
 }else if(frecuencia==="ANUAL"){
  let n=b.y-a.y;
  const ocurrencia=k=>diaMes(a.y+k,a.m,a.d);
  inicio=ocurrencia(n);
  if(inicio.getTime()>pagoDia){n--;inicio=ocurrencia(n);}
  fin=ocurrencia(n+1);
 }else throw Object.assign(new TypeError("Frecuencia recurrente inválida"),{statusCode:400});
 const sumarBogota=fecha=>new Date(fecha.getTime()+5*3600000);
 return {inicio:sumarBogota(inicio),fin:sumarBogota(fin)};
}
function validarTotalPeriodoRecurrente({importeObligacionMinor,yaPagadoMinor,nuevoPagoMinor}){
 for(const n of [importeObligacionMinor,yaPagadoMinor,nuevoPagoMinor])
  if(!Number.isSafeInteger(n)||n<0)
   throw Object.assign(new TypeError("Importes recurrentes requieren enteros seguros"),{statusCode:400});
 if(importeObligacionMinor===0||nuevoPagoMinor===0||BigInt(yaPagadoMinor)+BigInt(nuevoPagoMinor)>BigInt(importeObligacionMinor))
  throw Object.assign(new RangeError("El pago supera el saldo de esta recurrencia"),{statusCode:409});
 return importeObligacionMinor-yaPagadoMinor-nuevoPagoMinor;
}
module.exports={validarFechaPagoVinculado,validarNoDuplicarOrigenHoy,ventanaPagoColombia,periodoRecurrenteColombia,validarTotalPeriodoRecurrente};
