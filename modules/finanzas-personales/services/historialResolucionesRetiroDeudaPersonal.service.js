"use strict";
const mongoose=require("mongoose"),crypto=require("node:crypto");
const P=require("../models/prestamoPersonal.model"),E=require("../models/retiroDeudaPersonal.model"),M=require("../models/resolucionRetiroDeudaPersonal.model");
const S=require("./retiroDeudaPersonal.service"),R=require("./resolucionRetiroDeudaPersonal.service");
const DOMINIO="FP_HISTORIAL_RESOLUCIONES_RETIRO_V1",GENESIS="0".repeat(64);
const fallo=(m,c=409)=>Object.assign(new Error(m),{statusCode:c});
const claves=(o)=>Object.keys(o).sort().join(",");
const plano=o=>o!==null&&typeof o==="object"&&!Array.isArray(o)&&[null,Object.prototype].includes(Object.getPrototypeOf(o));
const codificar=o=>Buffer.from(JSON.stringify(o)).toString("base64url");

// El cursor es una referencia de lectura, no una credencial ni una firma independiente.
// La autorización siempre viene del JWT y la huella se recalcula desde ambas cadenas.
function opciones(query,u,id){
 if(!plano(query)||Object.keys(query).some(k=>!["limite","cursor"].includes(k)))throw fallo("Filtros de historial no admitidos",400);
 if(Object.hasOwn(query,"cursor")){
  if(claves(query)!=="cursor"||typeof query.cursor!=="string"||query.cursor.length>2048||!/^[A-Za-z0-9_-]+$/.test(query.cursor))throw fallo("Cursor de historial inválido",400);
  let c;try{c=JSON.parse(Buffer.from(query.cursor,"base64url").toString("utf8"));}catch{throw fallo("Cursor de historial inválido",400);}
  if(!plano(c)||claves(c)!=="desde,dominio,huella,limite,prestamoId,usuarioId,version"||c.version!==1||c.dominio!==DOMINIO||c.usuarioId!==u||c.prestamoId!==id||typeof c.huella!=="string"||!/^[a-f0-9]{64}$/.test(c.huella)||!Number.isSafeInteger(c.limite)||c.limite<1||c.limite>50||!Number.isSafeInteger(c.desde)||c.desde<1||c.desde>1999||c.desde%c.limite!==0||codificar(c)!==query.cursor)throw fallo("Cursor de historial inválido",400);
  return{limite:c.limite,desde:c.desde,cursor:c};
 }
 const limite=query.limite===undefined?20:query.limite;
 if(typeof limite!=="number"&&!(typeof limite==="string"&&/^(?:[1-9]|[1-4][0-9]|50)$/.test(limite))||!Number.isSafeInteger(Number(limite))||Number(limite)<1||Number(limite)>50)throw fallo("Límite de historial inválido",400);
 return{limite:Number(limite),desde:0,cursor:null};
}

function proyectar(p,eventos,resoluciones,query={}){
 const u=String(p.usuarioId),id=String(p._id),o=opciones(query,u,id);
 S.verificar(eventos,p);R.verificar(resoluciones,p,eventos);
 const ev=new Map(),rs=new Map();
 for(const e of eventos){if(ev.has(e.solicitudId))throw fallo("Clave de retiro duplicada en historial");ev.set(e.solicitudId,e);}
 for(const r of resoluciones){if(rs.has(r.solicitudId))throw fallo("Clave de resolución duplicada en historial");rs.set(r.solicitudId,r);}
 const items=[];
 function agregar(e,r){
  const solicitud=r?r.solicitud:R.solicitud(id,e.tipo,{confirmacion:true,solicitudId:e.solicitudId,...(e.tipo==="RESTAURACION"?{retiroHash:e.referencia}:{})});
  R.validarSolicitud(solicitud,id);
  const fecha=new Date((r||e).fecha);
  if(!Number.isFinite(+fecha)||+fecha>Date.now())throw fallo("Fecha de historial no verificable");
  items.push({origen:r?"RESOLUCION":"RETIRO_LEGADO",solicitudId:solicitud.cuerpo.solicitudId,
   resultado:r?.resultado==="CERRADA"?"CERRADA_SIN_APLICAR":"APLICADA",fecha:fecha.toISOString(),
   secuenciaResolucion:r?.secuencia||null,hashResolucion:r?.hashActual||null,
   secuenciaRetiro:e?.secuencia||null,solicitud:JSON.parse(JSON.stringify(solicitud)),
   recibo:r?.resultado==="CERRADA"?R.recibo(r):S.recibo(e)});
 }
 for(const r of resoluciones)agregar(r.resultado==="APLICADA"?ev.get(r.solicitudId):null,r);
 for(const e of eventos)if(!rs.has(e.solicitudId))agregar(e,null);
 items.sort((a,b)=>a.fecha.localeCompare(b.fecha)||(a.origen===b.origen?0:a.origen==="RETIRO_LEGADO"?-1:1)||(a.secuenciaResolucion||a.secuenciaRetiro)-(b.secuenciaResolucion||b.secuenciaRetiro));
 const huella=crypto.createHash("sha256").update(JSON.stringify({dominio:DOMINIO,usuarioId:u,prestamoId:id,retiroRevision:p.retiroRevision||0,retiroHash:p.retiroHash||GENESIS,resolucionRevision:p.resolucionRetiroRevision||0,resolucionHash:p.resolucionRetiroHash||GENESIS,total:items.length})).digest("hex");
 if(o.cursor&&(o.cursor.huella!==huella||o.desde>=items.length))throw fallo("El historial cambió; vuelve a consultar desde la primera página");
 const hasta=Math.min(o.desde+o.limite,items.length),siguiente=hasta<items.length?codificar({version:1,dominio:DOMINIO,usuarioId:u,prestamoId:id,huella,desde:hasta,limite:o.limite}):null;
 return{version:1,usuarioId:u,prestamoId:id,entradas:items.slice(o.desde,hasta),total:items.length,limite:o.limite,pagina:o.desde/o.limite+1,siguiente,huella,
  soloLectura:true,certificaEstadoActual:false,certificaHistoriaCompleta:false,afectaCaja:false,autorizaGasto:false};
}

async function listar(usuarioId,prestamoId,query={}){
 if(!mongoose.isObjectIdOrHexString(usuarioId)||!mongoose.isObjectIdOrHexString(prestamoId))throw fallo("Identificador de historial inválido",400);
 const u=String(usuarioId).toLowerCase(),id=String(prestamoId).toLowerCase();opciones(query,u,id);
 await S.exigirIndices();await R.exigirIndices();
 const session=await mongoose.startSession();
 try{return await session.withTransaction(async()=>{
  const p=await P.findOne({_id:id,usuarioId:u,direccion:"POR_PAGAR"}).maxTimeMS(5000).session(session).lean();
  if(!p)throw fallo("Deuda no encontrada",404);
  const eventos=await E.find({usuarioId:u,prestamoId:id}).select("+auditoriaContexto").sort({secuencia:1}).limit(1001).maxTimeMS(5000).session(session).lean();
  const resoluciones=await M.find({usuarioId:u,prestamoId:id}).select("+auditoriaContexto").sort({secuencia:1}).limit(1001).maxTimeMS(5000).session(session).lean();
  return proyectar(p,eventos,resoluciones,query);
 },{readConcern:{level:"snapshot"},readPreference:"primary"});}finally{await session.endSession();}
}
module.exports={opciones,proyectar,listar};
