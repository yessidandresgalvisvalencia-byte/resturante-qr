"use strict";
const mongoose=require("mongoose"),crypto=require("node:crypto");
const Recibo=require("../models/reciboCreacionPrestamoPersonal.model"),Prestamo=require("../models/prestamoPersonal.model"),Cuenta=require("../models/cuentaFinanciera.model"),Tx=require("../models/TransaccionPersonal");
const {indiceExacto}=require("../security/auditoriaIndicesMongoV81.service");
const modelos={PRESTAMO:Prestamo,CUENTA:Cuenta,TRANSACCION:Tx};
const falla=(m,c=409)=>Object.assign(new Error(m),{statusCode:c});
function canon(v){if(v instanceof Date)return v.toISOString();if(v instanceof mongoose.Types.ObjectId)return String(v);if(v===null||typeof v!=="object")return v;if(Array.isArray(v))return v.map(canon);return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])]));}
const digest=v=>crypto.createHash("sha256").update(JSON.stringify(canon(v))).digest("hex");
const huellaSolicitud=(solicitud,ruta="/prestamos")=>digest({metodo:"POST",path:ruta,cuerpo:solicitud});
function rutaRecibo(r){if(r.ruta!==undefined&&!["/prestamos","/creditos"].includes(r.ruta))throw falla("Alcance del recibo inválido");return r.ruta||"/prestamos";}
const hash=r=>digest(Object.fromEntries(["usuarioId","solicitudId","solicitudHuella","solicitud","prestamoId","fuentes","fecha",...(r.ruta===undefined?[]:["ruta"])].map(k=>[k,r[k]])));
function validarIdentidad(usuarioId,solicitudId,ruta="/prestamos"){
 const patron=ruta==="/prestamos"?/^prestamo_[A-Za-z0-9_-]{8,80}$/:ruta==="/creditos"?/^credito_[A-Za-z0-9_-]{8,80}$/:null;
 if(!patron||!mongoose.isValidObjectId(usuarioId)||typeof solicitudId!=="string"||!patron.test(solicitudId))throw falla("Identidad estable de creación inválida",400);
}
function validarSolicitud(s){
 const permitidos=["confirmacion","direccion","origenCuentaPorCobrar","contraparte","concepto","principalMinor","cuotaMinor","tasaMensualPct","fechaInicio","fechaVencimiento","cuentaId"];
 if(!s||typeof s!=="object"||Array.isArray(s)||Object.keys(s).some(k=>!permitidos.includes(k))||s.confirmacion!==true)throw falla("Confirma explícitamente los datos del préstamo",400);
 if(!["POR_COBRAR","POR_PAGAR"].includes(s.direccion)||!Number.isSafeInteger(s.principalMinor)||s.principalMinor<1||s.cuotaMinor!==undefined&&(!Number.isSafeInteger(s.cuotaMinor)||s.cuotaMinor<0)||s.tasaMensualPct!==undefined&&(typeof s.tasaMensualPct!=="number"||!Number.isFinite(s.tasaMensualPct)||s.tasaMensualPct<0||s.tasaMensualPct>100))throw falla("Los importes deben ser enteros exactos positivos y la tasa válida",422);
 const texto=(x,max)=>typeof x==="string"&&x.trim().length>0&&x.length<=max;
 if(!texto(s.contraparte,140)||s.concepto!==undefined&&!texto(s.concepto,160)||s.origenCuentaPorCobrar!==undefined&&!["PRESTAMO","TRABAJO","OTRO"].includes(s.origenCuentaPorCobrar))throw falla("Revisa persona, concepto y origen del préstamo",422);
 const fecha=v=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(+new Date(v))&&new Date(v).toISOString()===v;
 if(!fecha(s.fechaInicio)||+new Date(s.fechaInicio)>Date.now()||s.fechaVencimiento!=null&&(!fecha(s.fechaVencimiento)||s.fechaVencimiento<s.fechaInicio))throw falla("La fecha del hecho debe ser válida y no futura; revisa el vencimiento",422);
 if(s.cuentaId!=null&&(typeof s.cuentaId!=="string"||! /^[a-f0-9]{24}$/i.test(s.cuentaId)))throw falla("Cuenta inválida",400);
 if(s.cuentaId&&s.direccion==="POR_COBRAR"&&(s.origenCuentaPorCobrar||"PRESTAMO")!=="PRESTAMO")throw falla("Un trabajo por cobrar no registra salida de caja",422);
 const {confirmacion,...d}=s;return{...d,origenCuentaPorCobrar:s.origenCuentaPorCobrar||"PRESTAMO",concepto:s.concepto||"Préstamo",fechaInicio:new Date(s.fechaInicio),fechaVencimiento:s.fechaVencimiento?new Date(s.fechaVencimiento):null};
}
function validarCredito(s){
 const permitidos=["confirmacion","nombre","contraparte","saldo","cuotaMensual","mesesRestantes","tasaMensualPct","fechaSaldo","fechaProximoPago","periodicidadConfirmada"];
 if(!s||typeof s!=="object"||Array.isArray(s)||Object.keys(s).some(k=>!permitidos.includes(k))||s.confirmacion!==true||s.periodicidadConfirmada!==true)throw falla("Confirma el saldo declarado y el calendario mensual",400);
 if(typeof s.nombre!=="string"||!s.nombre.trim()||s.nombre.length>100||!Number.isSafeInteger(s.cuotaMensual)||s.cuotaMensual<1||!Number.isSafeInteger(s.mesesRestantes)||s.mesesRestantes<1||s.mesesRestantes>360)throw falla("Revisa nombre, cuota mensual exacta y cuotas restantes",422);
 const datos=validarSolicitud({confirmacion:true,direccion:"POR_PAGAR",origenCuentaPorCobrar:"PRESTAMO",contraparte:s.contraparte,concepto:s.nombre,principalMinor:s.saldo,cuotaMinor:s.cuotaMensual,fechaInicio:s.fechaSaldo,fechaVencimiento:null,...(s.tasaMensualPct===undefined?{}:{tasaMensualPct:s.tasaMensualPct})});
 if(s.fechaProximoPago!=null&&(typeof s.fechaProximoPago!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s.fechaProximoPago)||!Number.isFinite(+new Date(s.fechaProximoPago))||new Date(s.fechaProximoPago).toISOString()!==s.fechaProximoPago))throw falla("La fecha del próximo pago requiere revisión",422);
 return{...datos,numeroCuotas:s.mesesRestantes,periodicidad:"MENSUAL",periodicidadConfirmada:true,fechaVencimiento:s.fechaProximoPago?new Date(s.fechaProximoPago):null};
}
async function exigirIndices(){let indices;try{indices=await Recibo.collection.indexes();}catch{throw falla("Índices de creación no disponibles",503);}if(!indiceExacto(indices,["usuarioId","solicitudId"])||!indiceExacto(indices,["usuarioId","prestamoId"]))throw falla("Índices de creación no verificados",503);}
async function leer(modelo,id,usuarioId,session){return modelos[modelo].collection.findOne({_id:new mongoose.Types.ObjectId(String(id)),usuarioId:new mongoose.Types.ObjectId(String(usuarioId))},{session,maxTimeMS:5000});}
function verificar(r){
 if(!r||r.hashActual!==hash(r)||r.solicitudHuella!==huellaSolicitud(r.solicitud,rutaRecibo(r))||!Array.isArray(r.fuentes)||r.fuentes.length<1||r.fuentes.length>3)throw falla("Recibo de creación no verificable");
 const vistos=new Set();for(const f of r.fuentes){const key=f.modelo+":"+f.id;if(!modelos[f.modelo]||!mongoose.isValidObjectId(f.id)||vistos.has(key)||String(f.original?._id)!==String(f.id)||String(f.original?.usuarioId)!==String(r.usuarioId)||f.hash!==digest(f.original))throw falla("Fuente de creación no verificable");vistos.add(key);}
 if(!vistos.has("PRESTAMO:"+r.prestamoId)||r.fuentes.filter(f=>f.modelo==="PRESTAMO").length!==1)throw falla("Préstamo original ausente");
 return r;
}
async function verificarFuentes(r,session){verificar(r);for(const f of r.fuentes){const actual=await leer(f.modelo,f.id,r.usuarioId,session);if(!actual||f.modelo==="TRANSACCION"&&digest(actual)!==f.hash)throw falla("Las fuentes de creación requieren revisión");}return r;}
function resumen(r){return{confirmado:true,solicitudId:r.solicitudId,solicitudHuella:r.solicitudHuella,prestamoId:String(r.prestamoId),hash:r.hashActual,ruta:rutaRecibo(r),metodo:"POST",certificaEstadoActual:false};}
function resultado(r,duplicado){return{prestamo:r.fuentes.find(f=>f.modelo==="PRESTAMO").original,recibo:resumen(r),duplicado};}
const buscar=(usuarioId,solicitudId,session)=>Recibo.findOne({usuarioId,solicitudId}).session(session).maxTimeMS(5000).lean();
async function crearEnRuta(usuarioId,solicitudId,solicitud,ruta){
 validarIdentidad(usuarioId,solicitudId,ruta);const datos=ruta==="/creditos"?validarCredito(solicitud):validarSolicitud(solicitud),huella=huellaSolicitud(solicitud,ruta);await exigirIndices();const session=await mongoose.startSession();let salida;
 try{await session.withTransaction(async()=>{
  const previo=await buscar(usuarioId,solicitudId,session);if(previo){if(rutaRecibo(previo)!==ruta||previo.solicitudHuella!==huella)throw falla("La clave identifica otros datos; conserva la solicitud anterior");await verificarFuentes(previo,session);salida=resultado(previo,true);return;}
  const {prestamo,transaccionId}=await require("./patrimonioPersonal.service").crearPrestamo(usuarioId,datos,{session});
  const refs=[{modelo:"PRESTAMO",id:prestamo._id}];if(datos.cuentaId)refs.push({modelo:"CUENTA",id:datos.cuentaId},{modelo:"TRANSACCION",id:transaccionId});
  const fuentes=[];for(const f of refs){const original=await leer(f.modelo,f.id,usuarioId,session);if(!original)throw falla("Fuente de creación ausente");fuentes.push({...f,original:canon(original),hash:digest(original)});}
  const r={...(ruta==="/creditos"?{ruta}:{}),usuarioId,solicitudId,solicitud:canon(solicitud),solicitudHuella:huella,prestamoId:prestamo._id,fuentes,fecha:new Date()};r.hashActual=hash(r);verificar(r);await Recibo.create([r],{session});salida=resultado(r,false);
 },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},readPreference:"primary"});return salida;
 }catch(e){if(e.code===11000)throw falla("Creación concurrente; consulta su confirmación antes de reintentar");throw e;}finally{await session.endSession();}
}
const crear=(usuarioId,solicitudId,solicitud)=>crearEnRuta(usuarioId,solicitudId,solicitud,"/prestamos");
const crearCredito=(usuarioId,solicitudId,solicitud)=>crearEnRuta(usuarioId,solicitudId,solicitud,"/creditos");
async function consultar(usuarioId,solicitudId,ruta="/prestamos"){validarIdentidad(usuarioId,solicitudId,ruta);await exigirIndices();const session=await mongoose.startSession();let salida;try{await session.withTransaction(async()=>{const r=await buscar(usuarioId,solicitudId,session);if(!r||rutaRecibo(r)!==ruta)throw falla("No hay recibo verificable de esa creación; sigue sin confirmar",404);await verificarFuentes(r,session);salida=resumen(r);},{readConcern:{level:"snapshot"},readPreference:"primary"});return salida;}finally{await session.endSession();}}
module.exports={crear,crearCredito,validarCredito,consultar,exigirIndices,validarSolicitud,validarIdentidad,huellaSolicitud,hash,verificar,resumen};
