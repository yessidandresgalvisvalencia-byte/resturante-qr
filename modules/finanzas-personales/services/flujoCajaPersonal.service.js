"use strict";
const crypto=require("crypto");
const {consultarPeriodo}=require("./consultaCompensadaPersonal.service");
const {calcularFlujo}=require("./totalesFlujoCompensadoPersonal.service");
const mongoose=require("mongoose");
const Transaccion=require("../models/TransaccionPersonal");
const Outbox=require("../models/outboxPersonal.model");
const Cuenta=require("../models/cuentaFinanciera.model");
const Prestamo=require("../models/prestamoPersonal.model");
const ReservaCuota=require("../models/reservaCuotaRecurrente.model");
const {exigirIndiceIdempotencia}=require("./indiceIdempotenciaPersonal.service");
const {indiceExacto}=require("../security/auditoriaIndicesMongoV81.service");
const {confirmarIntento}=require("./confirmacionIntentoPersonal.service");
const {filtroSaldoSeguro}=require("./limitesSaldoPersonal.service");
const {validarFechaPagoVinculado,validarNoDuplicarOrigenHoy,periodoRecurrenteColombia,validarTotalPeriodoRecurrente}=require("./vinculoRecurrenteV81.service");
const {personalEventBus,PERSONAL_EVENTS}=require("../events/eventBusPersonal");
const {encryptObject}=require("../security/fieldEncryption.service");

