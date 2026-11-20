"use strict";
const {diaCivilBogota,fechaVerificable}=require("./fechaPersonal.service");
const id=v=>typeof v?.toString==="function"&&/^[a-f\d]{24}$/i.test(v.toString());
// El calendario declara una previsión, nunca acredita dinero recibido.
// Un ingreso histórico recurrente no confirma la fecha o el monto del siguiente.
function resolver({usuarioId,calendarios,referencias=[],ahora}){
 if(!id(usuarioId)||!(ahora instanceof Date)||!Number.isFinite(+ahora)||!Array.isArray(calendarios)||!Array.isArray(referencias))throw new TypeError("Horizonte de ingreso inválido");
 if(calendarios.length>5000||referencias.length>5000)throw Object.assign(Error("Horizonte excede el límite verificable"),{statusCode:422});
 const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(ahora).map(x=>[x.type,x.value]));
 const y=Number(p.year),m=Number(p.month),hoy=diaCivilBogota(ahora);
 if(y<1000||y>9998)throw new RangeError("Corte fuera de rango");
 const fecha=(yy,mm,d)=>new Date(Date.UTC(yy,mm-1,Math.min(d,new Date(Date.UTC(yy,mm,0)).getUTCDate()),5));
 const vistos=new Set(),fuentes=new Map(),pendientes=[],candidatos=[];
 for(const r of referencias){
  if(!id(r?._id)||fuentes.has(String(r._id))||String(r.usuarioId)!==String(usuarioId))throw new TypeError("Referencia de ingreso inválida");
  fuentes.set(String(r._id),r);
 }
 for(const c of calendarios){
  const fuenteId=id(c?._id)?String(c._id):null;
  const pendiente=motivo=>pendientes.push({calendarioId:fuenteId,motivo});
  if(!fuenteId||vistos.has(fuenteId)||String(c.usuarioId)!==String(usuarioId)||c.activo!==true||c.tipo!=="INGRESO"||c.frecuencia!=="MENSUAL"||typeof c.concepto!=="string"||!c.concepto.trim()||c.concepto.length>140){pendiente("CALENDARIO_INVALIDO");continue;}
  vistos.add(fuenteId);
  if(c.recepcionRequiereRevision===true){pendiente("RECEPCION_REQUIERE_REVISION");continue;}
  if(c.recepcionPendienteCierre===true){pendiente("RECEPCION_PARCIAL_SIN_CIERRE");continue;}
  if(c.ocurrenciaRecibida===true){pendiente("OCURRENCIA_YA_VINCULADA");continue;}
  if(!Number.isSafeInteger(c.diaMes)||c.diaMes<1||c.diaMes>31){pendiente("DIA_INVALIDO");continue;}
  if(!Number.isSafeInteger(c.montoMinor)||c.montoMinor<=0){pendiente("MONTO_PENDIENTE");continue;}
  if(c.sourceId!=null){const r=fuentes.get(String(c.sourceId));if(!id(c.sourceId)||!r||r.tipo!=="INGRESO"||r.estado==="ANULADA"){pendiente("REFERENCIA_NO_VERIFICABLE");continue;}}
  let f=c.modo==="EVENTOS_V1"?fechaVerificable(c.fechaProxima):fecha(y,m,c.diaMes);
  if(!f||c.modo==="EVENTOS_V1"&&f.getUTCDate()!==Math.min(c.diaMes,new Date(Date.UTC(f.getUTCFullYear(),f.getUTCMonth()+1,0)).getUTCDate())){pendiente("FECHA_EXPLICITA_INVALIDA");continue;}
  if(c.modo==="EVENTOS_V1"&&diaCivilBogota(f)<hoy){pendiente("INGRESO_PREVISTO_VENCIDO");continue;}
  if(diaCivilBogota(f)===hoy){pendiente("INGRESO_HOY_SIN_CONFIRMAR");continue;}
  if(diaCivilBogota(f)<hoy)f=fecha(m===12?y+1:y,m===12?1:m+1,c.diaMes);
  candidatos.push({fecha:f,montoMinor:c.montoMinor,concepto:c.concepto,calendarioId:fuenteId});
 }
 if(!calendarios.length)pendientes.push({calendarioId:null,motivo:"SIN_CALENDARIO_EXPLICITO"});
 candidatos.sort((a,b)=>+a.fecha-+b.fecha||a.calendarioId.localeCompare(b.calendarioId));
 if(pendientes.length||!candidatos.length)return{conocido:false,proximoIngreso:null,pendientes};
 const primeros=candidatos.filter(x=>+x.fecha===+candidatos[0].fecha);
 const suma=primeros.reduce((s,x)=>s+BigInt(x.montoMinor),0n);
 if(suma>BigInt(Number.MAX_SAFE_INTEGER))return{conocido:false,proximoIngreso:null,pendientes:[{calendarioId:null,motivo:"MONTO_FUERA_DE_RANGO"}]};
 return{conocido:true,pendientes:[],proximoIngreso:{fecha:new Date(+primeros[0].fecha),montoMinor:Number(suma),concepto:primeros.length===1?primeros[0].concepto:"Ingresos previstos registrados",calendarioIds:primeros.map(x=>x.calendarioId),fuente:"CALENDARIO_EXPLICITO",garantizado:false}};
}
module.exports={resolver};
