"use strict";
const mongoose=require("mongoose"),CicloActivo=require("../models/cicloActivoPersonal.model");
const Activo=require("../models/ActivoPatrimonial");
const Inversion=require("../models/InversionPatrimonial");
const Deuda=require("../models/DeudaPersonal");
const Perfil=require("../models/UsuarioPatrimonio");
async function obtener(usuarioId){
 const session=await mongoose.startSession();let resultado;
 try{await session.withTransaction(async()=>{
  // Esta vista heredada todavía no comparte todas las fuentes del panel personal.
  // No publicar un total que ignore un retiro, incluso si luego se restauró.
  if(await CicloActivo.exists({usuarioId}).session(session).maxTimeMS(5000))throw Object.assign(new Error("Vista V2 pendiente de convergencia de ciclos; consulta el patrimonio personal actualizado"),{statusCode:409});
  const activos=await Activo.find({usuarioId}).session(session).lean();
  const inversiones=await Inversion.find({usuarioId}).session(session).lean();
  const deudas=await Deuda.find({usuarioId,activa:true}).session(session).lean();
  const perfil=await Perfil.findOne({usuarioId}).session(session).lean();
 const activosMinor=activos.reduce((s,x)=>s+x.valorMinor,0);
 const inversionesMinor=inversiones.reduce((s,x)=>s+x.valorActualMinor,0);
 const deudasMinor=deudas.reduce((s,x)=>s+x.saldoMinor,0);
 resultado={moneda:"COP",activosMinor,inversionesMinor,deudasMinor,patrimonioNetoMinor:activosMinor+inversionesMinor-deudasMinor,saldoLiquidoMinor:perfil?.saldoLiquidoMinor||0,fondoEmergenciaObjetivoMeses:perfil?.fondoEmergenciaObjetivoMeses||6,fuente:"patrimonio_canonico_v2"};
 },{readConcern:{level:"snapshot"},readPreference:"primary"});return resultado;}finally{await session.endSession();}
}
module.exports={obtener};