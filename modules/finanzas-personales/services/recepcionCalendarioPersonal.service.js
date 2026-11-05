"use strict";
const {fechaVerificable,diaCivilBogota}=require("./fechaPersonal.service");
const falla=(m,c=409)=>Object.assign(Error(m),{statusCode:c}),id=v=>typeof v==="string"&&/^[a-f0-9]{24}$/.test(v),esAccion=a=>["VINCULAR_RECEPCION","DESVINCULAR_RECEPCION","REGISTRAR_RECEPCION"].includes(a);
const MOTIVOS_RECHAZO=Object.freeze(["INGRESO_OCUPADO","FUENTE_NO_COINCIDE","CUENTA_NO_DISPONIBLE"]);
const rechazo=(m,codigo)=>Object.assign(falla(m),{codigoRechazoRecepcion:codigo});
function validar(s){
 if(!esAccion(s.accion))return;
 if(s.accion==="REGISTRAR_RECEPCION"){const d=s.datosIngreso,r=s.recepcion;if(!r||Object.keys(r).sort().join(",")!=="cerrarOcurrencia,cuentaId,fecha,montoMinor,ocurrenciaFecha"||!d||typeof d!=="object"||Array.isArray(d)||Object.keys(d).sort().join(",")!=="categoria,concepto,medioPago"||typeof d.concepto!=="string"||!d.concepto.trim()||d.concepto.length>140||/[\u0000-\u001f\u007f]/.test(d.concepto)||!["SALARIO","HONORARIOS","VENTAS","OTROS"].includes(d.categoria)||!["EFECTIVO","TRANSFERENCIA","DEBITO"].includes(d.medioPago))throw falla("Confirma concepto, categoría, medio e ingreso nuevo exacto",400);validar({...s,accion:"VINCULAR_RECEPCION",recepcion:{...r,movimientoId:"0".repeat(24)}});return;}

 if(s.accion==="VINCULAR_RECEPCION"){const r=s.recepcion,f=fechaVerificable(r?.fecha),p=fechaVerificable(r?.ocurrenciaFecha);if(!r||typeof r!=="object"||Array.isArray(r)||Object.keys(r).sort().join(",")!=="cerrarOcurrencia,cuentaId,fecha,montoMinor,movimientoId,ocurrenciaFecha"||r.cerrarOcurrencia!==true||!id(r.movimientoId)||!id(r.cuentaId)||!Number.isSafeInteger(r.montoMinor)||r.montoMinor<=0||typeof r.fecha!=="string"||!f||f.toISOString()!==r.fecha||typeof r.ocurrenciaFecha!=="string"||!/^\d{4}-\d\d-\d\d$/.test(r.ocurrenciaFecha)||!p)throw falla("Confirma movimiento, cuenta, monto y fechas exactas de recepción",400);}
 else{const r=s.recepcionReferencia;if(!r||typeof r!=="object"||Array.isArray(r)||Object.keys(r).sort().join(",")!=="ocurrenciaFecha,versionVinculo,vinculoHash"||typeof r.ocurrenciaFecha!=="string"||!/^\d{4}-\d\d-\d\d$/.test(r.ocurrenciaFecha)||!fechaVerificable(r.ocurrenciaFecha)||!Number.isSafeInteger(r.versionVinculo)||r.versionVinculo<1||r.versionVinculo>s.versionEsperada||! /^[a-f0-9]{64}$/.test(r.vinculoHash||""))throw falla("Referencia exacta del vínculo obligatoria",400);}
}
function validarRelacion(prev,s,fecha,eventos){
 if(s.accion==="VINCULAR_RECEPCION"){const r=s.recepcion,f=fechaVerificable(r.fecha),p=fechaVerificable(r.ocurrenciaFecha);if(!prev?.activo||prev.datos.fechaProxima!==r.ocurrenciaFecha||+f>+fecha||Math.abs(diaCivilBogota(f)-diaCivilBogota(p))>31*86400000)throw falla("Recepción requiere ocurrencia vigente y fecha real no futura dentro de 31 días");}
 if(s.accion==="DESVINCULAR_RECEPCION"){const r=s.recepcionReferencia,e=eventos.find(e=>e.secuencia===r.versionVinculo);if(!e||!["VINCULAR_RECEPCION","REGISTRAR_RECEPCION"].includes(e.solicitud.accion)||e.hashActual!==r.vinculoHash||e.solicitud.recepcion.ocurrenciaFecha!==r.ocurrenciaFecha)throw falla("El vínculo cambió; consulta su referencia exacta");}
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
// Solo ofrece ingresos existentes; nunca infiere recepción por monto/concepto ni crea caja.
function elegibles(u,c,calendarios,fuentes,cuentas,ahora){
 if(!c?.activo||c.recepciones?.some(r=>r.activa&&r.ocurrenciaFecha===c.fechaProxima))throw falla("Revisa o anula el vínculo vigente antes de elegir otra recepción");
 if(!Array.isArray(fuentes)||fuentes.length>5000||!Array.isArray(cuentas)||cuentas.length>5000)throw falla("Fuentes de recepción exceden capacidad",422);
 const usadas=new Set(calendarios.flatMap(x=>(x.recepciones||[]).filter(r=>r.activa).map(r=>r.movimientoId))),porCuenta=new Map(cuentas.map(x=>[String(x._id),x]));if(porCuenta.size!==cuentas.length||new Set(fuentes.map(x=>String(x._id))).size!==fuentes.length)throw falla("Fuentes de recepción repetidas");
 const filas=[];for(const tx of fuentes){const f=fechaVerificable(tx.fecha),cuenta=porCuenta.get(String(tx.cuentaId));if(!f||+f>+ahora||Math.abs(diaCivilBogota(f)-diaCivilBogota(fechaVerificable(c.fechaProxima)))>31*86400000||usadas.has(String(tx._id))||!cuenta||String(cuenta.usuarioId)!==String(u)||cuenta.activa!==true||cuenta.moneda!=="COP")continue;
 const r={movimientoId:String(tx._id),cuentaId:String(tx.cuentaId),montoMinor:tx.montoMinor,fecha:f.toISOString(),ocurrenciaFecha:c.fechaProxima};if(!coincide(tx,r,u))continue;filas.push({...r,concepto:typeof tx.concepto==="string"?tx.concepto.slice(0,500):"Ingreso registrado",cuentaNombre:typeof cuenta.nombre==="string"?cuenta.nombre.slice(0,140):"Cuenta registrada"});}
 return filas.sort((a,b)=>b.fecha.localeCompare(a.fecha)||a.movimientoId.localeCompare(b.movimientoId));
}
function idIngreso(u,k){return require("node:crypto").createHash("sha256").update(JSON.stringify({usuarioId:String(u),solicitudId:k,producto:"INGRESO_RECEPCION_V1"})).digest("hex").slice(0,24);}
function comoVinculo(s,identidad){if(s.accion!=="REGISTRAR_RECEPCION")return s;if(!identidad?.usuarioId||!identidad?.solicitudId)throw falla("Identidad de recepción nueva requerida",400);return{...s,accion:"VINCULAR_RECEPCION",recepcion:{...s.recepcion,movimientoId:idIngreso(identidad.usuarioId,identidad.solicitudId)}};}
async function registrarNuevo(u,k,entrada,session){
 const r=entrada.recepcion,d=entrada.datosIngreso,cuenta=await require("../models/cuentaFinanciera.model").findOne({_id:r.cuentaId,usuarioId:u,activa:true,moneda:"COP"}).maxTimeMS(5000).session(session).lean();if(!cuenta)throw falla("Cuenta propia activa en COP no disponible",404);
 const tx=await require("./flujoCajaPersonal.service").registrarTransaccion(u,{tipo:"INGRESO",montoMinor:r.montoMinor,fecha:new Date(r.fecha),cuenta:cuenta.nombre,concepto:d.concepto,categoria:d.categoria,medioPago:d.medioPago,moneda:"COP",recurrente:false,origen:"MANUAL",externalId:"cal_nueva_"+k},{session,idMovimiento:idIngreso(u,k)});if(String(tx.cuentaId)!==r.cuentaId)throw falla("Identidad de cuenta no coincide; requiere revisión");return tx;
}
module.exports={idIngreso,comoVinculo,registrarNuevo,elegibles,MOTIVOS_RECHAZO,esAccion,validar,validarRelacion,siguiente,coincide,enriquecer,cargarVigentes,exigirFuente};
