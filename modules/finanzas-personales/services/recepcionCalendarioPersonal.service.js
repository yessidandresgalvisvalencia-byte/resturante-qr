"use strict";
const {fechaVerificable,diaCivilBogota}=require("./fechaPersonal.service");
const falla=(m,c=409)=>Object.assign(Error(m),{statusCode:c}),id=v=>typeof v==="string"&&/^[a-f0-9]{24}$/.test(v),esAccion=a=>["VINCULAR_RECEPCION","DESVINCULAR_RECEPCION"].includes(a);
const MOTIVOS_RECHAZO=Object.freeze(["INGRESO_OCUPADO","FUENTE_NO_COINCIDE","CUENTA_NO_DISPONIBLE"]);
const rechazo=(m,codigo)=>Object.assign(falla(m),{codigoRechazoRecepcion:codigo});
function validar(s){
 if(!esAccion(s.accion))return;
 if(s.accion==="VINCULAR_RECEPCION"){const r=s.recepcion,f=fechaVerificable(r?.fecha),p=fechaVerificable(r?.ocurrenciaFecha);if(!r||typeof r!=="object"||Array.isArray(r)||Object.keys(r).sort().join(",")!=="cerrarOcurrencia,cuentaId,fecha,montoMinor,movimientoId,ocurrenciaFecha"||r.cerrarOcurrencia!==true||!id(r.movimientoId)||!id(r.cuentaId)||!Number.isSafeInteger(r.montoMinor)||r.montoMinor<=0||typeof r.fecha!=="string"||!f||f.toISOString()!==r.fecha||typeof r.ocurrenciaFecha!=="string"||!/^\d{4}-\d\d-\d\d$/.test(r.ocurrenciaFecha)||!p)throw falla("Confirma movimiento, cuenta, monto y fechas exactas de recepción",400);}
 else{const r=s.recepcionReferencia;if(!r||typeof r!=="object"||Array.isArray(r)||Object.keys(r).sort().join(",")!=="ocurrenciaFecha,versionVinculo,vinculoHash"||typeof r.ocurrenciaFecha!=="string"||!/^\d{4}-\d\d-\d\d$/.test(r.ocurrenciaFecha)||!fechaVerificable(r.ocurrenciaFecha)||!Number.isSafeInteger(r.versionVinculo)||r.versionVinculo<1||r.versionVinculo>s.versionEsperada||! /^[a-f0-9]{64}$/.test(r.vinculoHash||""))throw falla("Referencia exacta del vínculo obligatoria",400);}
}
function validarRelacion(prev,s,fecha,eventos){
 if(s.accion==="VINCULAR_RECEPCION"){const r=s.recepcion,f=fechaVerificable(r.fecha),p=fechaVerificable(r.ocurrenciaFecha);if(!prev?.activo||prev.datos.fechaProxima!==r.ocurrenciaFecha||+f>+fecha||Math.abs(diaCivilBogota(f)-diaCivilBogota(p))>31*86400000)throw falla("Recepción requiere ocurrencia vigente y fecha real no futura dentro de 31 días");}
 if(s.accion==="DESVINCULAR_RECEPCION"){const r=s.recepcionReferencia,e=eventos.find(e=>e.secuencia===r.versionVinculo);if(!e||e.solicitud.accion!=="VINCULAR_RECEPCION"||e.hashActual!==r.vinculoHash||e.solicitud.recepcion.ocurrenciaFecha!==r.ocurrenciaFecha)throw falla("El vínculo cambió; consulta su referencia exacta");}
}
function siguiente(prev,s){
 if(!prev)throw falla("Calendario no encontrado",404);const rs=prev.recepciones||[];
 if(s.accion==="VINCULAR_RECEPCION"){if(!prev.activo||prev.datos.fechaProxima!==s.recepcion.ocurrenciaFecha||rs.some(r=>r.activa&&r.ocurrenciaFecha===s.recepcion.ocurrenciaFecha))throw falla("Ocurrencia retirada, distinta o ya vinculada");return{...prev,recepciones:[...rs,{...s.recepcion,previstoMinor:prev.datos.montoMinor,versionVinculo:s.versionEsperada+1,activa:true}]};}
 const r=s.recepcionReferencia;if(!rs.some(x=>x.activa&&x.versionVinculo===r.versionVinculo&&x.ocurrenciaFecha===r.ocurrenciaFecha))throw falla("El vínculo ya está anulado o no corresponde");return{...prev,recepciones:rs.map(x=>x.versionVinculo===r.versionVinculo?{...x,activa:false}:x)};
}
function coincide(tx,r,u){const f=fechaVerificable(tx?.fecha);return Boolean(tx&&String(tx.usuarioId)===String(u)&&String(tx._id)===r.movimientoId&&String(tx.cuentaId)===r.cuentaId&&tx.tipo==="INGRESO"&&tx.estado==="ACTIVA"&&tx.moneda==="COP"&&tx.impactoCaja===true&&tx.recurrente===false&&!tx.recurrenteOrigenId&&!tx.movimientoOrigenId&&tx.medioPago!=="CREDITO"&&Number.isSafeInteger(tx.montoMinor)&&tx.montoMinor===r.montoMinor&&f&&f.toISOString()===r.fecha);}
function enriquecer(u,calendarios,fuentes){
 const porId=new Map(fuentes.map(t=>[String(t._id),t]));if(porId.size!==fuentes.length)throw falla("Fuentes de ingreso repetidas");
 const usados=new Set();for(const c of calendarios)for(const r of c.recepciones||[])if(r.activa){if(usados.has(r.movimientoId))throw falla("Un ingreso aparece vinculado a varias ocurrencias");usados.add(r.movimientoId);}
 return calendarios.map(c=>{if(!c.recepciones)return c;const recepciones=c.recepciones.map(r=>({...r,estadoVigente:!r.activa?"DESVINCULADA":coincide(porId.get(r.movimientoId),r,u)?"VERIFICADA_EN_LEDGER":"REQUIERE_REVISION",diferenciaPrevistoMinor:Number(BigInt(r.montoMinor)-BigInt(r.previstoMinor))}));return{...c,recepciones,recepcionRequiereRevision:recepciones.some(r=>r.activa&&r.estadoVigente==="REQUIERE_REVISION"),ocurrenciaRecibida:recepciones.some(r=>r.activa&&r.ocurrenciaFecha===c.fechaProxima&&r.estadoVigente==="VERIFICADA_EN_LEDGER")};});
}
async function cargarVigentes(u,s){return require("./consultaCompensadaPersonal.service").consultarPeriodo({usuarioId:u,desde:"0001-01-01T00:00:00.000Z",hasta:"9999-12-31T23:59:59.999Z"},{session:s});}
async function exigirFuente(u,entrada,lectura,s){
 const r=entrada.recepcion;if(lectura.calendarios.some(c=>(c.recepciones||[]).some(x=>x.activa&&x.movimientoId===r.movimientoId)))throw rechazo("Ese ingreso ya está vinculado; consulta y revisa el vínculo existente","INGRESO_OCUPADO");
 const fuentes=lectura.fuentesRecepcion||await cargarVigentes(u,s),tx=fuentes.find(t=>String(t._id)===r.movimientoId);if(!coincide(tx,r,u))throw rechazo("El ingreso, cuenta, fecha o monto vigentes no coinciden","FUENTE_NO_COINCIDE");
 const cuenta=await require("../models/cuentaFinanciera.model").findOne({_id:r.cuentaId,usuarioId:u,activa:true,moneda:"COP"}).maxTimeMS(5000).session(s).lean();if(!cuenta)throw rechazo("Cuenta propia activa en COP no disponible","CUENTA_NO_DISPONIBLE");
}
module.exports={MOTIVOS_RECHAZO,esAccion,validar,validarRelacion,siguiente,coincide,enriquecer,cargarVigentes,exigirFuente};
