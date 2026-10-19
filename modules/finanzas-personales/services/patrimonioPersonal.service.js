"use strict";
const mongoose=require("mongoose");const Cuenta=require("../models/cuentaFinanciera.model");const Activo=require("../models/ActivoPatrimonial");const Prestamo=require("../models/prestamoPersonal.model");const Transaccion=require("../models/TransaccionPersonal");const Outbox=require("../models/outboxPersonal.model");const crypto=require("crypto");
function fechaContableValidaPersonal(fecha){
 return fecha instanceof Date&&Number.isFinite(fecha.getTime())&&fecha.getTime()<=Date.now();
}
function exigirCuentasCopPatrimonio(cuentas){
 if(!Array.isArray(cuentas))throw new TypeError("Cuentas patrimoniales inválidas");
 for(const cuenta of cuentas){
  if(cuenta?.moneda!=="COP"||cuenta.activa!==true)
   throw Object.assign(new Error("Cuenta sin moneda COP o inactiva; requiere conciliación"),{statusCode:409});
 }
 return true;
}
function evaluarIntegridadAnclasPersonales(cuentas){
 if(!Array.isArray(cuentas))throw new TypeError("Cuentas de patrimonio inválidas");
 const cuentasVerificadas=cuentas.filter(x=>x&&
  fechaContableValidaPersonal(x.saldoVerificadoEn)&&
  x.requiereReconciliacion===false&&Number.isSafeInteger(x.saldoMinor));
 const cuentasAncladas=cuentas.filter(x=>x&&
  Number.isSafeInteger(x.saldoAnclaMinor)&&
  fechaContableValidaPersonal(x.saldoAnclaEn)&&
  x.requiereReconciliacion===false);
 const anclaCompleta=cuentas.length>0&&cuentasAncladas.length===cuentas.length;
 // No certificar un saldo con una verificación anterior a la última ancla.
 // La reconciliación real escribe ambas marcas en el mismo instante.
 const fechasCoherentes=cuentas.every(x=>x&&
  fechaContableValidaPersonal(x.saldoVerificadoEn)&&
  fechaContableValidaPersonal(x.saldoAnclaEn)&&
  x.saldoVerificadoEn.getTime()>=x.saldoAnclaEn.getTime());
 const saldoVerificado=anclaCompleta&&cuentasVerificadas.length===cuentas.length&&fechasCoherentes;
 return {cuentasVerificadas,cuentasAncladas,anclaCompleta,saldoVerificado};
}
function exigirMovimientosActivosCopPatrimonio(movimientos){
 if(!Array.isArray(movimientos))throw new TypeError("Historial financiero inválido");
 for(const m of movimientos){
  if(m?.estado!=="ACTIVA"||m.moneda!=="COP")
   throw Object.assign(new Error("Movimiento con estado o moneda inconsistente; requiere conciliación"),{statusCode:409});
 }
 return true;
}
function exigirFechasCajaNoFuturasPatrimonio(movimientos){
 if(!Array.isArray(movimientos))throw new TypeError("Movimientos patrimoniales inválidos");
 const ahora=Date.now();
 for(const movimiento of movimientos){
  const fecha=movimiento?.fecha==null?null:new Date(movimiento.fecha);
  if(!fecha||!Number.isFinite(fecha.getTime())||fecha.getTime()>ahora)
   throw Object.assign(new Error("Movimiento de caja sin fecha válida o fechado en el futuro; requiere conciliación"),{statusCode:409});
 }
 return true;
}
function exigirMovimientosUnicosPatrimonio(movimientos,{exigirId=false}={}){
 if(!Array.isArray(movimientos))throw new TypeError("Movimientos patrimoniales inválidos");
 const vistos=new Set();
 for(const movimiento of movimientos){
  const id=movimiento?._id;
  if(id==null){
   if(exigirId)throw Object.assign(new Error("Movimiento sin identidad; requiere conciliación"),{statusCode:409});
   continue;
  }
  if(!mongoose.isValidObjectId(id)||vistos.has(String(id)))
   throw Object.assign(new Error("Movimientos duplicados o con identidad inválida; requiere conciliación"),{statusCode:409});
  vistos.add(String(id));
 }
 return true;
}
function saldoCuentasDesdeAnclas(cuentas,movimientos){
 if(!Array.isArray(cuentas)||!Array.isArray(movimientos))throw new TypeError("Datos de cuentas inválidos");
 exigirMovimientosUnicosPatrimonio(movimientos);
 // El nombre libre no prueba pertenencia: un huérfano posterior a cualquier
 // ancla podría alterar la caja de una cuenta, aunque su etiqueta no coincida.
 const anclas=cuentas.map(cuenta=>{
  if(!Number.isSafeInteger(cuenta?.saldoAnclaMinor)||!fechaContableValidaPersonal(cuenta?.saldoAnclaEn))
   throw Object.assign(new Error("Cuenta sin ancla válida"),{statusCode:409});
  return cuenta.saldoAnclaEn.getTime();
 });
 const primeraAncla=anclas.length?Math.min(...anclas):null;
 const idsActivos=new Set(cuentas.map(c=>String(c._id)));
 if(idsActivos.size!==cuentas.length||cuentas.some(c=>!mongoose.isValidObjectId(c?._id)))
  throw Object.assign(new Error("Cuentas de conciliación duplicadas o con identidad inválida"),{statusCode:409});
 for(const movimiento of movimientos){
  if(movimiento?.fecha==null)
   throw Object.assign(new Error("Movimiento sin fecha; requiere conciliación"),{statusCode:409});
  const fecha=new Date(movimiento.fecha);
  if(!Number.isFinite(fecha.getTime()))
   throw Object.assign(new Error("Movimiento con fecha inválida; requiere conciliación"),{statusCode:409});
  if(primeraAncla!==null&&fecha.getTime()>primeraAncla){
   if(movimiento.cuentaId==null)
    throw Object.assign(new Error("Movimiento histórico sin cuentaId; requiere conciliación manual"),{statusCode:409});
   if(!mongoose.isValidObjectId(movimiento.cuentaId)||!idsActivos.has(String(movimiento.cuentaId)))
    throw Object.assign(new Error("Movimiento dirigido a cuenta inactiva, inexistente o no autorizada; requiere conciliación"),{statusCode:409});
  }
 }
 let total=0;
 for(const cuenta of cuentas){
  if(!Number.isSafeInteger(cuenta?.saldoAnclaMinor)||!fechaContableValidaPersonal(cuenta?.saldoAnclaEn))
   throw Object.assign(new Error("Cuenta sin ancla válida"),{statusCode:409});
  const posteriores=[];
  for(const x of movimientos){
   if(x?.fecha==null)
    throw Object.assign(new Error("Movimiento sin fecha; requiere conciliación"),{statusCode:409});
   const fecha=new Date(x.fecha);
   if(!Number.isFinite(fecha.getTime()))
    throw Object.assign(new Error("Movimiento con fecha inválida; requiere conciliación"),{statusCode:409});
   if(x.cuentaId!=null&&String(x.cuentaId)===String(cuenta._id)&&fecha.getTime()===cuenta.saldoAnclaEn.getTime())
    throw Object.assign(new Error("Movimiento simultáneo al ancla; orden contable no verificable"),{statusCode:409});
   if(fecha<=cuenta.saldoAnclaEn)continue;
   if(x.cuentaId!=null&&String(x.cuentaId)===String(cuenta._id))posteriores.push(x);
  }
  const parcial=saldoDesdeAncla(cuenta.saldoAnclaMinor,posteriores);
  if(!Number.isSafeInteger(parcial)||!Number.isSafeInteger(total+parcial))
   throw Object.assign(new Error("Suma patrimonial fuera de rango"),{statusCode:409});
  total+=parcial;
 }
 return total;
}
function saldoDesdeAncla(saldoAnclaMinor,movimientos){
 if(!Number.isSafeInteger(saldoAnclaMinor)||!Array.isArray(movimientos))
  throw Object.assign(new Error("Ancla o movimientos de saldo inválidos"),{statusCode:409});
 let saldo=BigInt(saldoAnclaMinor);
 for(const movimiento of movimientos){
  saldo+=BigInt(deltaCaja(movimiento));
  if(saldo>BigInt(Number.MAX_SAFE_INTEGER)||saldo<BigInt(Number.MIN_SAFE_INTEGER))
   throw Object.assign(new Error("Movimiento excede el rango monetario seguro"),{statusCode:409});
 }
 return Number(saldo);
}
function deltaCaja(x){
 if(!x||!Number.isSafeInteger(x.montoMinor)||x.montoMinor<=0)
  throw Object.assign(new Error("Movimiento sin monto entero positivo; requiere conciliación"),{statusCode:409});
 if(x.impactoCaja===false||(x.tipo==="GASTO"&&x.medioPago==="CREDITO"))return 0;
 if(!["INGRESO","GASTO","PAGO_DEUDA","PRESTAMO_RECIBIDO","PRESTAMO_OTORGADO","COBRO_PRESTAMO"].includes(x.tipo))
  throw Object.assign(new Error("Tipo de movimiento no clasificable para caja"),{statusCode:409});
 if(x.tipo==="PAGO_DEUDA"&&x.montoPagadoRealMinor!=null&&
   (!Number.isSafeInteger(x.montoPagadoRealMinor)||x.montoPagadoRealMinor<=0))
  throw Object.assign(new Error("Pago real de deuda inválido; requiere conciliación"),{statusCode:409});
 return ["INGRESO","PRESTAMO_RECIBIDO","COBRO_PRESTAMO"].includes(x.tipo)?x.montoMinor:
  -(x.tipo==="PAGO_DEUDA"&&x.montoPagadoRealMinor!=null?x.montoPagadoRealMinor:x.montoMinor);
}
function safe(n){
 if(typeof n==="string"){
  if(!/^\d+$/.test(n))throw Object.assign(new Error("Monto inválido"),{statusCode:400});
  const valor=BigInt(n);
  if(valor>BigInt(Number.MAX_SAFE_INTEGER))
   throw Object.assign(new Error("Monto fuera de rango"),{statusCode:400});
  return Number(valor);
 }
 if(typeof n!=="number"||!Number.isSafeInteger(n)||n<0)
  throw Object.assign(new Error("Monto inválido"),{statusCode:400});
 return n;
}
async function crearCuenta(usuarioId,data){return Cuenta.create({usuarioId,...data,saldoMinor:safe(data.saldoMinor===undefined?0:data.saldoMinor)})}
async function reconciliarCuenta(usuarioId,{cuentaId,saldoMinor,fecha=new Date(),origenSaldo="USUARIO"}){const saldo=safe(saldoMinor),momento=new Date(fecha);if(Number.isNaN(momento.getTime())||momento>new Date())throw Object.assign(new Error("Fecha de reconciliación inválida"),{statusCode:400});if(!["USUARIO","OPEN_BANKING","PASARELA"].includes(origenSaldo))throw Object.assign(new Error("Origen de reconciliación inválido"),{statusCode:400});const session=await mongoose.startSession();try{let cuenta;await session.withTransaction(async()=>{const transferenciaPosterior=await Outbox.findOne({usuarioId,aggregateType:"TRANSFERENCIA_PROPIA",createdAt:{$gte:momento},$or:[{"payload.origenId":String(cuentaId)},{"payload.destinoId":String(cuentaId)}]}).session(session).lean();if(transferenciaPosterior)throw Object.assign(new Error("La conciliación es anterior a una transferencia de esta cuenta; verifica un saldo posterior"),{statusCode:409});cuenta=await Cuenta.findOneAndUpdate({_id:cuentaId,usuarioId,activa:true,moneda:"COP"},{$set:{saldoMinor:saldo,saldoVerificadoEn:momento,saldoAnclaMinor:saldo,saldoAnclaEn:momento,origenSaldo,requiereReconciliacion:false}},{new:true,session,runValidators:true});if(!cuenta)throw Object.assign(new Error("Cuenta no encontrada"),{statusCode:404});await Outbox.create([{usuarioId,eventId:crypto.randomUUID(),eventName:"SALDO_CUENTA_RECONCILIADO",aggregateType:"CUENTA_FINANCIERA_PERSONAL",aggregateId:cuenta._id,payload:{cuentaId:String(cuenta._id),saldoMinor:saldo,saldoAnclaEn:momento.toISOString(),origenSaldo}}],{session});},{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});return cuenta;}finally{await session.endSession()}}
function exigirSaldoCuentaSeguro(cuenta){
 if(!cuenta||!Number.isSafeInteger(cuenta.saldoMinor)||cuenta.saldoMinor<0)
  throw Object.assign(new Error("Saldo de cuenta inválido o fuera del rango monetario seguro"),{statusCode:409});
 return cuenta.saldoMinor;
}
async function crearPrestamo(usuarioId,data){const principal=safe(data.principalMinor);const session=await mongoose.startSession();let prestamo;try{await session.withTransaction(async()=>{[prestamo]=await Prestamo.create([{usuarioId,...data,tasaConfirmada:Object.prototype.hasOwnProperty.call(data,"tasaMensualPct"),principalMinor:principal,saldoMinor:principal,cuotaMinor:safe(data.cuotaMinor===undefined?0:data.cuotaMinor)}],{session});if(data.cuentaId&&data.direccion==="POR_COBRAR"&&data.origenCuentaPorCobrar!=="PRESTAMO")throw Object.assign(new Error("Una cuenta por cobrar por trabajo u otro concepto no puede registrar salida de efectivo como préstamo"),{statusCode:422});if(data.cuentaId){const delta=data.direccion==="POR_COBRAR"?-principal:principal;const cuenta=await Cuenta.findOneAndUpdate({_id:data.cuentaId,usuarioId,activa:true},{$inc:{saldoMinor:delta}},{new:true,session});if(!cuenta)throw Object.assign(new Error("Saldo insuficiente o cuenta inválida"),{statusCode:409});exigirSaldoCuentaSeguro(cuenta);const tipo=data.direccion==="POR_COBRAR"?"PRESTAMO_OTORGADO":"PRESTAMO_RECIBIDO";const [tx]=await Transaccion.create([{usuarioId,tipo,montoMinor:principal,concepto:data.concepto||"Préstamo",categoria:"Préstamos",contraparte:data.contraparte,cuenta:cuenta.nombre,cuentaId:cuenta._id,medioPago:"TRANSFERENCIA",fecha:data.fechaInicio,origen:"MANUAL"}],{session});await Outbox.create([{usuarioId,eventId:crypto.randomUUID(),eventName:"MOVIMIENTO_PATRIMONIAL",aggregateId:tx._id,payload:{transaccionId:String(tx._id),prestamoId:String(prestamo._id),tipo,montoMinor:principal}}],{session});}},{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});return prestamo;}finally{await session.endSession()}}
async function cobrarCuentaPorCobrar(usuarioId,{prestamoId,montoMinor,cuentaId,externalId}){
 const monto=safe(montoMinor);
 if(typeof externalId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(externalId))throw Object.assign(new Error("Referencia de cobro inválida"),{statusCode:400});
 if(monto===0)throw Object.assign(new Error("El pago debe ser mayor a cero"),{statusCode:400});
 const secret=process.env.PERSONAL_IDEMPOTENCY_SECRET;if(!secret)throw new Error("PERSONAL_IDEMPOTENCY_SECRET requerido");const externalIdHash=crypto.createHmac("sha256",secret).update(String(usuarioId)).update(":").update(String(externalId)).digest("hex");
 const session=await mongoose.startSession();
 try{
  let resultado;
  await session.withTransaction(async()=>{
   const existente=await Transaccion.findOne({usuarioId,externalIdHash,estado:{$ne:"ANULADA"}}).session(session);
   if(existente){if(!["COBRO_PRESTAMO","INGRESO"].includes(existente.tipo)||String(existente.prestamoId)!==String(prestamoId)||existente.montoMinor!==monto||(cuentaId&&String(existente.cuentaId)!==String(cuentaId)))throw Object.assign(new Error("Referencia de pago ya utilizada"),{statusCode:409});resultado={transaccion:existente,duplicado:true};return;}
   const prestamo=await Prestamo.findOneAndUpdate({_id:prestamoId,usuarioId,direccion:"POR_COBRAR",estado:{$in:["ACTIVO","VENCIDO"]},saldoMinor:{$gte:monto}},{$inc:{saldoMinor:-monto}},{new:true,session});
   if(!prestamo)throw Object.assign(new Error("Cuenta por cobrar inexistente o saldo insuficiente"),{statusCode:409});
   if(prestamo.saldoMinor===0){prestamo.estado="PAGADO";await prestamo.save({session});}
   let cuenta=cuentaId?await Cuenta.findOne({_id:cuentaId,usuarioId,activa:true}).session(session):await Cuenta.findOne({usuarioId,nombre:"EFECTIVO",activa:true}).session(session);
   if(!cuenta&&!cuentaId){cuenta=await Cuenta.findOneAndUpdate({usuarioId,nombre:"EFECTIVO"},{$setOnInsert:{usuarioId,nombre:"EFECTIVO",tipo:"EFECTIVO",moneda:"COP",saldoMinor:0,activa:true}},{upsert:true,new:true,session,setDefaultsOnInsert:true});}
   if(!cuenta)throw Object.assign(new Error("Cuenta de destino inválida"),{statusCode:404});
   if(!Number.isSafeInteger(cuenta.saldoMinor+monto))throw Object.assign(new Error("El saldo de destino excede el rango monetario seguro"),{statusCode:422});
   cuenta=await Cuenta.findOneAndUpdate({_id:cuenta._id,usuarioId,activa:true},{$inc:{saldoMinor:monto}},{new:true,session});
   const tipoCobro=prestamo.origenCuentaPorCobrar==="TRABAJO"?"INGRESO":"COBRO_PRESTAMO";
   const [tx]=await Transaccion.create([{usuarioId,prestamoId:prestamo._id,tipo:tipoCobro,montoMinor:monto,concepto:("Cobro: "+prestamo.concepto).slice(0,140),categoria:tipoCobro==="INGRESO"?"Trabajo cobrado":"Cuentas por cobrar",contraparte:prestamo.contraparte,cuenta:cuenta.nombre,cuentaId:cuenta._id,medioPago:cuenta.tipo==="EFECTIVO"?"EFECTIVO":"TRANSFERENCIA",fecha:new Date(),origen:"MANUAL",externalIdHash}],{session});
   await Outbox.create([{usuarioId,eventId:crypto.randomUUID(),eventName:"MOVIMIENTO_PATRIMONIAL",aggregateId:tx._id,payload:{transaccionId:String(tx._id),prestamoId:String(prestamo._id),tipo:tipoCobro,montoMinor:monto}}],{session});
   resultado={prestamo,transaccion:tx,duplicado:false};
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});
  return resultado;
 }catch(error){
  if(error.code===11000||error.hasErrorLabel?.("TransientTransactionError")){
   const existing=await Transaccion.findOne({usuarioId,externalIdHash,estado:{$ne:"ANULADA"}});
   if(existing){if(["COBRO_PRESTAMO","INGRESO"].includes(existing.tipo)&&String(existing.prestamoId)===String(prestamoId)&&existing.montoMinor===monto&&(!cuentaId||String(existing.cuentaId)===String(cuentaId)))return {transaccion:existing,duplicado:true};throw Object.assign(new Error("Referencia de pago ya utilizada"),{statusCode:409});}
  }
  throw error;
 }finally{await session.endSession();}
}
async function pagarCuotaCredito(usuarioId,{prestamoId,cuentaId=null,numeroCuota,montoPagadoRealMinor,externalId,modo="CUENTA"}){
 if(!["CUENTA","HISTORICO"].includes(modo)||modo==="CUENTA"&&!cuentaId||modo==="HISTORICO"&&cuentaId)throw Object.assign(new Error("Modo de pago inválido"),{statusCode:422});
 if(!Number.isSafeInteger(montoPagadoRealMinor)||montoPagadoRealMinor<=0)throw Object.assign(new Error("Importe pagado inválido"),{statusCode:422});
 if(!Number.isInteger(numeroCuota)||numeroCuota<1||numeroCuota>600)throw Object.assign(new Error("Número de cuota inválido"),{statusCode:422});
 if(typeof externalId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(externalId))throw Object.assign(new Error("Referencia inválida"),{statusCode:400});
 const secret=process.env.PERSONAL_IDEMPOTENCY_SECRET;if(!secret)throw Error("PERSONAL_IDEMPOTENCY_SECRET requerido");
 const hash=crypto.createHmac("sha256",secret).update(String(usuarioId)+":"+externalId).digest("hex");
 const session=await mongoose.startSession();let resultado;
 try{
  await session.withTransaction(async()=>{
   const previo=await Transaccion.findOne({usuarioId,externalIdHash:hash}).session(session);
   if(previo){if(previo.tipo!=="PAGO_DEUDA"||String(previo.prestamoId)!==String(prestamoId)||String(previo.cuentaId||"")!==String(cuentaId||"")||previo.impactoCaja===(modo==="HISTORICO")||(previo.montoPagadoRealMinor||previo.montoMinor)!==montoPagadoRealMinor||!previo.descripcion.includes("Cuota "+numeroCuota+" "))throw Object.assign(new Error("Referencia reutilizada"),{statusCode:409});resultado={transaccion:previo,duplicado:true};return;}
   const p=await Prestamo.findOne({_id:prestamoId,usuarioId,direccion:"POR_PAGAR",estado:{$in:["ACTIVO","VENCIDO"]},saldoMinor:{$gt:0},cuotaMinor:{$gt:0},periodicidadConfirmada:true}).session(session);
   if(!p)throw Object.assign(new Error("Crédito sin cuotas confirmadas o ya cancelado"),{statusCode:409});
   if(p.tasaMensualPct>0)throw Object.assign(new Error("Este crédito tiene intereses: antes de registrar una cuota hay que separar capital e intereses para evitar errores contables."),{statusCode:409});
   const pagos=await Transaccion.find({usuarioId,prestamoId:p._id,tipo:"PAGO_DEUDA",estado:"ACTIVA"}).select("descripcion montoMinor").session(session).lean();
   if(pagos.some(x=>x.descripcion.startsWith("Cuota "+numeroCuota+" ")))throw Object.assign(new Error("Esta cuota ya está pagada"),{statusCode:409});
   if(numeroCuota!==pagos.length+1)throw Object.assign(new Error("Debes registrar las cuotas en orden"),{statusCode:409});
   const montoBase=Math.min(p.cuotaMinor,p.saldoMinor);const monto=Math.min(montoBase,montoPagadoRealMinor);
   const cuenta=modo==="CUENTA"?await Cuenta.findOneAndUpdate({_id:cuentaId,usuarioId,activa:true,saldoMinor:{$gte:montoPagadoRealMinor}},{$inc:{saldoMinor:-montoPagadoRealMinor}},{new:true,session}):null;
   if(modo==="CUENTA"&&!cuenta)throw Object.assign(new Error("Cuenta no disponible o fondos insuficientes"),{statusCode:409});
   p.saldoMinor-=monto;if(p.saldoMinor===0){p.estado="PAGADO";p.periodicidadConfirmada=false;}await p.save({session});
   const [tx]=await Transaccion.create([{usuarioId,prestamoId:p._id,cuentaId:cuenta?cuenta._id:null,cuenta:cuenta?cuenta.nombre:"PAGO HISTÓRICO SIN CUENTA",impactoCaja:modo==="CUENTA",tipo:"PAGO_DEUDA",montoMinor:monto,montoPagadoRealMinor,concepto:("Pago cuota "+numeroCuota+" · "+p.concepto).slice(0,140),categoria:"Pago de capital de deuda",descripcion:"Cuota "+numeroCuota+" confirmada"+(modo==="HISTORICO"?" · pendiente de conciliación de origen":""),contraparte:p.contraparte,medioPago:cuenta?(cuenta.tipo==="EFECTIVO"?"EFECTIVO":"TRANSFERENCIA"):"OTRO",fecha:new Date(),origen:"MANUAL",externalIdHash:hash}],{session});
   await Outbox.create([{usuarioId,eventId:crypto.randomUUID(),eventName:"MOVIMIENTO_PATRIMONIAL",aggregateId:tx._id,payload:{transaccionId:String(tx._id),prestamoId:String(p._id),tipo:"PAGO_DEUDA",numeroCuota,montoMinor:monto,montoPagadoRealMinor,impactoCaja:modo==="CUENTA"}}],{session});
   resultado={transaccion:tx,saldoPendienteMinor:p.saldoMinor,duplicado:false};
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});
  return resultado;
 }finally{await session.endSession();}
}
async function deshacerUltimaCuotaCredito(usuarioId,prestamoId){
 const session=await mongoose.startSession();
 try{
  let resultado;
  await session.withTransaction(async()=>{
   const p=await Prestamo.findOne({_id:prestamoId,usuarioId,direccion:"POR_PAGAR",estado:{$in:["ACTIVO","VENCIDO","PAGADO"]}}).session(session);
   if(!p)throw Object.assign(new Error("Deuda no encontrada"),{statusCode:404});
   const pagos=await Transaccion.find({usuarioId,prestamoId:p._id,tipo:"PAGO_DEUDA",estado:"ACTIVA",descripcion:/^Cuota [0-9]+ confirmada/}).sort({fecha:-1,_id:-1}).session(session);
   if(!pagos.length)throw Object.assign(new Error("No hay cuotas registradas que se puedan deshacer"),{statusCode:409});
   const tx=pagos[0],numero=pagos.length;
   if(!tx.descripcion.startsWith("Cuota "+numero+" "))throw Object.assign(new Error("La secuencia de cuotas necesita revisión antes de deshacer"),{statusCode:409});
   if(tx.impactoCaja!==false){
    const cuenta=await Cuenta.findOneAndUpdate({_id:tx.cuentaId,usuarioId,activa:true},{$inc:{saldoMinor:tx.montoPagadoRealMinor||tx.montoMinor}},{new:true,session});
    if(!cuenta||!Number.isSafeInteger(cuenta.saldoMinor))throw Object.assign(new Error("No se pudo restaurar la cuenta de origen"),{statusCode:409});
   }
   if(!Number.isSafeInteger(p.saldoMinor+tx.montoMinor)||p.saldoMinor+tx.montoMinor>p.principalMinor)throw Object.assign(new Error("Reversión excede el valor de la deuda"),{statusCode:409});
   p.saldoMinor+=tx.montoMinor;
   if(p.estado==="PAGADO")p.estado="ACTIVO";
   p.periodicidadConfirmada=true;
   await p.save({session});
   tx.estado="ANULADA";tx.anuladaEn=new Date();tx.motivoAnulacion="CUOTA_MARCADA_PAGADA_POR_ERROR";
   await tx.save({session});
   await Outbox.create([{usuarioId,eventId:crypto.randomUUID(),eventName:"MOVIMIENTO_PATRIMONIAL",aggregateId:tx._id,payload:{accion:"ANULACION_PAGO_DEUDA",prestamoId:String(p._id),transaccionId:String(tx._id),numeroCuota:numero,montoMinor:tx.montoMinor}}],{session});
   resultado={numeroCuota:numero,saldoPendienteMinor:p.saldoMinor,transaccionAnuladaId:String(tx._id)};
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});
  return resultado;
 }finally{await session.endSession();}
}
async function corregirPrestamo(usuarioId,prestamoId,cambios){
 const session=await mongoose.startSession();
 try{
  let resultado;
  await session.withTransaction(async()=>{
   const prestamo=await Prestamo.findOne({_id:prestamoId,usuarioId}).session(session);
   if(!prestamo)throw Object.assign(new Error("Préstamo no encontrado"),{statusCode:404});
   if(prestamo.estado==="CANCELADO")throw Object.assign(new Error("Un préstamo cancelado requiere revisión manual"),{statusCode:409});
   const pagos=await Transaccion.find({usuarioId,prestamoId:prestamo._id,estado:"ACTIVA",tipo:{$in:["COBRO_PRESTAMO","INGRESO","PAGO_DEUDA"]}}).session(session).lean();
   const abonadoRegistrado=pagos.reduce((s,p)=>s+p.montoMinor,0);
   if(!Number.isSafeInteger(abonadoRegistrado))throw Object.assign(new Error("Abonos fuera de rango"),{statusCode:422});
   const principalAnteriorMinor=prestamo.principalMinor;
   const principal=Object.prototype.hasOwnProperty.call(cambios,"principalMinor")?cambios.principalMinor:prestamo.principalMinor;
   if(principal!==prestamo.principalMinor){
    const abonadoInferido=prestamo.principalMinor-prestamo.saldoMinor;
    if(abonadoInferido<0||abonadoRegistrado!==abonadoInferido)throw Object.assign(new Error("No se puede corregir el valor: los abonos históricos no están completamente conciliados"),{statusCode:409});
    if(principal<abonadoRegistrado)throw Object.assign(new Error("El valor corregido no puede ser menor que lo ya pagado"),{statusCode:422});
    prestamo.principalMinor=principal;
    prestamo.saldoMinor=principal-abonadoRegistrado;
    prestamo.estado=prestamo.saldoMinor===0?"PAGADO":(prestamo.fechaVencimiento&&prestamo.fechaVencimiento<new Date()?"VENCIDO":"ACTIVO");
   }
   if(Object.prototype.hasOwnProperty.call(cambios,"origenCuentaPorCobrar")&&cambios.origenCuentaPorCobrar!==prestamo.origenCuentaPorCobrar){
    if(prestamo.direccion!=="POR_COBRAR")throw Object.assign(new Error("Solo se puede cambiar el origen de cuentas por cobrar"),{statusCode:409});
    const origenNuevo=cambios.origenCuentaPorCobrar;
    const pagosAfectados=pagos.filter(x=>["COBRO_PRESTAMO","INGRESO"].includes(x.tipo));
    const totalPagos=pagosAfectados.reduce((n,x)=>n+x.montoMinor,0);
    if(pagosAfectados.length&&totalPagos!==prestamo.principalMinor-prestamo.saldoMinor)throw Object.assign(new Error("Los cobros históricos no concuerdan con el saldo; requiere auditoría antes de reclasificar"),{statusCode:409});
    if(pagosAfectados.length&&origenNuevo==="OTRO")throw Object.assign(new Error("La categoría OTRO requiere revisión individual de cobros anteriores"),{statusCode:409});
    if(pagosAfectados.length){
     if(principal!==principalAnteriorMinor)throw Object.assign(new Error("Corrige primero el valor del préstamo; luego reclasifica los cobros"),{statusCode:409});
     for(const pago of pagosAfectados){
      const tipoNuevo=origenNuevo==="TRABAJO"?"INGRESO":"COBRO_PRESTAMO";
      if(pago.tipo===tipoNuevo)continue;
      await Transaccion.updateOne({_id:pago._id,usuarioId,prestamoId:prestamo._id,estado:"ACTIVA",tipo:pago.tipo},{$set:{tipo:tipoNuevo,categoria:tipoNuevo==="INGRESO"?"Trabajo cobrado":"Cuentas por cobrar"}},{session});
     }
    }
    prestamo.origenCuentaPorCobrar=origenNuevo;
   }
   if(Object.prototype.hasOwnProperty.call(cambios,"periodicidadConfirmada")&&cambios.periodicidadConfirmada===true){
    const frecuencia=cambios.periodicidad||prestamo.periodicidad;
    const monto=cambios.cuotaMinor===undefined?prestamo.cuotaMinor:cambios.cuotaMinor;
    const cuotas=cambios.numeroCuotas===undefined?prestamo.numeroCuotas:cambios.numeroCuotas;
    if(prestamo.direccion!=="POR_PAGAR"||prestamo.saldoMinor<=0||prestamo.estado==="PAGADO")throw Object.assign(new Error("Solo pueden programarse deudas propias pendientes"),{statusCode:422});
    if(!Number.isSafeInteger(monto)||monto<=0||!Number.isInteger(cuotas)||cuotas<1||cuotas>360)throw Object.assign(new Error("Confirma valor, periodicidad y número de cuotas; la fecha no es obligatoria"),{statusCode:422});
   }
   for(const campo of ["contraparte","concepto","cuotaMinor","tasaMensualPct","fechaVencimiento","periodicidad","diaPago","numeroCuotas","periodicidadConfirmada"]){
    if(Object.prototype.hasOwnProperty.call(cambios,campo))prestamo[campo]=cambios[campo];
   }
   await prestamo.save({session});
   await Outbox.create([{usuarioId,eventId:crypto.randomUUID(),eventName:"PRESTAMO_PERSONAL_CORREGIDO",aggregateType:"PRESTAMO_PERSONAL",aggregateId:prestamo._id,payload:{prestamoId:String(prestamo._id),campos:Object.keys(cambios),pagosRegistrados:pagos.length,principalAnteriorMinor,principalNuevoMinor:prestamo.principalMinor,saldoMinor:prestamo.saldoMinor,estado:prestamo.estado}}],{session});
   resultado=prestamo.toObject();
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});
  return resultado;
 }finally{await session.endSession();}
}
async function retirarDeudaVisible(usuarioId,prestamoId){
 const session=await mongoose.startSession();
 try{
  let resultado;
  await session.withTransaction(async()=>{
   const prestamo=await Prestamo.findOne({_id:prestamoId,usuarioId,direccion:"POR_PAGAR"}).session(session);
   if(!prestamo)throw Object.assign(new Error("Deuda no encontrada"),{statusCode:404});
   if(prestamo.estado==="CANCELADO"){resultado={id:String(prestamo._id),yaRetirada:true};return;}
   const movimientos=await Transaccion.countDocuments({usuarioId,prestamoId:prestamo._id,estado:"ACTIVA"}).session(session);
   if(movimientos>0)throw Object.assign(new Error("Esta deuda tiene movimientos vinculados y requiere revisión contable antes de retirarla."),{statusCode:409});
   prestamo.estado="CANCELADO";
   prestamo.periodicidadConfirmada=false;
   await prestamo.save({session});
   await Outbox.create([{usuarioId,eventId:crypto.randomUUID(),eventName:"PRESTAMO_PERSONAL_CORREGIDO",aggregateType:"PRESTAMO_PERSONAL",aggregateId:prestamo._id,payload:{prestamoId:String(prestamo._id),accion:"RETIRAR_DE_VISTA",saldoConservadoMinor:prestamo.saldoMinor}}],{session});
   resultado={id:String(prestamo._id),retirada:true};
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});
  return resultado;
 }finally{await session.endSession();}
}
function normalizarIdCuentaTransferencia(id){
 const valor=String(id??"");
 if(!/^[0-9a-f]{24}$/i.test(valor))
  throw Object.assign(new Error("Identificador de cuenta inválido"),{statusCode:400});
 return valor.toLowerCase();
}
function validarReplayTransferenciaPersonal(evento,{origenId,destinoId,monto}){
 const p=evento?.payload;
 if(evento?.eventName!=="MOVIMIENTO_PATRIMONIAL"||p?.tipo!=="TRANSFERENCIA_PROPIA"||
    p.origenId!==normalizarIdCuentaTransferencia(origenId)||p.destinoId!==normalizarIdCuentaTransferencia(destinoId)||p.montoMinor!==monto)
  throw Object.assign(new Error("Referencia de transferencia reutilizada con datos diferentes"),{statusCode:409});
 return {duplicado:true,origenId:p.origenId,destinoId:p.destinoId,montoMinor:monto,requiereReconciliacion:true};
}
async function transferir(usuarioId,{origenId,destinoId,montoMinor,externalId}){
 const monto=safe(montoMinor);
 if(!monto)throw Object.assign(new Error("Monto debe ser mayor a cero"),{statusCode:400});
 const origenCanonico=normalizarIdCuentaTransferencia(origenId);
 const destinoCanonico=normalizarIdCuentaTransferencia(destinoId);
 if(origenCanonico===destinoCanonico)throw Object.assign(new Error("Las cuentas deben ser diferentes"),{statusCode:400});
 if(typeof externalId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(externalId))
  throw Object.assign(new Error("Referencia de transferencia UUIDv4 requerida"),{statusCode:400});
 const secret=process.env.PERSONAL_IDEMPOTENCY_SECRET;
 if(!secret)throw new Error("PERSONAL_IDEMPOTENCY_SECRET requerido");
 const eventId="fp-transfer-"+crypto.createHmac("sha256",secret).update(String(usuarioId)+":"+externalId.toLowerCase()).digest("hex");
 const existente=await Outbox.findOne({usuarioId,eventId});
 if(existente)return validarReplayTransferenciaPersonal(existente,{origenId,destinoId,monto});
 const session=await mongoose.startSession();
 try{
  return await session.withTransaction(async()=>{
   const previo=await Outbox.findOne({usuarioId,eventId}).session(session);
   if(previo)return validarReplayTransferenciaPersonal(previo,{origenId,destinoId,monto});
   const origen=await Cuenta.findOneAndUpdate({_id:origenId,usuarioId,activa:true,moneda:"COP",saldoMinor:{$gte:monto}},
    {$inc:{saldoMinor:-monto},$set:{requiereReconciliacion:true}},{new:true,session});
   if(!origen)throw Object.assign(new Error("Cuenta origen inválida o saldo insuficiente"),{statusCode:409});
   exigirSaldoCuentaSeguro(origen);
   const destino=await Cuenta.findOneAndUpdate({_id:destinoId,usuarioId,activa:true,moneda:"COP"},
    {$inc:{saldoMinor:monto},$set:{requiereReconciliacion:true}},{new:true,session});
   if(!destino)throw Object.assign(new Error("Cuenta destino inválida"),{statusCode:404});
   exigirSaldoCuentaSeguro(destino);
   await Outbox.create([{usuarioId,eventId,eventName:"MOVIMIENTO_PATRIMONIAL",
    aggregateType:"TRANSFERENCIA_PROPIA",aggregateId:origen._id,
    payload:{tipo:"TRANSFERENCIA_PROPIA",origenId:String(origen._id),destinoId:String(destino._id),
     montoMinor:monto,saldoOrigenPosteriorMinor:origen.saldoMinor,
     saldoDestinoPosteriorMinor:destino.saldoMinor,requiereReconciliacion:true}}],{session});
   return {origen,destino,montoMinor:monto,duplicado:false,requiereReconciliacion:true};
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});
 }catch(error){
  if(error?.code===11000||error?.hasErrorLabel?.("TransientTransactionError")){
   const repetido=await Outbox.findOne({usuarioId,eventId});
   if(repetido)return validarReplayTransferenciaPersonal(repetido,{origenId,destinoId,monto});
  }
  throw error;
 }finally{await session.endSession();}
}
function sumaPatrimonialSegura(valores){
 if(!Array.isArray(valores))throw new TypeError("Valores patrimoniales inválidos");
 let total=0n;
 for(const valor of valores){
  if(!Number.isSafeInteger(valor))
   throw Object.assign(new Error("Monto patrimonial inválido; requiere conciliación"),{statusCode:409});
  total+=BigInt(valor);
  if(total>BigInt(Number.MAX_SAFE_INTEGER)||total<BigInt(Number.MIN_SAFE_INTEGER))
   throw Object.assign(new Error("Suma patrimonial fuera de rango"),{statusCode:409});
 }
 return Number(total);
}
async function snapshot(usuarioId){const [cuentas,activos,prestamos]=await Promise.all([Cuenta.find({usuarioId,activa:true}).lean(),Activo.find({usuarioId}).lean(),Prestamo.find({usuarioId,estado:{$in:["ACTIVO","VENCIDO"]}}).lean()]);exigirCuentasCopPatrimonio(cuentas);const rows=await Transaccion.find({usuarioId,estado:{$ne:"ANULADA"},tipo:{$in:["INGRESO","GASTO","PAGO_DEUDA","PRESTAMO_RECIBIDO","PRESTAMO_OTORGADO","COBRO_PRESTAMO"]}}).select("estado moneda tipo montoMinor montoPagadoRealMinor impactoCaja medioPago fecha cuenta cuentaId").lean();exigirMovimientosActivosCopPatrimonio(rows);exigirMovimientosUnicosPatrimonio(rows,{exigirId:true});const movimientosCaja=rows.filter(x=>deltaCaja(x)!==0);exigirFechasCajaNoFuturasPatrimonio(movimientosCaja);const hayMovimientosLedger=movimientosCaja.length>0;const saldoDerivadoLedgerMinor=hayMovimientosLedger?saldoDesdeAncla(0,movimientosCaja):null;const {cuentasVerificadas,cuentasAncladas,anclaCompleta,saldoVerificado}=evaluarIntegridadAnclasPersonales(cuentas);let liquidez;if(anclaCompleta){liquidez=saldoCuentasDesdeAnclas(cuentasAncladas,movimientosCaja);}else if(cuentasVerificadas.length===0)liquidez=saldoDerivadoLedgerMinor??0;else liquidez=sumaPatrimonialSegura(cuentas.map(x=>x.saldoMinor));const activosNoLiquidos=sumaPatrimonialSegura(activos.filter(x=>!x.liquido).map(x=>x.valorMinor));const porCobrar=sumaPatrimonialSegura(prestamos.filter(x=>x.direccion==="POR_COBRAR").map(x=>x.saldoMinor));const porPagar=sumaPatrimonialSegura(prestamos.filter(x=>x.direccion==="POR_PAGAR").map(x=>x.saldoMinor));const activosTotales=sumaPatrimonialSegura([liquidez,activosNoLiquidos]);const patrimonioNeto=sumaPatrimonialSegura([activosTotales,porCobrar,-porPagar]);return{liquidezMinor:liquidez,activosNoLiquidosMinor:activosNoLiquidos,activosTotalesMinor:activosTotales,cuentasPorCobrarMinor:porCobrar,pasivosMinor:porPagar,patrimonioFinancieroNetoMinor:patrimonioNeto,cuentas,activos,prestamos,saldoDerivadoLedgerMinor,hayMovimientosLedger,saldoVerificado,cuentasVerificadas:cuentasVerificadas.map(x=>String(x._id)),fuenteLiquidez:anclaCompleta?"ANCLA_RECONCILIADA":(cuentasVerificadas.length===0?"LEDGER_DERIVADO":"CUENTAS_PARCIALMENTE_VERIFICADAS"),anclaCompleta}}
module.exports={normalizarIdCuentaTransferencia,validarReplayTransferenciaPersonal,exigirSaldoCuentaSeguro,safeMontoPatrimonial:safe,exigirCuentasCopPatrimonio,exigirFechasCajaNoFuturasPatrimonio,sumaPatrimonialSegura,exigirMovimientosActivosCopPatrimonio,exigirMovimientosUnicosPatrimonio,evaluarIntegridadAnclasPersonales,deltaCaja,saldoDesdeAncla,saldoCuentasDesdeAnclas,crearCuenta,reconciliarCuenta,crearPrestamo,cobrarCuentaPorCobrar,pagarCuotaCredito,deshacerUltimaCuotaCredito,corregirPrestamo,retirarDeudaVisible,transferir,snapshot};