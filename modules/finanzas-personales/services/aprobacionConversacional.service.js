"use strict";
const mongoose=require("mongoose");const crypto=require("crypto");const Borrador=require("../models/borradorFinanciero.model");const Tx=require("../models/TransaccionPersonal");const Prestamo=require("../models/prestamoPersonal.model");const Outbox=require("../models/outboxPersonal.model");const Cuenta=require("../models/cuentaFinanciera.model");
const {reconciliarCuenta}=require("./patrimonioPersonal.service");
const {filtroSaldoSeguro}=require("./limitesSaldoPersonal.service");
const {validarDeudaConversacional,calendarioDeudaConversacional}=require("./deudaConversacionalPersonal.service");
const event=t=>t==="INGRESO"?"INGRESO_DETECTADO":t==="PAGO_DEUDA"?"PAGO_DEUDA":["PRESTAMO_OTORGADO","PRESTAMO_RECIBIDO","COBRO_PRESTAMO"].includes(t)?"MOVIMIENTO_PATRIMONIAL":"GASTO_REGISTRADO";
async function aprobarSaldo(usuarioId,x,session){
 const ahorro=x.tipo==="AJUSTE_SALDO_AHORRO",nombre=ahorro?"AHORRO":"EFECTIVO";
 let cuenta=await Cuenta.findOne({usuarioId,nombre,activa:true}).session(session);
 if(!cuenta)[cuenta]=await Cuenta.create([{usuarioId,nombre,tipo:ahorro?"AHORROS":"EFECTIVO",moneda:"COP",saldoMinor:0,activa:true}],{session});
 cuenta=await reconciliarCuenta(usuarioId,{cuentaId:String(cuenta._id),saldoMinor:x.montoMinor,
  fecha:x.fecha,origenSaldo:"USUARIO"},{session});
 if(ahorro)return {tipo:x.tipo,id:cuenta._id};
 const [tx]=await Tx.create([{usuarioId,cuentaId:cuenta._id,cuenta:nombre,impactoCaja:false,
  tipo:"AJUSTE_SALDO",montoMinor:x.montoMinor,moneda:"COP",concepto:x.concepto,categoria:x.categoria,
  fecha:x.fecha,origen:"MANUAL"}],{session});
 return {tipo:x.tipo,id:tx._id};
}
async function aprobarTransferencia(usuarioId,x,session){
 const origen=String(x.cuentaOrigen||"EFECTIVO").trim()||"EFECTIVO";
 const destino=String(x.cuentaDestino||(x.tipo==="AHORRO_ACTIVO"?"AHORRO":"")).trim();
 if(!destino||origen.toLowerCase()===destino.toLowerCase())
  throw Object.assign(new Error("Transferencia requiere cuentas origen y destino distintas."),{statusCode:409});
 const cuentaOrigen=await Cuenta.findOne({usuarioId,nombre:origen,activa:true}).session(session);
 if(!cuentaOrigen||cuentaOrigen.moneda!=="COP"||!Number.isSafeInteger(cuentaOrigen.saldoMinor)||cuentaOrigen.saldoMinor<x.montoMinor)
  throw Object.assign(new Error("Saldo insuficiente o cuenta origen no conciliable."),{statusCode:409});
 let cuentaDestino=await Cuenta.findOne({usuarioId,nombre:destino,activa:true}).session(session);
 if(!cuentaDestino)[cuentaDestino]=await Cuenta.create([{usuarioId,nombre:destino,
  tipo:x.tipo==="AHORRO_ACTIVO"?"AHORROS":"OTRA",moneda:"COP",saldoMinor:0,activa:true}],{session});
 if(cuentaDestino.moneda!=="COP"||!Number.isSafeInteger(cuentaDestino.saldoMinor)||cuentaDestino.saldoMinor<0||String(cuentaOrigen._id)===String(cuentaDestino._id))
  throw Object.assign(new Error("Cuenta destino no conciliable."),{statusCode:409});
 const salida=await Cuenta.findOneAndUpdate({_id:cuentaOrigen._id,usuarioId,activa:true,moneda:"COP",
  ...filtroSaldoSeguro(-x.montoMinor)},{$inc:{saldoMinor:-x.montoMinor},$set:{requiereReconciliacion:true}},{new:true,session});
 if(!salida)throw Object.assign(new Error("Saldo de origen insuficiente o fuera de rango."),{statusCode:409});
 const entrada=await Cuenta.findOneAndUpdate({_id:cuentaDestino._id,usuarioId,activa:true,moneda:"COP",
  ...filtroSaldoSeguro(x.montoMinor)},{$inc:{saldoMinor:x.montoMinor},$set:{requiereReconciliacion:true}},{new:true,session});
 if(!entrada)throw Object.assign(new Error("Saldo de destino fuera de rango."),{statusCode:409});
 await Outbox.create([{usuarioId,eventId:crypto.randomUUID(),eventName:"MOVIMIENTO_PATRIMONIAL",
  aggregateType:"TRANSFERENCIA_PROPIA",aggregateId:cuentaOrigen._id,
  payload:{tipo:"TRANSFERENCIA_PROPIA",tipoSolicitud:x.tipo,origenId:String(cuentaOrigen._id),destinoId:String(cuentaDestino._id),
   cuentaOrigen:origen,cuentaDestino:destino,montoMinor:x.montoMinor,saldoOrigenPosteriorMinor:salida.saldoMinor,
   saldoDestinoPosteriorMinor:entrada.saldoMinor,requiereReconciliacion:true,origen:"CONVERSACIONAL"}}],{session});
 return {tipo:x.tipo,id:cuentaDestino._id};
}
async function aprobarCobro(usuarioId,x,session){
 const fecha=new Date(x.fecha);
 if(!Number.isFinite(+fecha)||+fecha>Date.now())throw Object.assign(new Error("El cobro requiere una fecha válida no futura."),{statusCode:422});
 const candidatos=await Prestamo.find({usuarioId,direccion:"POR_COBRAR",estado:{$in:["ACTIVO","VENCIDO"]},
  saldoMinor:{$gt:0},contraparte:x.contraparte}).limit(2).maxTimeMS(5000).session(session);
 if(candidatos.length!==1)throw Object.assign(new Error(candidatos.length?
  "Hay varias cuentas por cobrar de esa persona. Necesito identificar cuál estás cobrando.":
  "No encontré una cuenta por cobrar activa de "+x.contraparte+"."),{statusCode:409});
 const p=candidatos[0];
 if(!Number.isSafeInteger(p.principalMinor)||p.principalMinor<1||!Number.isSafeInteger(p.saldoMinor)||
  p.saldoMinor<1||p.saldoMinor>p.principalMinor||x.montoMinor>p.saldoMinor)
  throw Object.assign(new Error("El cobro no es conciliable con el saldo pendiente registrado."),{statusCode:409});
 let cuenta=await Cuenta.findOne({usuarioId,nombre:"EFECTIVO",activa:true}).session(session);
 if(!cuenta)[cuenta]=await Cuenta.create([{usuarioId,nombre:"EFECTIVO",tipo:"EFECTIVO",moneda:"COP",saldoMinor:0,activa:true}],{session});
 if(cuenta.moneda!=="COP"||!Number.isSafeInteger(cuenta.saldoMinor)||cuenta.saldoMinor<0)
  throw Object.assign(new Error("La cuenta de destino requiere conciliación."),{statusCode:409});
 const actualizada=await Cuenta.findOneAndUpdate({_id:cuenta._id,usuarioId,activa:true,moneda:"COP",
  ...filtroSaldoSeguro(x.montoMinor)},{$inc:{saldoMinor:x.montoMinor}},{new:true,session});
 if(!actualizada)throw Object.assign(new Error("El saldo de destino excede el rango monetario seguro."),{statusCode:409});
 p.saldoMinor-=x.montoMinor;if(p.saldoMinor===0)p.estado="PAGADO";await p.save({session});
 const tipo=p.origenCuentaPorCobrar==="TRABAJO"?"INGRESO":"COBRO_PRESTAMO";
 const [tx]=await Tx.create([{usuarioId,prestamoId:p._id,cuentaId:cuenta._id,cuenta:cuenta.nombre,
  impactoCaja:true,medioPago:"EFECTIVO",tipo,montoMinor:x.montoMinor,moneda:"COP",
  concepto:("Cobro: "+p.concepto).slice(0,140),categoria:tipo==="INGRESO"?"Trabajo cobrado":"Cuentas por cobrar",
  contraparte:p.contraparte,fecha,origen:"MANUAL"}],{session});
 await Outbox.create([{usuarioId,eventId:crypto.randomUUID(),eventName:"CUENTA_POR_COBRAR_COBRADA",
  aggregateId:p._id,payload:{prestamoId:String(p._id),cuentaId:String(cuenta._id),transaccionId:String(tx._id),
   tipo,montoMinor:x.montoMinor,saldoMinor:p.saldoMinor,contraparte:p.contraparte,origen:"CONVERSACIONAL"}}],{session});
 return {tipo:x.tipo,id:tx._id,prestamoId:p._id};
}
async function aprobar(usuarioId,borradorId,itemId=null){const session=await mongoose.startSession();try{let resultado;await session.withTransaction(async()=>{const b=await Borrador.findOne({_id:borradorId,usuarioId,estado:{$in:["PENDIENTE","PARCIAL"]}}).session(session);if(!b)throw Object.assign(new Error("Borrador no disponible"),{statusCode:404});const candidatos=b.items.filter(x=>x.estado==="LISTO"&&x.estadoAprobacion!=="APROBADO"&&(!itemId||String(x._id)===String(itemId)));
if(itemId&&!candidatos.length)throw Object.assign(new Error("Movimiento no disponible para aprobación"),{statusCode:404});
if(!candidatos.length)throw Object.assign(new Error("No hay movimientos listos para aprobar"),{statusCode:409});
const creadas=[];for(const x of candidatos){if(!Number.isSafeInteger(x.montoMinor)||x.montoMinor<=0)throw Object.assign(new Error("El importe debe ser un entero positivo exacto."),{statusCode:422});if(x.tipo==="POR_CLASIFICAR"||x.estado!=="LISTO")throw Object.assign(new Error("Un hecho no clasificado o en revisión no puede contabilizarse."),{statusCode:409});if(x.tipo==="TRANSFERENCIA_PROPIA"||x.tipo==="AHORRO_ACTIVO"){
 creadas.push(await aprobarTransferencia(usuarioId,x,session));continue;
}if(["AJUSTE_SALDO","AJUSTE_SALDO_AHORRO"].includes(x.tipo)){
 creadas.push(await aprobarSaldo(usuarioId,x,session));continue;
}if(x.tipo==="DEUDA_POR_PAGAR"){const deuda=validarDeudaConversacional(x);const calendario=calendarioDeudaConversacional(x);const [p]=await Prestamo.create([{usuarioId,direccion:"POR_PAGAR",contraparte:x.contraparte||"Por identificar",concepto:x.concepto,...deuda,...calendario,fechaInicio:x.fecha}],{session});await Outbox.create([{usuarioId,eventId:crypto.randomUUID(),eventName:"MOVIMIENTO_PATRIMONIAL",aggregateId:p._id,payload:{prestamoId:String(p._id),tipo:x.tipo,principalMinor:deuda.principalMinor,saldoMinor:deuda.saldoMinor,cuotaMinor:deuda.cuotaMinor,diaPago:calendario.diaPago,frecuencia:calendario.periodicidad,periodicidadConfirmada:calendario.periodicidadConfirmada,fechaVencimiento:calendario.fechaVencimiento,origen:"CONVERSACIONAL"}}],{session});creadas.push({tipo:x.tipo,id:p._id});continue}if(x.tipo==="CUENTA_POR_COBRAR"){const [p]=await Prestamo.create([{usuarioId,direccion:"POR_COBRAR",contraparte:x.contraparte||"Por identificar",concepto:x.concepto,principalMinor:x.montoMinor,saldoMinor:x.montoMinor,fechaInicio:x.fecha,fechaVencimiento:x.fechaVencimiento||null}],{session});await Outbox.create([{usuarioId,eventId:crypto.randomUUID(),eventName:"CUENTA_POR_COBRAR_REGISTRADA",aggregateId:p._id,payload:{prestamoId:String(p._id),montoMinor:x.montoMinor,contraparte:p.contraparte,fechaEsperada:x.fechaVencimiento||null,origen:"CONVERSACIONAL"}}],{session});creadas.push({tipo:x.tipo,id:p._id});continue}if(x.tipo==="COBRO_CUENTA_POR_COBRAR"){
 creadas.push(await aprobarCobro(usuarioId,x,session));continue;
}// Los movimientos patrimoniales requieren un préstamo identificado y su flujo específico.
if(!["INGRESO","GASTO"].includes(x.tipo))throw Object.assign(new Error("Este movimiento requiere el flujo de préstamos o de pago de deuda para conservar caja y patrimonio sincronizados."),{statusCode:409});
const nombreCuenta="EFECTIVO";
let cuenta=await Cuenta.findOne({usuarioId,nombre:nombreCuenta,activa:true}).session(session);
if(!cuenta)[cuenta]=await Cuenta.create([{usuarioId,nombre:nombreCuenta,tipo:"EFECTIVO",institucion:"",moneda:"COP",saldoMinor:0,activa:true}],{session});
if(cuenta.moneda!=="COP")throw Object.assign(new Error("La cuenta de efectivo no está disponible en COP."),{statusCode:409});
const [tx]=await Tx.create([{usuarioId,cuentaId:cuenta._id,cuenta:nombreCuenta,impactoCaja:true,
 tipo:x.tipo,montoMinor:x.montoMinor,moneda:"COP",concepto:x.concepto,categoria:x.categoria,
 contraparte:x.contraparte,fecha:x.fecha,origen:"MANUAL"}],{session});
await Outbox.create([{usuarioId,eventId:crypto.randomUUID(),eventName:event(x.tipo),aggregateId:tx._id,
 payload:{transaccionId:String(tx._id),cuentaId:String(cuenta._id),tipo:x.tipo,montoMinor:x.montoMinor,origen:"CONVERSACIONAL"}}],{session});
const delta=x.tipo==="INGRESO"?x.montoMinor:-x.montoMinor;
const actualizada=await Cuenta.findOneAndUpdate({_id:cuenta._id,usuarioId,activa:true,moneda:"COP",
 ...filtroSaldoSeguro(delta)},{$inc:{saldoMinor:delta}},{new:true,session});
if(!actualizada)throw Object.assign(new Error("Saldo insuficiente o fuera de rango para aprobar este movimiento"),{statusCode:409});

creadas.push({tipo:x.tipo,id:tx._id})}
const aprobados=new Set(candidatos.map(x=>String(x._id)));
for(const x of b.items){if(aprobados.has(String(x._id))){x.estadoAprobacion="APROBADO";x.aprobadoEn=new Date();}}
const pendientes=b.items.filter(x=>x.estadoAprobacion!=="APROBADO"&&x.estadoAprobacion!=="DESCARTADO");
b.estado=pendientes.length?"PARCIAL":"APROBADO";if(!pendientes.length)b.aprobadoEn=new Date();await b.save({session});resultado={borradorId:b._id,estado:b.estado,operaciones:creadas,pendientes:pendientes.map(x=>({itemId:x._id,estado:x.estado,razonRevision:x.razonRevision||""}))};},{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});return resultado;}finally{await session.endSession()}}
module.exports={aprobar};