"use strict";
const mongoose=require("mongoose");
const Inventario=require("../../models/Inventario");
const Sede=require("../../models/sede");
const {sedeAutorizada}=require("./inventarioSede.scope");

// La comprobación de vínculo y la anulación se confirman en la misma transacción.
// La escritura sobre Sede fuerza conflicto si otra operación reasigna la sede
// mientras se tramita la anulación. Ante error transaccional NO reintentar a ciegas.
async function anularInventarioAutorizado({auth,id,motivo}){
 const alcance=sedeAutorizada(auth);
 if(!alcance||!auth.usuarioId)return null;
 const data={
  anulado:true,motivoAnulacion:motivo,
  usuarioAnulacion:auth.usuarioId,fechaAnulacion:new Date()
 };
 if(auth.rol==="DUEÑO"){
  return Inventario.findOneAndUpdate({_id:id,...alcance,anulado:false},{$set:data},{new:true});
 }
 if(auth.rol!=="ADMIN_SEDE")return null;
 const session=await mongoose.startSession();
 let producto=null;
 try{
  await session.withTransaction(async()=>{
   const candidato=await Inventario.findOne({_id:id,...alcance,anulado:false})
    .select("restaurantId").session(session).lean();
   if(!candidato?.restaurantId)return;
   // Ambos filtros deben coincidir en la misma instantánea transaccional.
   const sede=await Sede.findOneAndUpdate({
    _id:auth.sedeId,empresaId:auth.empresaId,restauranteId:candidato.restaurantId
   },{$inc:{authFence:1}},{new:true,session});
   if(!sede)return;
   producto=await Inventario.findOneAndUpdate({
    _id:id,...alcance,restaurantId:candidato.restaurantId,anulado:false
   },{$set:data},{new:true,session});
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"}});
  return producto;
 }finally{
  await session.endSession();
 }
}
module.exports={anularInventarioAutorizado};
