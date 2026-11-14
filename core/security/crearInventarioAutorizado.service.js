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
  // Inventario general o sin sede explícita: conservar el contrato legado.
  const tieneSede=datos.sedeId!==undefined && datos.sedeId!==null;
  if(!tieneSede){
   if(datos.restaurantId && !(await Restaurante.exists(alcanceRestaurante)))return null;
   const nuevo=new Inventario(datos);
   await nuevo.save();
   return nuevo;
  }
  // El dueño también necesita una valla transaccional para sedes explícitas.
  if(typeof datos.sedeId!=="string" || !mongoose.isValidObjectId(datos.sedeId))return null;
  const session=await mongoose.startSession();
  let creado=null;
  try{
   await session.withTransaction(async()=>{
    creado=null;
    if(datos.restaurantId && !(await Restaurante.exists(alcanceRestaurante).session(session)))return;
    const sede=await Sede.findOneAndUpdate({
     _id:datos.sedeId,empresaId:auth.empresaId,
     ...(datos.restaurantId?{restauranteId:datos.restaurantId}:{})
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
