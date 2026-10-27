"use strict";
const mongoose=require("mongoose");
const Inventario=require("../../models/Inventario");
const Sede=require("../../models/sede");
const Restaurante=require("../../models/restaurante");
const {prepararAlta}=require("./inventarioSede.scope");

// Inserta solamente cuando la sede y el restaurante pertenecen al tenant.
// La escritura de Sede durante la transacción detecta reasignaciones concurrentes.
async function crearInventarioAutorizado({auth,body}){
 const datos=prepararAlta(auth,body||{});
 if(!datos)return null;
 if(datos.restaurantId!==undefined && datos.restaurantId!==null &&
    (typeof datos.restaurantId!=="string" || !datos.restaurantId.trim()))return null;
 const alcanceRestaurante={restaurantId:datos.restaurantId,empresaId:auth.empresaId};
 if(auth.rol==="DUEÑO"){
  // Compatibilidad: inventario general e históricos sin sede permanecen válidos.
  // Sin embargo, una sede explícita debe existir en la empresa del JWT.
  if(datos.sedeId!==undefined && datos.sedeId!==null){
   if(typeof datos.sedeId!=="string" || !mongoose.isValidObjectId(datos.sedeId))return null;
   const sede=await Sede.exists({
    _id:datos.sedeId,empresaId:auth.empresaId,
    ...(datos.restaurantId?{restauranteId:datos.restaurantId}:{})
   });
   if(!sede)return null;
  }
  if(datos.restaurantId){
   const existe=await Restaurante.exists(alcanceRestaurante);
   if(!existe)return null;
  }
  const creado=new Inventario(datos);
  await creado.save();
  return creado;
 }
 if(auth.rol!=="ADMIN_SEDE" || !datos.restaurantId)return null;
 const session=await mongoose.startSession();
 let creado=null;
 try{
  await session.withTransaction(async()=>{
   creado=null;
   const restaurante=await Restaurante.exists(alcanceRestaurante).session(session);
   if(!restaurante)return;
   const sede=await Sede.findOneAndUpdate({
    _id:auth.sedeId,empresaId:auth.empresaId,restauranteId:datos.restaurantId
   },{$inc:{authFence:1}},{new:true,session});
   if(!sede)return;
   const nuevo=new Inventario(datos);
   await nuevo.save({session});
   creado=nuevo;
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"}});
  return creado;
 }finally{
  await session.endSession();
 }
}
module.exports={crearInventarioAutorizado};
