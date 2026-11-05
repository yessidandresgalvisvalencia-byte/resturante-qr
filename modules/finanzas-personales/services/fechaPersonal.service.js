"use strict";
// Las fechas civiles pertenecen a Colombia; los instantes requieren zona explícita.
// No aceptar coerciones (null, números, arrays) ni fechas normalizadas por Date.
function fechaVerificable(valor){
 if(valor instanceof Date)return Number.isFinite(valor.getTime())?new Date(valor.getTime()):null;
 if(typeof valor!=="string")return null;
 const m=/^([1-9]\d{3})-(\d{2})-(\d{2})(?:T([0-2]\d):([0-5]\d):([0-5]\d)(?:\.(\d{1,3}))?(Z|[+-](\d{2}):(\d{2})))?$/.exec(valor);
 if(!m)return null;
 const y=Number(m[1]),mes=Number(m[2]),dia=Number(m[3]);
 const civil=new Date(Date.UTC(y,mes-1,dia));
 if(civil.getUTCFullYear()!==y||civil.getUTCMonth()!==mes-1||civil.getUTCDate()!==dia)return null;
 if(m[4]&&(Number(m[4])>23||Number(m[9])>14||Number(m[10])>59||Number(m[9])===14&&Number(m[10])!==0))return null;
 const fecha=new Date(m[4]?valor:valor+"T05:00:00.000Z");
 return Number.isFinite(fecha.getTime())?fecha:null;
}
function diaCivilBogota(date){
 const p=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
 const x=Object.fromEntries(p.map(v=>[v.type,v.value]));
 return Date.UTC(Number(x.year),Number(x.month)-1,Number(x.day));
}
module.exports={fechaVerificable,diaCivilBogota};
