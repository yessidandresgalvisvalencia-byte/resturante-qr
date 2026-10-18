"use strict";
const crypto=require("crypto");
const mongoose=require("mongoose");
const Transaccion=require("../models/TransaccionPersonal");
const Outbox=require("../models/outboxPersonal.model");
const Cuenta=require("../models/cuentaFinanciera.model");
const Prestamo=require("../models/prestamoPersonal.model");
const ReservaCuota=require("../models/reservaCuotaRecurrente.model");
const {validarFechaPagoVinculado,validarNoDuplicarOrigenHoy,periodoRecurrenteColombia,validarTotalPeriodoRecurrente}=require("./vinculoRecurrenteV81.service");
const {personalEventBus,PERSONAL_EVENTS}=require("../events/eventBusPersonal");
const {encryptObject}=require("../security/fieldEncryption.service");

function eventFor(tipo){if(tipo==="GASTO")return PERSONAL_EVENTS.GASTO_REGISTRADO;if(tipo==="INGRESO")return PERSONAL_EVENTS.INGRESO_DETECTADO;if(tipo==="PAGO_DEUDA")return PERSONAL_EVENTS.PAGO_DEUDA;if(tipo==="MOVIMIENTO_CORREGIDO")return PERSONAL_EVENTS.MOVIMIENTO_CORREGIDO;if(tipo==="MOVIMIENTO_ANULADO")return PERSONAL_EVENTS.MOVIMIENTO_ANULADO;if(tipo==="ACCION_PROGRESO_ACTUALIZADA")return PERSONAL_EVENTS.ACCION_PROGRESO_ACTUALIZADA;if(["PRESTAMO_OTORGADO","PRESTAMO_RECIBIDO","COBRO_PRESTAMO"].includes(tipo))return PERSONAL_EVENTS.MOVIMIENTO_PATRIMONIAL;throw new TypeError("Tipo de transacción no soportado");}
function hashExternalId(usuarioId,externalId){if(!externalId)return null;const secret=process.env.PERSONAL_IDEMPOTENCY_SECRET;if(!secret)throw new Error("PERSONAL_IDEMPOTENCY_SECRET requerido");return crypto.createHmac("sha256",secret).update(String(usuarioId)).update(":").update(String(externalId)).digest("hex");}
async function exigirIndiceUnicoReservaRecurrente(){
 let indices;
 try{indices=await ReservaCuota.collection.indexes();}
 catch(_){throw Object.assign(new Error("Índice único de cuotas recurrentes no disponible"),{statusCode:503});}
 const unico=indices.some(i=>i.unique===true&&i.key?.usuarioId===1&&
  i.key?.origenId===1&&i.key?.periodoInicio===1&&Object.keys(i.key).length===3);
 if(!unico)throw Object.assign(new Error("Índice único de cuotas recurrentes no configurado"),{statusCode:503});
}
async function registrarTransaccion(usuarioId,input){
 if(input.tipo==="GASTO"&&String(input.cuenta||"EFECTIVO").trim().toUpperCase()==="EFECTIVO"&&input.medioPago==="TRANSFERENCIA")input={...input,medioPago:"EFECTIVO"};
 if(!Number.isSafeInteger(input.montoMinor)||input.montoMinor<=0)throw Object.assign(new Error("montoMinor debe ser un entero positivo exacto"),{statusCode:400});if(input.externalId!==undefined&&input.externalId!==null&&!String(input.externalId).trim())throw Object.assign(new Error("externalId vacío no es válido"),{statusCode:400});
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
    const abonosPrevios=await Transaccion.find({
     usuarioId,tipo:"GASTO",recurrenteOrigenId:origen._id,
     estado:{$ne:"ANULADA"},fecha:{$gte:inicio,$lt:fin}
    }).select("montoMinor").session(session).lean();
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
    },{$inc:{reservadoMinor:input.montoMinor}},{new:true,session});
    if(!reserva)throw Object.assign(new Error("Cuota recurrente sin saldo disponible o reserva concurrente"),{statusCode:409});
    recurrenteOrigenId=origen._id;
   }
   let prestamoId=input.prestamoId||null;if(["PRESTAMO_RECIBIDO","PRESTAMO_OTORGADO","COBRO_PRESTAMO"].includes(input.tipo)&&!prestamoId)throw Object.assign(new Error("Este movimiento patrimonial requiere una obligación exacta; usa el flujo de préstamo/cobro para mantener caja y patrimonio sincronizados."),{statusCode:409});if(input.tipo==="PAGO_DEUDA"&&!prestamoId){const candidatas=await Prestamo.find({usuarioId,direccion:"POR_PAGAR",estado:{$in:["ACTIVO","VENCIDO"]},saldoMinor:{$gt:0}}).select("_id").session(session);if(candidatas.length!==1)throw Object.assign(new Error(candidatas.length?"Indica exactamente qué deuda estás pagando.":"No hay una deuda activa para aplicar este pago."),{statusCode:409});prestamoId=candidatas[0]._id;}const envelope=input.metadatosSensibles?encryptObject(input.metadatosSensibles,{aad:String(usuarioId)}):null;
   [tx]=await Transaccion.create([{usuarioId,prestamoId,recurrenteOrigenId,tipo:input.tipo,montoMinor:input.montoMinor,moneda:input.moneda||"COP",concepto:input.concepto,categoria:input.categoria,subcategoria:input.subcategoria||"",cuenta:input.cuenta||"EFECTIVO",medioPago:input.medioPago||"EFECTIVO",contraparte:input.contraparte||"",descripcion:input.descripcion||"",recurrente:Boolean(input.recurrente),frecuencia:input.frecuencia||"NINGUNA",fecha:input.fecha,origen:input.origen||"MANUAL",externalIdHash,metadatosCifrados:envelope?{ciphertext:envelope.ciphertext,iv:envelope.iv,tag:envelope.tag}:undefined,keyVersion:envelope?.keyVersion||null}],{session});
   if(input.tipo==="PAGO_DEUDA"){const p=await Prestamo.findOne({_id:prestamoId,usuarioId,direccion:"POR_PAGAR",estado:{$in:["ACTIVO","VENCIDO"]}}).session(session);if(!p)throw Object.assign(new Error("Deuda no encontrada"),{statusCode:404});if(input.montoMinor>p.saldoMinor)throw Object.assign(new Error("El pago supera el saldo pendiente"),{statusCode:409});p.saldoMinor-=input.montoMinor;if(p.saldoMinor===0)p.estado="PAGADO";await p.save({session});}if(input.tipo==="COBRO_PRESTAMO"){const p=await Prestamo.findOne({_id:prestamoId,usuarioId,direccion:"POR_COBRAR",estado:{$in:["ACTIVO","VENCIDO"]}}).session(session);if(!p)throw Object.assign(new Error("Cuenta por cobrar no encontrada"),{statusCode:404});if(input.montoMinor>p.saldoMinor)throw Object.assign(new Error("El cobro supera el saldo pendiente"),{statusCode:409});p.saldoMinor-=input.montoMinor;if(p.saldoMinor===0)p.estado="PAGADO";await p.save({session});}
   const eventId=crypto.randomUUID(),eventName=eventFor(input.tipo);
   [outbox]=await Outbox.create([{usuarioId,eventId,eventName,aggregateId:tx._id,payload:{transaccionId:tx._id.toString(),prestamoId:prestamoId?String(prestamoId):null,tipo:tx.tipo,montoMinor:tx.montoMinor,moneda:tx.moneda,categoria:tx.categoria,fecha:tx.fecha}}],{session});
   // El ledger y la liquidez deben cambiar en la misma transacción ACID.
   // Si el usuario aún no tiene la cuenta indicada, se crea con saldo cero y luego se aplica el movimiento.
   const nombreCuenta=String(input.cuenta||"EFECTIVO").trim()||"EFECTIVO";
   let cuenta=await Cuenta.findOne({usuarioId,nombre:nombreCuenta,activa:true}).session(session);
   if(!cuenta){
    [cuenta]=await Cuenta.create([{usuarioId,nombre:nombreCuenta,tipo:nombreCuenta.toUpperCase()==="EFECTIVO"?"EFECTIVO":"OTRA",institucion:"",moneda:"COP",saldoMinor:0,activa:true}],{session});
   }
   const delta=input.tipo==="INGRESO"||input.tipo==="PRESTAMO_RECIBIDO"||input.tipo==="COBRO_PRESTAMO"?input.montoMinor:input.tipo==="GASTO"||input.tipo==="PAGO_DEUDA"||input.tipo==="PRESTAMO_OTORGADO"?-input.montoMinor:0;
   if(delta){
    const actualizada=await Cuenta.findOneAndUpdate({_id:cuenta._id,usuarioId,activa:true,...(delta<0?{saldoMinor:{$gte:-delta}}:{})},{$inc:{saldoMinor:delta}},{new:true,session});
    if(!actualizada){
     const esEfectivoHistorico=input.tipo==="GASTO"&&nombreCuenta.toUpperCase()==="EFECTIVO"&&input.medioPago==="EFECTIVO"&&input.fecha&&new Date(input.fecha).getTime()<=Date.now();
     if(!esEfectivoHistorico)throw Object.assign(new Error("Saldo insuficiente en "+nombreCuenta),{statusCode:409});
     const pendiente=await Cuenta.findOneAndUpdate({_id:cuenta._id,usuarioId,activa:true},{$inc:{saldoMinor:delta},$set:{requiereReconciliacion:true,origenSaldo:"NO_VERIFICADO",saldoVerificadoEn:null,saldoAnclaMinor:null,saldoAnclaEn:null}},{new:true,session});
     if(!pendiente)throw Object.assign(new Error("No se pudo reconciliar el efectivo"),{statusCode:409});
    }
   }
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});
 }finally{await session.endSession();}
 try{await publicarEvento(outbox);}catch(err){console.error("[FIN_PERSONAL_OUTBOX_POST_COMMIT]",err);}
 return tx;
}
async function publicarEvento(outbox){
 try{const claimed=await Outbox.findOneAndUpdate({_id:outbox._id,estado:{$in:["PENDIENTE","ERROR"]}},{$set:{estado:"PUBLICANDO",reclamadoEn:new Date()},$inc:{intentos:1}},{new:true});if(!claimed)return false;personalEventBus.emitFinancial(claimed.eventName,{eventId:claimed.eventId,usuarioId:claimed.usuarioId.toString(),aggregateId:claimed.aggregateId.toString(),payload:claimed.payload});
  await Outbox.updateOne({_id:claimed._id,estado:"PUBLICANDO"},{$set:{estado:"PUBLICADO",publicadoEn:new Date(),reclamadoEn:null,ultimoError:null}});return true;
 }catch(err){await Outbox.updateOne({_id:outbox._id,estado:"PUBLICANDO"},{$set:{estado:"ERROR",reclamadoEn:null,ultimoError:String(err.message||err).slice(0,500)}});throw err;}
}
async function republicarPendientes(limite=100){const expirado=new Date(Date.now()-5*60*1000);await Outbox.updateMany({estado:"PUBLICANDO",reclamadoEn:{$lte:expirado}},{$set:{estado:"ERROR",reclamadoEn:null,ultimoError:"Lease de publicación expirado; reintento seguro"}});const docs=await Outbox.find({estado:{$in:["PENDIENTE","ERROR"]}}).sort({createdAt:1}).limit(Math.min(limite,500));let publicados=0;for(const doc of docs){try{if(await publicarEvento(doc))publicados++;}catch(_){}}return publicados;}
async function flujoPeriodo(usuarioId,{desde,hasta}){
 const inicio=new Date(desde),fin=new Date(hasta);if(Number.isNaN(inicio.getTime())||Number.isNaN(fin.getTime())||inicio>=fin)throw Object.assign(new Error("Periodo inválido"),{statusCode:400});
 const rows=await Transaccion.aggregate([{$match:{usuarioId:new mongoose.Types.ObjectId(usuarioId),estado:{$ne:"ANULADA"},moneda:"COP",fecha:{$gte:inicio,$lt:fin}}},{$group:{_id:"$tipo",total:{$sum:"$montoMinor"}}}]);
 const totals=Object.fromEntries(rows.map(x=>[x._id,x.total]));const ingresos=(totals.INGRESO||0)+(totals.PRESTAMO_RECIBIDO||0)+(totals.COBRO_PRESTAMO||0),gastos=(totals.GASTO||0)+(totals.PRESTAMO_OTORGADO||0),pagosDeuda=totals.PAGO_DEUDA||0;
 return{ingresosMinor:ingresos,gastosMinor:gastos,pagosDeudaMinor:pagosDeuda,flujoNetoMinor:ingresos-gastos-pagosDeuda,moneda:"COP"};
}
async function corregirTransaccion(usuarioId,id,cambios){if(!mongoose.isValidObjectId(id))throw Object.assign(new Error("Identificador inválido"),{statusCode:400});const permitidos={};for(const k of ["tipo","montoMinor","concepto","categoria"])if(cambios[k]!==undefined)permitidos[k]=cambios[k];if(!Object.keys(permitidos).length)throw Object.assign(new Error("No hay cambios válidos"),{statusCode:400});const session=await mongoose.startSession();try{let tx;await session.withTransaction(async()=>{const anterior=await Transaccion.findOne({_id:id,usuarioId,tipo:{$in:["INGRESO","GASTO"]},estado:{$ne:"ANULADA"}}).session(session);if(!anterior)throw Object.assign(new Error("Movimiento no disponible"),{statusCode:404});if(anterior.recurrenteOrigenId&&(
  (permitidos.montoMinor!==undefined&&permitidos.montoMinor!==anterior.montoMinor)||
  (permitidos.tipo!==undefined&&permitidos.tipo!==anterior.tipo)
 ))throw Object.assign(new Error("No se permite cambiar el importe o tipo de un abono recurrente vinculado; anúlalo y registra el correcto"),{statusCode:409});
 if(anterior.recurrente&&anterior.tipo==="GASTO"&&(
   (permitidos.montoMinor!==undefined&&permitidos.montoMinor!==anterior.montoMinor)||
   (permitidos.tipo!==undefined&&permitidos.tipo!==anterior.tipo)
 )){
  const relacionados=await Transaccion.exists({usuarioId,recurrenteOrigenId:anterior._id,estado:{$ne:"ANULADA"}}).session(session);
  if(relacionados)throw Object.assign(new Error("No se puede modificar el importe de una obligación con abonos vigentes"),{statusCode:409});
  // Aun después de anular todos los abonos, las reservas conservan
  // importeCuotaMinor. Cambiar el origen rompería ese invariante.
  const reservaHistorica=await ReservaCuota.exists({usuarioId,origenId:anterior._id}).session(session);
  if(reservaHistorica)throw Object.assign(new Error("No se puede modificar el importe o tipo de una obligación con reservas históricas; usa una obligación nueva"),{statusCode:409});
 }
 const signo=t=>t==="INGRESO"?1:-1,delta=(signo(permitidos.tipo||anterior.tipo)*(permitidos.montoMinor??anterior.montoMinor))-(signo(anterior.tipo)*anterior.montoMinor);if(delta){const cuenta=await Cuenta.findOneAndUpdate({usuarioId,nombre:anterior.cuenta,activa:true,...(delta<0?{saldoMinor:{$gte:-delta}}:{})},{$inc:{saldoMinor:delta}},{new:true,session});if(!cuenta)throw Object.assign(new Error("No se puede corregir: saldo insuficiente o cuenta no encontrada"),{statusCode:409});}const antes={tipo:anterior.tipo,montoMinor:anterior.montoMinor,concepto:anterior.concepto,categoria:anterior.categoria};Object.assign(anterior,permitidos);await anterior.save({session});await Outbox.create([{usuarioId,eventId:crypto.randomUUID(),eventName:"MOVIMIENTO_CORREGIDO",aggregateId:anterior._id,payload:{transaccionId:String(anterior._id),antes,despues:{tipo:anterior.tipo,montoMinor:anterior.montoMinor,concepto:anterior.concepto,categoria:anterior.categoria}}}],{session});tx=anterior;},{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});return tx;}finally{await session.endSession();}}
