"use strict";
const crypto=require("node:crypto"),mongoose=require("mongoose");
const Evento=require("../models/EventoCompensatorioPersonal");
const Cursor=require("../models/CursorCompensacionPersonal");
const {DOMINIO,verificarAnclaCompensaciones}=require("../security/anclaCompensacionesPersonal.service");
const fallo=codigo=>({valida:false,codigo,certificaCustodiaIndependiente:false});
// Solo para llamadores del servidor con clave pública y adaptador confiables.
// No recibe referencias desde HTTP ni configura un custodio de producción.
async function auditarAnclaCompensaciones({usuarioId,clavePublica,custodio}={}){
 if(!mongoose.isObjectIdOrHexString(usuarioId))return fallo("USUARIO_INVALIDO");
 if(!(clavePublica instanceof crypto.KeyObject)||clavePublica.type!=="public"||clavePublica.asymmetricKeyType!=="ed25519")
  return fallo("CLAVE_PUBLICA_NO_CONFIGURADA");
 if(!custodio||typeof custodio.obtenerUltimaAncla!=="function")return fallo("CUSTODIO_EXTERNO_NO_CONFIGURADO");
 const usuario=new mongoose.Types.ObjectId(String(usuarioId)).toHexString();
 const controlador=new AbortController();let timer,ancla;
 try{
  ancla=await Promise.race([
   Promise.resolve().then(()=>custodio.obtenerUltimaAncla(usuario,{dominio:DOMINIO,signal:controlador.signal})),
   new Promise((_,rechazar)=>{timer=setTimeout(()=>{controlador.abort();rechazar(Error("TIMEOUT"));},5000);})
  ]);
  if(!ancla||typeof ancla!=="object"||Array.isArray(ancla))return fallo("ANCLA_EXTERNA_NO_DISPONIBLE");
  ancla=structuredClone(ancla);
 }catch{return fallo("CUSTODIO_EXTERNO_NO_DISPONIBLE");}
 finally{clearTimeout(timer);}
 let session;
 try{
  session=await mongoose.startSession();let resultado;
  await session.withTransaction(async()=>{
   const eventos=await Evento.find({usuarioId:usuario},{_id:0}).sort({secuencia:1})
    .limit(10001).maxTimeMS(5000).session(session).lean();
   if(eventos.length>10000){resultado=fallo("LIMITE_VERIFICABLE_EXCEDIDO");return;}
   const cursor=await Cursor.findById(usuario).maxTimeMS(5000).session(session).lean();
   resultado=verificarAnclaCompensaciones({ancla,clavePublica,eventos,cursor,usuarioId:usuario});
  },{readConcern:{level:"snapshot"},readPreference:"primary"});
  return resultado;
 }catch{return fallo("LECTURA_LEDGER_NO_DISPONIBLE");}
 finally{if(session)await session.endSession();}
}
module.exports={auditarAnclaCompensaciones};
