"use strict";
const Activo=require("../models/ActivoPatrimonial");
const Inversion=require("../models/InversionPatrimonial");
const Deuda=require("../models/DeudaPersonal");
const Perfil=require("../models/UsuarioPatrimonio");
async function obtener(usuarioId){
 const [activos,inversiones,deudas,perfil]=await Promise.all([Activo.find({usuarioId}).lean(),Inversion.find({usuarioId}).lean(),Deuda.find({usuarioId,activa:true}).lean(),Perfil.findOne({usuarioId}).lean()]);
 const activosMinor=activos.reduce((s,x)=>s+x.valorMinor,0);
 const inversionesMinor=inversiones.reduce((s,x)=>s+x.valorActualMinor,0);
 const deudasMinor=deudas.reduce((s,x)=>s+x.saldoMinor,0);
 return{moneda:"COP",activosMinor,inversionesMinor,deudasMinor,patrimonioNetoMinor:activosMinor+inversionesMinor-deudasMinor,saldoLiquidoMinor:perfil?.saldoLiquidoMinor||0,fondoEmergenciaObjetivoMeses:perfil?.fondoEmergenciaObjetivoMeses||6,fuente:"patrimonio_canonico_v2"};
}
module.exports={obtener};