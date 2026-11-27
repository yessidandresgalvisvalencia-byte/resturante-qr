"use strict";
const mongoose=require("mongoose"),crypto=require("node:crypto"),R=require("../models/reciboRevisionTrabajoPersonal.model"),T=require("../models/TransaccionPersonal"),Aud=require("../security/contextoAuditoriaRevisionTrabajoPersonal.service"),{indiceExacto,indiceConsultaExacto}=require("../security/auditoriaIndicesMongoV81.service"),{canonSeleccion,versionSeleccion}=require("./seleccionRevisionTrabajoPersonal.service");
const PATH="/reconciliar-ingresos-trabajo",falla=(m,c=409)=>Object.assign(Error(m),{statusCode:c}),digest=v=>crypto.createHash("sha256").update(JSON.stringify(canonSeleccion(v))).digest("hex"),idValido=s=>typeof s==="string"&&/^[A-Za-z0-9_-]{8,100}$/.test(s);
function validarSolicitud(u,s){if(!mongoose.isObjectIdOrHexString(u)||s?.confirmacion!==true||typeof s.versionSeleccion!=="string"||!/^[a-f0-9]{64}$/.test(s.versionSeleccion)||!idValido(s.solicitudId)||Object.keys(s).some(k=>!["confirmacion","versionSeleccion","solicitudId"].includes(k)))throw falla("Previsualiza y confirma con versión y clave estable de revisión",400);}
function solicitudHuella(v){return digest({metodo:"POST",path:PATH,cuerpo:{confirmacion:true,versionSeleccion:v}});}
function hash(r){return digest(Object.fromEntries(["usuarioId","solicitudId","versionSeleccion","versionObservada","seleccion","resultado","compensaciones","fuentes","fecha","auditoriaContexto"].map(k=>[k,r[k]])));}
function verificar(r){
 if(!r||!Array.isArray(r.compensaciones)||!mongoose.isObjectIdOrHexString(r.usuarioId)||!idValido(r.solicitudId)||!Array.isArray(r.seleccion)||r.seleccion.length>500||!Array.isArray(r.fuentes)||r.fuentes.length>5000||!(r.fecha instanceof Date)||!Number.isFinite(+r.fecha)||+r.fecha>Date.now()||r.hashActual!==hash(r)||r.versionObservada!==versionSeleccion(r.usuarioId,r.seleccion)||!/^[a-f0-9]{64}$/.test(r.versionSeleccion||""))throw falla("Recibo de revisión no verificable");
 Aud.validarDocumento(r,r.usuarioId);if(!r.auditoriaContexto)throw falla("Recibo sin contexto conservado");
 if(r.seleccion.some(p=>!p?.resumen||!Number.isSafeInteger(p.resumen.reclasificaciones)||p.resumen.reclasificaciones<0||!["REQUIERE_REVISION","RECLASIFICAR","SIN_CAMBIOS"].includes(p.resumen.estado)))throw falla("Selección del recibo inválida");
 const x=r.resultado,vigente=r.versionSeleccion===r.versionObservada,propuestos=r.seleccion.reduce((n,p)=>n+p.resumen.reclasificaciones,0),manual=r.seleccion.filter(p=>p.resumen.estado==="REQUIERE_REVISION").length;
 if(x?.versionSeleccion!==r.versionSeleccion||x.corregidos!==(vigente?propuestos:0)||x.requierenRevisionManual!==(vigente?manual:null)||x.estado!==(!vigente?"NO_APLICADA":propuestos?"CORREGIDO":manual?"REQUIERE_REVISION":"SIN_CAMBIOS")||r.seleccion.some(p=>String(p.original?.usuarioId)!==String(r.usuarioId)||!Array.isArray(p.movimientos)))throw falla("Resultado del recibo no coincide con su selección");
 if(new Set(r.fuentes.map(f=>f.id)).size!==r.fuentes.length||r.fuentes.some(f=>!mongoose.isObjectIdOrHexString(f.id)||!/^[a-f0-9]{64}$/.test(f.hash||"")))throw falla("Fuentes de revisión inválidas");
 if(r.compensaciones.length!==x.corregidos||new Set(r.compensaciones.map(c=>c.movimientoId)).size!==r.compensaciones.length||r.compensaciones.some(c=>!mongoose.isObjectIdOrHexString(c.movimientoId)||!/^[a-f0-9]{64}$/.test(c.hash||"")||!Number.isSafeInteger(c.secuencia)||c.secuencia<1||!r.fuentes.some(f=>f.id===c.movimientoId)))throw falla("Compensaciones de revisión inválidas");return r;
}
async function exigirIndices(){let i;try{i=await R.collection.indexes();}catch{throw falla("Índices de recibos de revisión no disponibles",503);}if(!indiceExacto(i,["usuarioId","solicitudId"]))throw falla("Índice de revisión no verificado",503);}
async function buscar(usuarioId,solicitudId,session){return R.findOne({usuarioId,solicitudId}).select("+seleccion +fuentes +compensaciones +auditoriaContexto").session(session).maxTimeMS(5000).lean();}
async function verificarFuentes(r,session){
 verificar(r);const ids=r.fuentes.map(f=>new mongoose.Types.ObjectId(f.id)),rows=ids.length?await T.collection.find({_id:{$in:ids},usuarioId:new mongoose.Types.ObjectId(String(r.usuarioId))},{session,maxTimeMS:5000}).toArray():[],porId=new Map(rows.map(x=>[String(x._id),x]));
 if(r.fuentes.some(f=>!porId.has(f.id)||digest(porId.get(f.id))!==f.hash))throw falla("Fuentes originales de la revisión no verificables");
 // Verifica la cadena completa actual; no exige que la clasificación histórica siga vigente.
 if(r.compensaciones.length){const es=await require("../models/EventoCompensatorioPersonal").find({usuarioId:String(r.usuarioId),hashActual:{$in:r.compensaciones.map(c=>c.hash)}}).session(session).maxTimeMS(5000).lean();const porHash=new Map(es.map(e=>[e.hashActual,e]));if(r.compensaciones.some(c=>{const e=porHash.get(c.hash);return !e||e.movimientoId!==c.movimientoId||e.secuencia!==c.secuencia||e.tipo!=="CORRECCION"||e.cambios?.tipo!=="INGRESO"||e.deltaCajaMinor!=="0";}))throw falla("Compensaciones conservadas no verificables");}
 if(r.fuentes.length)try{await require("./consultaCompensadaPersonal.service").consultarPeriodo({usuarioId:r.usuarioId,desde:"0001-01-01T00:00:00.000Z",hasta:"9999-12-31T23:59:59.999Z"},{session});}catch(e){if(typeof e.message==="string"&&e.message.startsWith("INTEGRIDAD_LEDGER:"))throw falla("Cadena de compensaciones no verificable; conserva la solicitud sin confirmar");throw e;}return r;
}
async function crear({usuarioId,solicitud,huellas,versionObservada,resultado,compensaciones,auditoriaContexto},session){
 if(!session?.inTransaction())throw falla("El recibo requiere la transacción de revisión");
 const ids=[...new Set(huellas.flatMap(p=>p.movimientos.map(m=>String(m._id))))];if(ids.length>5000)throw falla("Demasiadas fuentes de revisión",422);
 const rows=ids.length?await T.collection.find({_id:{$in:ids.map(id=>new mongoose.Types.ObjectId(id))},usuarioId:new mongoose.Types.ObjectId(String(usuarioId))},{session,maxTimeMS:5000}).sort({_id:1}).toArray():[];
 if(rows.length!==ids.length)throw falla("Fuente de revisión ausente");
 const r={usuarioId,solicitudId:solicitud.solicitudId,versionSeleccion:solicitud.versionSeleccion,versionObservada,seleccion:canonSeleccion(huellas),resultado,compensaciones,fuentes:rows.map(x=>({id:String(x._id),hash:digest(x)})),fecha:new Date(),auditoriaContexto};r.hashActual=hash(r);verificar(r);
 if(Buffer.byteLength(JSON.stringify(canonSeleccion(r)))>1024*1024)throw falla("Recibo de revisión supera capacidad verificable",422);
 await R.create([r],{session});return r;
}
function salida(r,duplicado=false){verificar(r);const recibo={confirmado:true,usuarioId:String(r.usuarioId),solicitudId:r.solicitudId,versionSeleccion:r.versionSeleccion,solicitudHuella:solicitudHuella(r.versionSeleccion),ruta:PATH,metodo:"POST",hash:r.hashActual,certificaEstadoActual:false,afectaCaja:false,noAplicada:r.resultado.estado==="NO_APLICADA",duplicado,...Aud.enlace(r),contextoAuditoria:Aud.resumen(r.auditoriaContexto)};return{...r.resultado,recibo};}
async function consultar(u,id){if(!mongoose.isObjectIdOrHexString(u)||!idValido(id))throw falla("Solicitud de revisión inválida",400);await exigirIndices();const session=await mongoose.startSession();try{return await session.withTransaction(async()=>{const r=await buscar(u,id,session);if(!r)throw falla("No hay recibo verificable; conserva la solicitud original",404);await verificarFuentes(r,session);return salida(r,true);},{readConcern:{level:"snapshot"},readPreference:"primary"});}finally{await session.endSession();}}
async function listar(u,cursor=null){
 if(!mongoose.isObjectIdOrHexString(u)||cursor!==null&&(typeof cursor!=="string"||!/^[a-f0-9]{24}$/.test(cursor)))throw falla("Cursor de historial inválido",400);
 await exigirIndices();let indices;try{indices=await R.collection.indexes();}catch{throw falla("Índices de historial no disponibles",503);}
 if(!indiceConsultaExacto(indices,"fp_revision_trabajo_historial_v1",["usuarioId","_id"]))throw falla("Índice de historial de revisión no verificado",503);
 const session=await mongoose.startSession();try{return await session.withTransaction(async()=>{
  if(cursor&&!await R.findOne({_id:cursor,usuarioId:u}).select("_id").session(session).maxTimeMS(5000).lean())throw falla("Cursor de historial no encontrado para tu usuario",404);
  const filas=await R.find({usuarioId:u,...(cursor?{_id:{$lt:new mongoose.Types.ObjectId(cursor)}}:{})}).select("+seleccion +fuentes +compensaciones +auditoriaContexto").sort({_id:-1}).hint("fp_revision_trabajo_historial_v1").limit(21).maxTimeMS(5000).session(session).lean();
  const pagina=filas.slice(0,20);for(const r of pagina)verificar(r);
  return{recibos:pagina.map(r=>({solicitudId:r.solicitudId,fecha:r.fecha.toISOString(),estado:r.resultado.estado,corregidos:r.resultado.corregidos,requierenRevisionManual:r.resultado.requierenRevisionManual,hash:r.hashActual,verificacionFuentesPendiente:true})),siguiente:filas.length>20?String(pagina.at(-1)._id):null,soloLectura:true,certificaEstadoActual:false};
 },{readConcern:{level:"snapshot"},readPreference:"primary"});}finally{await session.endSession();}
}
module.exports={listar,Aud,validarSolicitud,exigirIndices,buscar,verificar,verificarFuentes,crear,salida,consultar,hash,solicitudHuella};
