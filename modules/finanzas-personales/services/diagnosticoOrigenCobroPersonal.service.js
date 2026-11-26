"use strict";
const mongoose=require("mongoose"),P=require("../models/prestamoPersonal.model"),E=require("../models/correccionPrestamoPersonal.model"),C=require("./correccionPrestamoPersonal.service"),Clasificacion=require("./clasificacionCobroPersonal.service");
const falla=(m,c=409)=>Object.assign(new Error(m),{statusCode:c});
function describir(usuarioId,p,eventos){
 if(!p||String(p.usuarioId)!==String(usuarioId)||p.direccion!=="POR_COBRAR")throw falla("Cuenta por cobrar no encontrada",404);
 const ultimo=C.verificar(eventos,p);
 if(ultimo&&ultimo.posterior?.origenCuentaPorCobrar!==p.origenCuentaPorCobrar)throw falla("Origen actual no coincide con la última corrección auditada; conserva el historial sin repararlo automáticamente");
 const presente=Object.hasOwn(p,"origenCuentaPorCobrar"),valor=presente?p.origenCuentaPorCobrar:undefined,conocido=["PRESTAMO","TRABAJO","OTRO"].includes(valor);
 const estado=!presente?"SIN_DATO":valor===null?"DATO_NULO":!conocido?"NO_INTERPRETABLE":valor;
 const confirmacionHash=conocido?Clasificacion.confirmacionExplicita(p,eventos):null;
 return{prestamoId:String(p._id),soloLectura:true,afectaCaja:false,origen:{presente,estado,valor:conocido?valor:null},
  confirmacionAuditada:confirmacionHash!==null,confirmacionHash,correccionesVerificadas:eventos.length,ultimoHash:ultimo?.hashActual??null,
  requiereClasificacion:!["PRESTAMO","TRABAJO"].includes(valor),certificaOrigenReal:false,certificaHistorialCompleto:false,
  detalle:estado==="OTRO"?"OTRO conserva la declaración sin clasificarla como trabajo o préstamo. No registres otro cobro para resolverlo.":!["PRESTAMO","TRABAJO"].includes(estado)?"El origen no está confirmado. No se deduce de nombre, concepto, importe ni valores por defecto.":confirmacionHash?"Existe una confirmación de origen en las correcciones verificadas. Es una declaración del usuario, no prueba del origen real del dinero.":"Existe un valor guardado, sin confirmación de origen en las correcciones registradas. No prueba si fue una declaración o un valor por defecto histórico."};
}
async function consultar(usuarioId,prestamoId){
 if(!/^[a-f0-9]{24}$/i.test(String(usuarioId))||!/^[a-f0-9]{24}$/i.test(String(prestamoId)))throw falla("Identificador inválido",400);
 await C.exigirIndices();const session=await mongoose.startSession();let resultado;
 try{await session.withTransaction(async()=>{
  // lean conserva ausencia/nulo; hydrate aplicaría el default PRESTAMO a documentos antiguos.
  const p=await P.findOne({_id:prestamoId,usuarioId}).maxTimeMS(5000).session(session).lean();if(!p||p.direccion!=="POR_COBRAR")throw falla("Cuenta por cobrar no encontrada",404);
  const eventos=await E.find({usuarioId,prestamoId}).select("+auditoriaContexto").sort({secuencia:1}).limit(1001).maxTimeMS(5000).session(session).lean();resultado={...describir(usuarioId,p,eventos),versionOrigen:await require("./seleccionOrigenCobroPersonal.service").enSesion(usuarioId,p,eventos,session)};
 },{readConcern:{level:"snapshot"},readPreference:"primary"});return resultado;}finally{await session.endSession();}
}
module.exports={describir,consultar};
