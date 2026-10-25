"use strict";
// Plan SOLO LECTURA. Nunca ejecutar estas propuestas sin una transacción
// ACID con control optimista, autorización, asiento append-only y reauditoría.
const {createHash}=require("node:crypto");
function fallo(m){throw Object.assign(new Error("PLAN_RESERVAS: "+m),{statusCode:409});}
const codigos=new Set(["RESERVA_DESCUADRADA","FALTA_RESERVA",
 "RESERVA_SIN_ABONOS","PERIODO_INCORRECTO"]);
const entero=x=>typeof x==="string"&&/^(0|[1-9][0-9]*)$/.test(x);
function planearReparacionReservas({usuarioId,origenId,auditoria}){
 if(typeof usuarioId!=="string"||!/^[a-f0-9]{24}$/i.test(usuarioId)||
    typeof origenId!=="string"||!/^[a-f0-9]{24}$/i.test(origenId)||
    !auditoria||!Array.isArray(auditoria.anomalías)||
    !["COHERENTE","REQUIERE_CONCILIACION"].includes(auditoria.estado)||
    auditoria.soloLectura!==true||auditoria.aptoParaDisponibleHoy!==false)
  fallo("identidad o dictamen inválidos");
 const anomalies=auditoria.anomalías;
 if((auditoria.estado==="COHERENTE")!== (anomalies.length===0))
  fallo("estado y anomalías contradictorios");
 const periodos=new Set(),acciones=[];
 for(const a of anomalies){
  if(!a||!codigos.has(a.codigo)||typeof a.periodoInicio!=="string"||
     !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(a.periodoInicio)||
     !Number.isFinite(Date.parse(a.periodoInicio))||
     new Date(a.periodoInicio).toISOString()!==a.periodoInicio)
   fallo("anomalía no verificable");
  if(periodos.has(a.periodoInicio))fallo("anomalías múltiples del mismo período: revisión manual");
  periodos.add(a.periodoInicio);
  if(a.codigo==="PERIODO_INCORRECTO"||a.codigo==="RESERVA_SIN_ABONOS"){
   acciones.push({periodoInicio:a.periodoInicio,codigo:a.codigo,
    propuesta:"REVISION_MANUAL",deltaMinor:null});
   continue;
  }
  if(!entero(a.esperadoMinor))fallo("importe esperado inválido");
  const esperado=BigInt(a.esperadoMinor);
  let observado=0n;
  if(a.codigo==="RESERVA_DESCUADRADA"){
   if(!entero(a.observadoMinor))fallo("importe observado inválido");
   observado=BigInt(a.observadoMinor);
  }else if(a.observadoMinor!==undefined)fallo("reserva faltante con observado contradictorio");
  const delta=esperado-observado;
  // Indicación aritmética, no orden de escritura; ninguna mutación es automática.
  acciones.push({periodoInicio:a.periodoInicio,codigo:a.codigo,
   propuesta:a.codigo==="FALTA_RESERVA"?"CREAR_RESERVA_PREVIA_REVISION":
    "AJUSTAR_RESERVA_PREVIA_REVISION",actualMinor:observado.toString(),
   esperadoMinor:esperado.toString(),deltaMinor:delta.toString()});
 }
 acciones.sort((a,b)=>a.periodoInicio.localeCompare(b.periodoInicio));
 const fingerprint=createHash("sha256").update(JSON.stringify({
  version:1,usuarioId,origenId,acciones
 })).digest("hex");
 return Object.freeze({version:1,usuarioId,origenId,
  estado:acciones.length?"REQUIERE_CONCILIACION":"SIN_DIFERENCIAS",
  acciones,huellaDiagnostico:fingerprint,
  soloLectura:true,autorizaEscritura:false,aptoParaDisponibleHoy:false,
  requiereReauditoriaAtomica:true});
}
module.exports={planearReparacionReservas};
