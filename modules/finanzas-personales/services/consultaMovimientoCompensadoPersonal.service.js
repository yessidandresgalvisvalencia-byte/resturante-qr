"use strict";
const mongoose=require("mongoose");
const Movimiento=require("../models/TransaccionPersonal");
const Evento=require("../models/EventoCompensatorioPersonal");
const Cursor=require("../models/CursorCompensacionPersonal");
const Cuenta=require("../models/cuentaFinanciera.model");
const {elegibilidadCompensacion}=require("./elegibilidadCompensacionPersonal.service");
const {canon,originalVerificado}=require("./eventoCompensatorioPersonal.service");
const {comprobarHistorialCompensatorio}=require("./comprobarHistorialCompensatorio.service");
const GENESIS="0".repeat(64),LIMITE=10000;
function fallo(msg,statusCode=409){
 return Object.assign(new Error(msg),{statusCode});
}
// GET de la versión actual requerida para compensación optimista.
// Lee asiento original, TODA la cadena y cursor en el mismo snapshot Mongo.
function crearConsultaMovimientoCompensado({
 MovimientoModelo=Movimiento,EventoModelo=Evento,CursorModelo=Cursor,CuentaModelo=Cuenta,
 nuevaSesion=()=>mongoose.startSession()
}={}){
 return async function consultar(usuarioId,movimientoId){
  if(!mongoose.isValidObjectId(usuarioId)||!mongoose.isValidObjectId(movimientoId))
   throw fallo("Identificador inválido",400);
  const uid=String(usuarioId),mid=String(movimientoId);
  const session=await nuevaSesion();
  try{
   let resultado;
   await session.withTransaction(async()=>{
    const asiento=await MovimientoModelo.findOne({
     _id:mid,usuarioId:new mongoose.Types.ObjectId(uid)
    }).session(session).lean();
    if(!asiento)throw fallo("Movimiento no encontrado",404);
    const cuenta=asiento.cuentaId?await CuentaModelo.findOne({
     _id:asiento.cuentaId,usuarioId:new mongoose.Types.ObjectId(uid)
    }).session(session).lean():null;
    const eventos=await EventoModelo.find({usuarioId:uid})
     .sort({secuencia:1}).limit(LIMITE+1).session(session).lean();
    const cursor=await CursorModelo.findById(uid).session(session).lean();
    if(!Array.isArray(eventos)||eventos.length>LIMITE)
     throw fallo("Historial excede verificación completa",503);
    if(cursor){
     if(!Number.isSafeInteger(cursor.secuencia)||cursor.secuencia!==eventos.length||
      cursor.hashActual!==(eventos.length?eventos.at(-1).hashActual:GENESIS))
      throw fallo("INTEGRIDAD_LEDGER: cursor y cadena inconsistentes");
    }else if(eventos.length)throw fallo("INTEGRIDAD_LEDGER: eventos sin cursor");
    const actuales=comprobarHistorialCompensatorio(eventos,{usuarioId:uid});
    // Las operaciones patrimoniales o de deuda NO admiten este mecanismo.
    // Se pueden consultar sin falsificar un descriptor INGRESO/GASTO.
    const ordinario=["INGRESO","GASTO"].includes(asiento.tipo);
    if(!ordinario){
     if(actuales.has(mid))
      throw fallo("INTEGRIDAD_LEDGER: evento sobre tipo patrimonial no admitido");
     resultado=Object.freeze({
      movimientoId:mid,original:null,anulado:asiento.estado==="ANULADA",
      elegibleParaCompensar:false,ultimaSecuencia:0,
      hashCadena:cursor?.hashActual||GENESIS,
      motivo:"TIPO_NO_ADMITIDO_POR_LEDGER_COMPENSATORIO"
     });
     return;
    }
    let original;
    try{
     original=originalVerificado({
      usuarioId:uid,movimientoId:mid,tipo:asiento.tipo,
      montoMinor:asiento.montoMinor,concepto:asiento.concepto,
      categoria:asiento.categoria
     });
    }catch(_){throw fallo("Movimiento original inválido para compensación");}
    const primerEvento=eventos.find(e=>e.movimientoId===mid);
    if(primerEvento&&canon(primerEvento.original)!==canon(original))
     throw fallo("INTEGRIDAD_LEDGER: original alterado");
    const estado=actuales.get(mid);
    const version=estado?.actual||original;
    const elegible=elegibilidadCompensacion({asiento,cuenta,usuarioId:uid});
    resultado=Object.freeze({
     movimientoId:mid,
     original:version,
     anulado:estado?.anulado===true||asiento.estado==="ANULADA",
     elegibleParaCompensar:elegible&&estado?.anulado!==true,
     ultimaSecuencia:primerEvento?
      eventos.filter(e=>e.movimientoId===mid).at(-1).secuencia:0,
     hashCadena:cursor?.hashActual||GENESIS
    });
   },{readConcern:{level:"snapshot"},readPreference:"primary"});
   return resultado;
  }finally{await session.endSession();}
 };
}
module.exports={crearConsultaMovimientoCompensado,LIMITE};
