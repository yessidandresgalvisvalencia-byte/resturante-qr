"use strict";
// Conciliación puramente informativa: una cuota comienza en su vencimiento
// civil de Bogotá (05:00 UTC) y termina al inicio de la cuota siguiente.
// Los abonos anticipados y sin vínculo inequívoco NO se distribuyen por IA.
const {programarVencimientosBrutos}=require("./programarVencimientosBrutosPersonal.service");
const {periodoRecurrenteColombia}=require("./vinculoRecurrenteV81.service");
function error(m,statusCode=409){throw Object.assign(new Error("CONCILIACION_CUOTAS: "+m),{statusCode});}
function inicioCivilBogota(fecha){
 const d=new Date(fecha);
 if(!Number.isFinite(d.getTime()))error("fecha inválida");
 const b=new Date(d.getTime()-5*3600000);
 return new Date(Date.UTC(b.getUTCFullYear(),b.getUTCMonth(),b.getUTCDate(),5));
}
function conciliarCuotasPrevistas({usuarioId,origen,pagos=[],desde,hasta}){
 if(!origen||String(origen.usuarioId)!==String(usuarioId)||
    !origen._id||origen.tipo!=="GASTO"||origen.impactoCaja!==false||
    origen.cuentaId!=null||origen.cuenta!=="SIN_CAJA"||
    origen.estado!=="ACTIVA"||!Array.isArray(pagos)||
    !Number.isSafeInteger(origen.montoMinor)||origen.montoMinor<=0)
  error("obligación original inválida");
 if(!origen.recurrente||origen.frecuencia==="NINGUNA")
  error("se requiere obligación recurrente");
 const cuotas=programarVencimientosBrutos({origen,desde,hasta});
 const periodos=new Map(),ids=new Set();
 for(const p of pagos){
  const id=String(p?._id||"");
  const f=new Date(p?.fecha);
  if(!p||!p._id||ids.has(id)||
     String(p.usuarioId)!==String(usuarioId)||
     String(p.recurrenteOrigenId)!==String(origen._id)||
     p.tipo!=="GASTO"||p.estado!=="ACTIVA"||p.impactoCaja===false||
     !Number.isSafeInteger(p.montoMinor)||p.montoMinor<=0||
     !Number.isFinite(f.getTime())||f<new Date(origen.fecha))
   error("abono inválido, duplicado o ajeno");
  ids.add(id);
  const periodo=periodoRecurrenteColombia({
   fechaOrigen:origen.fecha,fechaPago:f,frecuencia:origen.frecuencia
  });
  const clave=periodo.inicio.toISOString();
  const anterior=periodos.get(clave)||0n;
  const actual=anterior+BigInt(p.montoMinor);
  if(actual>BigInt(origen.montoMinor))
   error("abonos exceden importe de cuota");
  periodos.set(clave,actual);
 }
 let bruto=0n,pagado=0n,pendiente=0n;
 const resultados=[];
 for(const cuota of cuotas){
  const clave=inicioCivilBogota(cuota.fecha).toISOString();
  const aplicado=periodos.get(clave)||0n;
  const total=BigInt(cuota.montoMinor),resta=total-aplicado;
  if(resta<0n)error("sobrepago de cuota");
  bruto+=total;pagado+=aplicado;pendiente+=resta;
  resultados.push({fecha:cuota.fecha.toISOString(),periodoInicio:clave,
   montoBrutoMinor:total.toString(),pagadoMinor:aplicado.toString(),
   pendienteMinor:resta.toString(),
   estado:resta===0n?"PAGADA":aplicado>0n?"PARCIAL":"PENDIENTE"});
 }
 return {totalBrutoMinor:bruto.toString(),totalPagadoMinor:pagado.toString(),
  totalPendienteMinor:pendiente.toString(),cuotas:resultados,
  soloLectura:true,aptoParaDisponibleHoy:false,
  alcance:"SOLO_ABONOS_EXPLICITOS_VINCULADOS_SIN_COMPENSACIONES"};
}
module.exports={conciliarCuotasPrevistas,inicioCivilBogota};
