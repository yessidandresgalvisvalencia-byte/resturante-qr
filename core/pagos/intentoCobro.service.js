"use strict";
const crypto=require("crypto");
const Intento=require("../../models/IntentoCobroSuscripcion");
function periodoMensual(fecha=new Date()){return fecha.toISOString().slice(0,7);}
function referenciaSegura(restaurantId,periodo){const digest=crypto.createHash("sha256").update(String(restaurantId)).digest("hex").slice(0,16);return "renovacion_"+periodo.replace("-","")+"_"+digest;}
async function obtenerOCrearIntento({restaurante,amountInCents,currency="COP",fecha=new Date()}){const periodo=periodoMensual(fecha);const reference=referenciaSegura(restaurante.restaurantId,periodo);try{return await Intento.findOneAndUpdate({restaurantId:restaurante.restaurantId,periodo},{$setOnInsert:{empresaId:restaurante.empresaId||null,restaurantId:restaurante.restaurantId,periodo,reference,amountInCents,currency,estado:"CREADO"}},{new:true,upsert:true,setDefaultsOnInsert:true});}catch(e){if(e?.code===11000)return Intento.findOne({restaurantId:restaurante.restaurantId,periodo});throw e;}}
async function adquirirDerechoEnvio(intentoId,fecha=new Date()){return Intento.findOneAndUpdate({_id:intentoId,estado:"CREADO",transactionId:""},{$set:{estado:"ENVIANDO",inicioEnvioAt:fecha,ultimoError:""}},{new:true});}
module.exports={periodoMensual,referenciaSegura,obtenerOCrearIntento,adquirirDerechoEnvio};