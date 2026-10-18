"use strict";
const mongoose=require("mongoose");
const Evento=require("../models/eventoV81.model");
const Cabeza=require("../models/cabezaV81.model");
const {crearEvento,verificarCadena,GENESIS}=require("./cadenaEventosV81.service");
// Debe invocarse únicamente en una transacción MongoDB con writeConcern majority.
// No registra efectos en caja: la integración contable requiere conciliación previa.
async function anexarEventoV81(usuarioId,datos){
 if(!mongoose.isValidObjectId(usuarioId))throw new TypeError("Usuario inválido");
 const userId=String(usuarioId);
 if (!datos || typeof datos !== "object" || typeof datos.id !== "string" || !datos.id.trim()) throw new TypeError("eventId obligatorio para idempotencia");
 const session=await mongoose.startSession();
 try {
  let evento;
  await session.withTransaction(async()=>{
   const existente=await Evento.findOne({usuarioId,eventId:datos.id}).session(session).lean();
   let cabeza=await Cabeza.findOne({usuarioId}).session(session).lean();
   if(!cabeza){
    try {
     await Cabeza.create([{usuarioId,version:0,hashActual:GENESIS}],{session});
    } catch(e) { throw e; } // Un alta concurrente falla: el llamador reintenta toda la operación.
    cabeza={version:0,hashActual:GENESIS};
   }
   // Antes de anexar, comprobar que la cabeza apunta al último evento real.
   // Evita seguir escribiendo si se borró o alteró el evento final.
   const ultimo=cabeza.version>0
    ? await Evento.findOne({usuarioId,version:cabeza.version}).session(session).lean()
    : null;
   if((cabeza.version===0 && cabeza.hashActual!==GENESIS) ||
      (cabeza.version>0 && (!ultimo || ultimo.hashActual!==cabeza.hashActual))) {
    throw Object.assign(new Error("Integridad V81 comprometida: cabeza sin último evento coincidente"),{statusCode:409});
   }
   // La verificación del último hash por sí sola no detecta eventos intermedios eliminados.
   const cantidadEventos=await Evento.countDocuments({usuarioId}).session(session);
   if(cantidadEventos!==cabeza.version){
    throw Object.assign(new Error("Integridad V81 comprometida: cantidad de eventos distinta de la secuencia"),{statusCode:409});
   }
   // Auditoría completa en el snapshot transaccional antes de cada nueva escritura.
   // Conservador (O(n)): reemplazar por checkpoints verificables antes de escalar.
   if(cabeza.version>0){
    const rows=await Evento.find({usuarioId}).sort({version:1}).session(session).lean();
    let validos=false;
    try{
     const cadena=rows.map(e=>({
      id:e.eventId,userId:String(e.usuarioId),version:e.version,tipo:e.tipo,
      montoCentavos:BigInt(e.montoCentavos),fechaContable:e.fechaContable,
      timestamp:e.timestamp,corrigeId:e.corrigeId,motivo:e.motivo,
      tipoCorregido:e.tipoCorregido,hashAnterior:e.hashAnterior,hashActual:e.hashActual
     }));
     validos=verificarCadena(cadena,cabeza.hashActual);
    }catch(_){validos=false;}
    if(!validos)throw Object.assign(new Error("Integridad V81 comprometida: cadena criptográfica inválida"),{statusCode:409});
   }
   // Incluso un reintento idempotente debe pasar la auditoría del ledger.
   if(existente){
    const candidato=crearEvento({...datos,userId,version:existente.version},existente.hashAnterior);
    if(candidato.hashActual!==existente.hashActual)throw Object.assign(new Error("Identificador reutilizado con contenido diferente"),{statusCode:409});
    evento=candidato;
    return;
   }
   if(datos.tipo==="CORRECCION" || datos.tipo==="ANULACION"){
    if(typeof datos.corrigeId!=="string" || !datos.corrigeId.trim())throw Object.assign(new Error("Referencia de corrección obligatoria"),{statusCode:400});
    const original=await Evento.findOne({usuarioId,eventId:datos.corrigeId,tipo:{$in:["INGRESO","GASTO"]}}).session(session).lean();
    if(!original)throw Object.assign(new Error("Movimiento original inexistente para este usuario"),{statusCode:409});
    // La corrección puede reclasificar INGRESO/GASTO, pero nunca dejar importe cero.
    if(datos.tipo==="CORRECCION" && (typeof datos.montoCentavos!=="bigint" || datos.montoCentavos<=0n)){
     throw Object.assign(new Error("Corrección V81 exige un monto positivo en centavos"),{statusCode:400});
    }
    const anulado=await Evento.findOne({usuarioId,corrigeId:datos.corrigeId,tipo:"ANULACION"}).session(session).lean();
    if(anulado)throw Object.assign(new Error("Movimiento ya anulado: no admite nuevas compensaciones"),{statusCode:409});
    if(datos.tipo==="ANULACION" && datos.montoCentavos!==0n)throw Object.assign(new Error("Anulación debe tener monto cero"),{statusCode:400});
   }
   const version=cabeza.version+1;
   evento=crearEvento({...datos,userId,version},cabeza.hashActual);
   // Comparación y sustitución: solo una escritura puede avanzar esta versión.
   const update=await Cabeza.updateOne({usuarioId,version:cabeza.version,hashActual:cabeza.hashActual},
     {$set:{version,hashActual:evento.hashActual}},{session});
   if(update.modifiedCount!==1)throw Object.assign(new Error("Conflicto de concurrencia en ledger V81"),{statusCode:409});
   await Evento.create([{usuarioId,eventId:evento.id,version,tipo:evento.tipo,
    montoCentavos:evento.montoCentavos.toString(),fechaContable:evento.fechaContable,
    timestamp:evento.timestamp,corrigeId:evento.corrigeId||null,motivo:evento.motivo||null,
    tipoCorregido:evento.tipoCorregido||null,hashAnterior:evento.hashAnterior,hashActual:evento.hashActual}],{session});
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});
  return evento;
 } catch(error) {
  throw normalizarErrorTransaccionalV81(error);
 } finally {await session.endSession();}
}
// Los conflictos transitorios no prueban que la operación no se haya confirmado.
// El cliente debe recuperar el resultado reintentando con exactamente el mismo eventId.
function normalizarErrorTransaccionalV81(error){
 if(error && error.code===11000)
  return Object.assign(new Error("Conflicto de clave única: reintenta con el mismo eventId"),{statusCode:409,codigo:"REINTENTAR_MISMO_ID"});
 if(error && (
  error.code===112 || error.code===251 ||
  error.hasErrorLabel?.("TransientTransactionError")===true ||
  error.hasErrorLabel?.("UnknownTransactionCommitResult")===true ||
  error.errorLabels?.includes?.("TransientTransactionError") ||
  error.errorLabels?.includes?.("UnknownTransactionCommitResult")
 )){
  return Object.assign(new Error("Resultado transaccional incierto: reintenta con el mismo eventId"),{statusCode:409,codigo:"REINTENTAR_MISMO_ID"});
 }
 return error;
}
module.exports={anexarEventoV81,normalizarErrorTransaccionalV81};