async function anularTransaccion(usuarioId,id,motivo="Anulada por el usuario"){if(!mongoose.isValidObjectId(id))throw Object.assign(new Error("Identificador inválido"),{statusCode:400});const session=await mongoose.startSession();try{let tx;await session.withTransaction(async()=>{tx=await Transaccion.findOne({_id:id,usuarioId,tipo:{$in:["INGRESO","GASTO"]},estado:{$ne:"ANULADA"}}).session(session);if(!tx)throw Object.assign(new Error("Movimiento no disponible o ya eliminado"),{statusCode:404});if(tx.recurrente&&tx.tipo==="GASTO"){
  const abonoActivo=await Transaccion.exists({usuarioId,recurrenteOrigenId:tx._id,estado:{$ne:"ANULADA"}}).session(session);
  if(abonoActivo)throw Object.assign(new Error("No se puede anular la obligación mientras tenga abonos activos"),{statusCode:409});
 }
 if(tx.recurrenteOrigenId){
  const origen=await Transaccion.findOne({_id:tx.recurrenteOrigenId,usuarioId,
   tipo:"GASTO",recurrente:true}).select("fecha frecuencia montoMinor").session(session);
  if(!origen)throw Object.assign(new Error("Obligación recurrente de este abono no encontrada"),{statusCode:409});
  const {inicio}=periodoRecurrenteColombia({
   fechaOrigen:origen.fecha,fechaPago:tx.fecha,frecuencia:origen.frecuencia
  });
  const reserva=await ReservaCuota.findOneAndUpdate({
   usuarioId,origenId:origen._id,periodoInicio:inicio,
   reservadoMinor:{$gte:tx.montoMinor}
  },{$inc:{reservadoMinor:-tx.montoMinor}},{new:true,session});
  if(!reserva)throw Object.assign(new Error("No se puede anular: reserva recurrente ausente o inconsistente"),{statusCode:409});
 }
 const reverso=tx.tipo==="INGRESO"?-tx.montoMinor:tx.montoMinor;const cuenta=await Cuenta.findOneAndUpdate({usuarioId,nombre:tx.cuenta,activa:true,...(reverso<0?{saldoMinor:{$gte:-reverso}}:{})},{$inc:{saldoMinor:reverso}},{new:true,session});if(!cuenta){const esEfectivo=String(tx.cuenta||"").trim().toUpperCase()==="EFECTIVO";if(!esEfectivo||reverso>=0)throw Object.assign(new Error("No se puede anular: cuenta no encontrada o saldo insuficiente. Revisa la cuenta y sus movimientos posteriores."),{statusCode:409});const pendiente=await Cuenta.findOneAndUpdate({usuarioId,nombre:tx.cuenta,tipo:"EFECTIVO",activa:true},{$inc:{saldoMinor:reverso},$set:{requiereReconciliacion:true,origenSaldo:"NO_VERIFICADO",saldoVerificadoEn:null,saldoAnclaMinor:null,saldoAnclaEn:null}},{new:true,session});if(!pendiente)throw Object.assign(new Error("No se puede anular: cuenta de efectivo no encontrada"),{statusCode:409});}tx.estado="ANULADA";tx.anuladaEn=new Date();tx.motivoAnulacion=String(motivo).slice(0,240);await tx.save({session});await Outbox.create([{usuarioId,eventId:crypto.randomUUID(),eventName:"MOVIMIENTO_ANULADO",aggregateId:tx._id,payload:{transaccionId:String(tx._id),tipo:tx.tipo,montoMinor:tx.montoMinor,motivo:tx.motivoAnulacion}}],{session});},{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});return tx;}finally{await session.endSession();}}
module.exports={registrarTransaccion,republicarPendientes,flujoPeriodo,anularTransaccion,corregirTransaccion};