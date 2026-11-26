"use strict";
(function(root){
 const DOMINIO="FP_REGISTRO_HTTP_CTX_MIN_V1",oid=v=>typeof v==="string"&&/^[a-f0-9]{24}$/.test(v),hex=v=>typeof v==="string"&&/^[a-f0-9]{64}$/.test(v);
 function canon(v){if(v===null||typeof v==="string"||typeof v==="boolean")return JSON.stringify(v);if(typeof v==="number"&&Number.isSafeInteger(v))return String(v);if(Array.isArray(v))return"["+v.map(canon).join(",")+"]";if(v&&typeof v==="object")return"{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canon(v[k])).join(",")+"}";throw Error("Dato de registro no verificable");}
 function datosFuente(f){
  const id=v=>v==null?null:String(v),d={usuarioId:id(f.usuarioId),movimientoId:id(f._id),cuentaId:id(f.cuentaId),prestamoId:id(f.prestamoId),recurrenteOrigenId:id(f.recurrenteOrigenId),tipo:f.tipo,montoMinor:f.montoMinor,moneda:f.moneda,concepto:f.concepto,categoria:f.categoria,subcategoria:f.subcategoria,cuenta:f.cuenta,medioPago:f.medioPago,contraparte:f.contraparte,descripcion:f.descripcion,recurrente:f.recurrente,frecuencia:f.frecuencia,origen:f.origen,externalIdHash:f.externalIdHash,impactoCaja:f.impactoCaja,estado:f.estado};
  const fecha=new Date(f.fecha);if(!Number.isFinite(+fecha))throw Error("Fecha del original no verificable");d.fecha=fecha.toISOString();
  if(!oid(d.usuarioId)||!oid(d.movimientoId)||!(oid(d.cuentaId)||d.tipo==="PAGO_DEUDA"&&d.impactoCaja===false&&d.cuentaId===null)||[d.prestamoId,d.recurrenteOrigenId].some(v=>v!==null&&!oid(v))||!["INGRESO","GASTO","COBRO_PRESTAMO","PAGO_DEUDA"].includes(d.tipo)||d.tipo==="COBRO_PRESTAMO"&&!oid(d.prestamoId)||!Number.isSafeInteger(d.montoMinor)||d.montoMinor<1||d.moneda!=="COP"||d.estado!=="ACTIVA"||typeof d.impactoCaja!=="boolean"||typeof d.recurrente!=="boolean"||d.externalIdHash!==null&&!hex(d.externalIdHash))throw Error("Original de registro no verificable");
  for(const k of ["concepto","categoria","subcategoria","cuenta","medioPago","contraparte","descripcion","frecuencia","origen"])if(typeof d[k]!=="string")throw Error("Texto del original no verificable");
  if(!d.concepto.trim()||!d.categoria.trim())throw Error("Original incompleto");
  if(d.tipo==="PAGO_DEUDA"){
   const numero=/^Cuota ([1-9][0-9]{0,2}) confirmada(?: · pendiente de conciliación de origen)?$/.exec(d.descripcion),c=f.cicloCuota,keys=(v,k)=>v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).sort().join(",")===k;
   if(!oid(d.prestamoId)||d.recurrente||d.recurrenteOrigenId!==null||d.medioPago==="CREDITO"||!numero||Number(numero[1])>600||!Number.isSafeInteger(f.montoPagadoRealMinor)||f.montoPagadoRealMinor<d.montoMinor||!keys(c,"contexto,fechaPago,firma,impactoCaja,montoMinor,montoPagadoRealMinor,movimientoId,prestamoId,usuarioId,version")||c.version!==1||c.usuarioId!==d.usuarioId||c.movimientoId!==d.movimientoId||c.prestamoId!==d.prestamoId||c.montoMinor!==d.montoMinor||c.montoPagadoRealMinor!==f.montoPagadoRealMinor||c.impactoCaja!==d.impactoCaja||c.fechaPago!==d.fecha||!hex(c.firma)||!keys(c.contexto,"cuotaMinor,diaPago,fechaVencimiento,periodicidad,periodicidadConfirmada")||!Number.isSafeInteger(c.contexto.cuotaMinor)||c.contexto.cuotaMinor<0||typeof c.contexto.periodicidadConfirmada!=="boolean")throw Error("Cuota original no verificable");
   // Solo las cuotas añaden estos campos: hashes anteriores de ingreso/gasto/cobro conservan sus bytes.
   d.montoPagadoRealMinor=f.montoPagadoRealMinor;d.numeroCuota=Number(numero[1]);d.cicloCuota=JSON.parse(canon(c));
  }
  return d;
 }
 function payload({usuarioId,movimientoId,fuenteHash,auditoriaCompromiso}){if(!oid(usuarioId)||!oid(movimientoId)||!hex(fuenteHash)||!hex(auditoriaCompromiso))throw Error("Compromiso del registro no verificable");return{version:1,dominio:DOMINIO,usuarioId,movimientoId,fuenteHash,auditoriaCompromiso};}
 async function validarPublico(r,{usuarioId,movimientoId,original},digerir){
  if(r?.estado==="SIN_CONTEXTO_CONSERVADO"&&Object.keys(r).length===1)return r;
  if(!r||r.estado!=="CONTEXTO_CONSERVADO"||r.version!==1||r.dominio!==DOMINIO||r.usuarioId!==usuarioId||r.movimientoId!==movimientoId||!hex(r.hashRegistro)||r.contexto!==undefined||r.auditoriaRegistro!==undefined||!r.datos||r.datos.usuarioId!==usuarioId||r.datos.movimientoId!==movimientoId||r.datos.tipo!==original.tipo||r.datos.montoMinor!==original.montoMinor||r.datos.concepto!==original.concepto||r.datos.categoria!==original.categoria||r.contextoAuditoria?.origen!=="HTTP_SOCKET"||r.contextoAuditoria.identidadDispositivoVerificada!==false)throw Error("Contexto del original no verificable");
  if(r.datos.tipo==="PAGO_DEUDA"&&(r.datos.prestamoId!==original.prestamoId||r.datos.numeroCuota!==original.numeroCuota||r.datos.montoPagadoRealMinor!==original.montoPagadoRealMinor||r.datos.impactoCaja!==original.impactoCaja))throw Error("Capital y pago real no coinciden con el original");
  const c=r.contextoAuditoria;if(Object.keys(c).sort().join(",")!=="capturadoEn,dispositivoDeclarado,identidadDispositivoVerificada,ipExpuesta,navegadorDeclarado,origen,red"||c.ipExpuesta!==false||c.red!=="PEER_SOCKET_NO_CLIENTE_VERIFICADO"||typeof c.capturadoEn!=="string"||!Number.isFinite(Date.parse(c.capturadoEn)))throw Error("Resumen del registro no verificable");
  if(await digerir(canon(r.datos))!==r.fuenteHash||await digerir(canon(payload(r)))!==r.hashRegistro)throw Error("Hash del registro no coincide");return r;
 }
 const out={DOMINIO,canon,datosFuente,payload,validarPublico};if(typeof module!=="undefined"&&module.exports)module.exports=out;else root.RegistroAuditoriaPersonal=out;
})(typeof globalThis!=="undefined"?globalThis:this);