function eventFor(tipo){if(tipo==="GASTO")return PERSONAL_EVENTS.GASTO_REGISTRADO;if(tipo==="INGRESO")return PERSONAL_EVENTS.INGRESO_DETECTADO;if(tipo==="PAGO_DEUDA")return PERSONAL_EVENTS.PAGO_DEUDA;if(tipo==="MOVIMIENTO_CORREGIDO")return PERSONAL_EVENTS.MOVIMIENTO_CORREGIDO;if(tipo==="MOVIMIENTO_ANULADO")return PERSONAL_EVENTS.MOVIMIENTO_ANULADO;if(tipo==="ACCION_PROGRESO_ACTUALIZADA")return PERSONAL_EVENTS.ACCION_PROGRESO_ACTUALIZADA;if(["PRESTAMO_OTORGADO","PRESTAMO_RECIBIDO","COBRO_PRESTAMO"].includes(tipo))return PERSONAL_EVENTS.MOVIMIENTO_PATRIMONIAL;throw new TypeError("Tipo de transacción no soportado");}
function hashExternalId(usuarioId,externalId){if(!externalId)return null;const secret=process.env.PERSONAL_IDEMPOTENCY_SECRET;if(!secret)throw new Error("PERSONAL_IDEMPOTENCY_SECRET requerido");return crypto.createHmac("sha256",secret).update(String(usuarioId)).update(":").update(String(externalId)).digest("hex");}
async function exigirIndiceUnicoReservaRecurrente(){
 let indices;
 try{indices=await ReservaCuota.collection.indexes();}
 catch(_){throw Object.assign(new Error("Índice único de cuotas recurrentes no disponible"),{statusCode:503});}
 const unico=indiceExacto(indices,["usuarioId","origenId","periodoInicio"]);
 if(!unico)throw Object.assign(new Error("Índice único de cuotas recurrentes no configurado"),{statusCode:503});
}
async function confirmarRegistroIntento(usuarioId,input){
 if(typeof input.externalId!=="string"||!input.externalId.trim())
  throw Object.assign(new Error("externalId obligatorio para confirmar"),{statusCode:400});
 const session=await mongoose.startSession();
 try{
  let resultado;
  await session.withTransaction(async()=>{
   resultado=await confirmarIntento({
    Transaccion,usuarioId,externalIdHash:hashExternalId(usuarioId,input.externalId),esperado:input,session,
    resolverEstado:async fuente=>{
     const fecha=new Date(fuente.fecha);
     const rows=await consultarPeriodo({usuarioId,desde:fecha.toISOString(),
      hasta:new Date(+fecha+1).toISOString(),incluirAnuladas:true},{session});
     return rows.find(row=>String(row._id)===String(fuente._id));
    }
   });
  },{readConcern:{level:"snapshot"},readPreference:"primary"});
  return resultado;
 }finally{await session.endSession();}
}
async function registrarTransaccion(usuarioId,input){
 if(input.tipo==="GASTO"&&String(input.cuenta||"EFECTIVO").trim().toUpperCase()==="EFECTIVO"&&input.medioPago==="TRANSFERENCIA")input={...input,medioPago:"EFECTIVO"};
 if(!Number.isSafeInteger(input.montoMinor)||input.montoMinor<=0)throw Object.assign(new Error("montoMinor debe ser un entero positivo exacto"),{statusCode:400});if(input.externalId!==undefined&&input.externalId!==null&&!String(input.externalId).trim())throw Object.assign(new Error("externalId vacío no es válido"),{statusCode:400});
 if(input.externalId!==undefined&&input.externalId!==null)
  await exigirIndiceIdempotencia(Transaccion);
 if(input.recurrenteOrigenId!==undefined&&input.recurrenteOrigenId!==null)
  await exigirIndiceUnicoReservaRecurrente();
 if(input.tipo==="GASTO"&&input.medioPago==="CREDITO")throw Object.assign(new Error("Un gasto con tarjeta de crédito debe registrar también la obligación de la tarjeta; GRUK no lo descontará de caja como si fuera débito."),{statusCode:422});const session=await mongoose.startSession();let tx,outbox;
 try{
  await session.withTransaction(async()=>{
   const externalIdHash=hashExternalId(usuarioId,input.externalId);
   let recurrenteOrigenId=null;
   if(input.recurrenteOrigenId!==undefined&&input.recurrenteOrigenId!==null){
    if(typeof input.externalId!=="string"||!input.externalId.trim()||input.externalId.length>160)
     throw Object.assign(new Error("Los pagos recurrentes vinculados requieren externalId estable para evitar cobros duplicados"),{statusCode:400});
    if(input.tipo!=="GASTO"||input.recurrente===true||!mongoose.isValidObjectId(input.recurrenteOrigenId))
     throw Object.assign(new Error("El vínculo recurrente requiere un gasto no recurrente e ID válido"),{statusCode:400});
    const origen=await Transaccion.findOne({_id:input.recurrenteOrigenId,usuarioId,tipo:"GASTO",
     recurrente:true,estado:{$ne:"ANULADA"}}).select("_id fecha impactoCaja montoMinor frecuencia").session(session);
    if(!origen)throw Object.assign(new Error("Obligación recurrente no encontrada para esta cuenta"),{statusCode:404});
    validarFechaPagoVinculado({fechaPago:input.fecha,fechaOrigen:origen.fecha});
    validarNoDuplicarOrigenHoy({fechaPago:input.fecha,fechaOrigen:origen.fecha,origenImpactoCaja:origen.impactoCaja});
    // Todos los abonos de la MISMA cuota periódica comparten cupo,
    // incluso cuando ocurren en fechas civiles diferentes.
    const {inicio,fin}=periodoRecurrenteColombia({
     fechaOrigen:origen.fecha,fechaPago:input.fecha,frecuencia:origen.frecuencia
    });
    // El asiento inicial ya fue debitado. No aceptar pagos adicionales en
    // ese mismo ciclo aunque estén registrados otro día.
    if(origen.impactoCaja!==false&&new Date(origen.fecha)>=inicio&&new Date(origen.fecha)<fin)
     throw Object.assign(new Error("El primer período recurrente ya está asentado en caja"),{statusCode:409});
    const abonosPrevios=(await consultarPeriodo({usuarioId,desde:inicio.toISOString(),hasta:fin.toISOString(),tipo:"GASTO"},{session}))
     .filter(x=>String(x.recurrenteOrigenId)===String(origen._id));
    const pagado=abonosPrevios.reduce((total,x)=>{
     const siguiente=total+x.montoMinor;
     if(!Number.isSafeInteger(siguiente))throw new RangeError("Abonos recurrentes exceden rango seguro");
     return siguiente;
    },0);
    validarTotalPeriodoRecurrente({
     importeObligacionMinor:origen.montoMinor,
     yaPagadoMinor:pagado,nuevoPagoMinor:input.montoMinor
    });
    // Las lecturas previas no impiden write skew bajo concurrencia. Crear
    // un único cerrojo por usuario+obligación+período, inicializado con los
    // pagos previos, y reservar dentro de ESTA transacción.
    const filtroReserva={usuarioId,origenId:origen._id,periodoInicio:inicio};
    await ReservaCuota.updateOne(filtroReserva,{
     $setOnInsert:{...filtroReserva,periodoFin:fin,
      importeCuotaMinor:origen.montoMinor,reservadoMinor:pagado}
    },{upsert:true,session});
    const reserva=await ReservaCuota.findOneAndUpdate({
     ...filtroReserva,importeCuotaMinor:origen.montoMinor,
     reservadoMinor:{$lte:origen.montoMinor-input.montoMinor}
    },{$inc:{reservadoMinor:input.montoMinor}},{returnDocument:"after",session});
    if(!reserva)throw Object.assign(new Error("Cuota recurrente sin saldo disponible o reserva concurrente"),{statusCode:409});
    if(!(reserva.periodoFin instanceof Date)||reserva.periodoFin.getTime()!==fin.getTime())
     throw Object.assign(new Error("Reserva recurrente con fin de período inconsistente"),{statusCode:409});
    // Detectar desfases por anulaciones históricas, errores de mantenimiento o
    // escrituras ajenas: el control atómico debe reflejar EXACTAMENTE el ledger.
    if(!Number.isSafeInteger(reserva.reservadoMinor)||
       BigInt(reserva.reservadoMinor)!==BigInt(pagado)+BigInt(input.montoMinor))
     throw Object.assign(new Error("Reserva recurrente desincronizada con los abonos activos; requiere conciliación"),{statusCode:409});
    recurrenteOrigenId=origen._id;
   }
   let prestamoId=input.prestamoId||null;if(["PRESTAMO_RECIBIDO","PRESTAMO_OTORGADO","COBRO_PRESTAMO"].includes(input.tipo)&&!prestamoId)throw Object.assign(new Error("Este movimiento patrimonial requiere una obligación exacta; usa el flujo de préstamo/cobro para mantener caja y patrimonio sincronizados."),{statusCode:409});if(input.tipo==="PAGO_DEUDA"&&!prestamoId){const candidatas=await Prestamo.find({usuarioId,direccion:"POR_PAGAR",estado:{$in:["ACTIVO","VENCIDO"]},saldoMinor:{$gt:0}}).select("_id").session(session);if(candidatas.length!==1)throw Object.assign(new Error(candidatas.length?"Indica exactamente qué deuda estás pagando.":"No hay una deuda activa para aplicar este pago."),{statusCode:409});prestamoId=candidatas[0]._id;}const envelope=input.metadatosSensibles?encryptObject(input.metadatosSensibles,{aad:String(usuarioId)}):null;
   const nombreCuenta=String(input.cuenta||"EFECTIVO").trim()||"EFECTIVO";
   let cuenta=await Cuenta.findOne({usuarioId,nombre:nombreCuenta,activa:true}).session(session);
   if(!cuenta){
    [cuenta]=await Cuenta.create([{usuarioId,nombre:nombreCuenta,tipo:nombreCuenta.toUpperCase()==="EFECTIVO"?"EFECTIVO":"OTRA",institucion:"",moneda:"COP",saldoMinor:0,activa:true}],{session});
   }
   [tx]=await Transaccion.create([{usuarioId,prestamoId,recurrenteOrigenId,cuentaId:cuenta._id,tipo:input.tipo,montoMinor:input.montoMinor,moneda:input.moneda||"COP",concepto:input.concepto,categoria:input.categoria,subcategoria:input.subcategoria||"",cuenta:input.cuenta||"EFECTIVO",medioPago:input.medioPago||"EFECTIVO",contraparte:input.contraparte||"",descripcion:input.descripcion||"",recurrente:Boolean(input.recurrente),frecuencia:input.frecuencia||"NINGUNA",fecha:input.fecha,origen:input.origen||"MANUAL",externalIdHash,metadatosCifrados:envelope?{ciphertext:envelope.ciphertext,iv:envelope.iv,tag:envelope.tag}:undefined,keyVersion:envelope?.keyVersion||null}],{session});
   if(input.tipo==="PAGO_DEUDA"){const p=await Prestamo.findOne({_id:prestamoId,usuarioId,direccion:"POR_PAGAR",estado:{$in:["ACTIVO","VENCIDO"]}}).session(session);if(!p)throw Object.assign(new Error("Deuda no encontrada"),{statusCode:404});if(input.montoMinor>p.saldoMinor)throw Object.assign(new Error("El pago supera el saldo pendiente"),{statusCode:409});p.saldoMinor-=input.montoMinor;if(p.saldoMinor===0)p.estado="PAGADO";await p.save({session});}if(input.tipo==="COBRO_PRESTAMO"){const p=await Prestamo.findOne({_id:prestamoId,usuarioId,direccion:"POR_COBRAR",estado:{$in:["ACTIVO","VENCIDO"]}}).session(session);if(!p)throw Object.assign(new Error("Cuenta por cobrar no encontrada"),{statusCode:404});if(input.montoMinor>p.saldoMinor)throw Object.assign(new Error("El cobro supera el saldo pendiente"),{statusCode:409});p.saldoMinor-=input.montoMinor;if(p.saldoMinor===0)p.estado="PAGADO";await p.save({session});}
   const eventId=crypto.randomUUID(),eventName=eventFor(input.tipo);
   [outbox]=await Outbox.create([{usuarioId,eventId,eventName,aggregateId:tx._id,payload:{transaccionId:tx._id.toString(),prestamoId:prestamoId?String(prestamoId):null,tipo:tx.tipo,montoMinor:tx.montoMinor,moneda:tx.moneda,categoria:tx.categoria,fecha:tx.fecha}}],{session});
   // El ledger y la liquidez deben cambiar en la misma transacción ACID.
   // Si el usuario aún no tiene la cuenta indicada, se crea con saldo cero y luego se aplica el movimiento.
   const delta=input.tipo==="INGRESO"||input.tipo==="PRESTAMO_RECIBIDO"||input.tipo==="COBRO_PRESTAMO"?input.montoMinor:input.tipo==="GASTO"||input.tipo==="PAGO_DEUDA"||input.tipo==="PRESTAMO_OTORGADO"?-input.montoMinor:0;
   if(delta){
    const actualizada=await Cuenta.findOneAndUpdate({_id:cuenta._id,usuarioId,activa:true,...filtroSaldoSeguro(delta)},{$inc:{saldoMinor:delta}},{returnDocument:"after",session});
    if(!actualizada){
     const esEfectivoHistorico=input.tipo==="GASTO"&&nombreCuenta.toUpperCase()==="EFECTIVO"&&input.medioPago==="EFECTIVO"&&input.fecha&&new Date(input.fecha).getTime()<=Date.now();
     if(!esEfectivoHistorico)throw Object.assign(new Error("Saldo insuficiente en "+nombreCuenta),{statusCode:409});
     const pendiente=await Cuenta.findOneAndUpdate({_id:cuenta._id,usuarioId,activa:true,...filtroSaldoSeguro(delta,{permitirNegativo:true})},{$inc:{saldoMinor:delta},$set:{requiereReconciliacion:true,origenSaldo:"NO_VERIFICADO",saldoVerificadoEn:null,saldoAnclaMinor:null,saldoAnclaEn:null}},{returnDocument:"after",session});
     if(!pendiente)throw Object.assign(new Error("No se pudo reconciliar el efectivo"),{statusCode:409});
    }
   }
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});
 }finally{await session.endSession();}
 try{await publicarEvento(outbox);}catch(err){console.error("[FIN_PERSONAL_OUTBOX_POST_COMMIT]",err);}
 return tx;
}
async function publicarEvento(outbox){
 try{const claimed=await Outbox.findOneAndUpdate({_id:outbox._id,estado:{$in:["PENDIENTE","ERROR"]}},{$set:{estado:"PUBLICANDO",reclamadoEn:new Date()},$inc:{intentos:1}},{returnDocument:"after"});if(!claimed)return false;personalEventBus.emitFinancial(claimed.eventName,{eventId:claimed.eventId,usuarioId:claimed.usuarioId.toString(),aggregateId:claimed.aggregateId.toString(),payload:claimed.payload});
  await Outbox.updateOne({_id:claimed._id,estado:"PUBLICANDO"},{$set:{estado:"PUBLICADO",publicadoEn:new Date(),reclamadoEn:null,ultimoError:null}});return true;
 }catch(err){await Outbox.updateOne({_id:outbox._id,estado:"PUBLICANDO"},{$set:{estado:"ERROR",reclamadoEn:null,ultimoError:String(err.message||err).slice(0,500)}});throw err;}
}
async function republicarPendientes(limite=100){const expirado=new Date(Date.now()-5*60*1000);await Outbox.updateMany({estado:"PUBLICANDO",reclamadoEn:{$lte:expirado}},{$set:{estado:"ERROR",reclamadoEn:null,ultimoError:"Lease de publicación expirado; reintento seguro"}});const docs=await Outbox.find({estado:{$in:["PENDIENTE","ERROR"]}}).sort({createdAt:1}).limit(Math.min(limite,500));let publicados=0;for(const doc of docs){try{if(await publicarEvento(doc))publicados++;}catch(_){}}return publicados;}
async function flujoPeriodo(usuarioId,{desde,hasta}){
 const inicio=new Date(desde),fin=new Date(hasta);if(Number.isNaN(inicio.getTime())||Number.isNaN(fin.getTime())||inicio>=fin)throw Object.assign(new Error("Periodo inválido"),{statusCode:400});
 const rows=await consultarPeriodo({usuarioId,desde:inicio.toISOString(),hasta:fin.toISOString()});
 return calcularFlujo(rows,{incluirPrestamos:true});
}
// Compatibilidad explícita: impedir que consumidores antiguos reescriban asientos.
async function operacionHeredadaRetirada(){
 throw Object.assign(new Error("La operación heredada fue retirada; utiliza la compensación con clave idempotente"),{statusCode:410});
}
const corregirTransaccion=operacionHeredadaRetirada;
const anularTransaccion=operacionHeredadaRetirada;
module.exports={registrarTransaccion,confirmarRegistroIntento,republicarPendientes,flujoPeriodo,anularTransaccion,corregirTransaccion};
