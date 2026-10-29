"use strict";
// Solo para la fase administrativa; nunca se invoca desde el servidor HTTP.
const fs=require("node:fs"),path=require("node:path");
function modelosPersonales(){
 const dir=path.resolve(__dirname,"../models");
 return fs.readdirSync(dir).filter(f=>f.endsWith(".js")).sort().map(f=>require(path.join(dir,f)));
}
async function provisionarMongoPersonal(db,{modelos=modelosPersonales()}={}){
 if(!db||typeof db.createCollection!=="function"||typeof db.collection!=="function")throw new TypeError("Conexión administrativa inválida");
 const nombres=new Set();
 const plan=modelos.map(modelo=>{
  const nombre=modelo?.collection?.collectionName;
  if(typeof nombre!=="string"||!nombre||nombres.has(nombre)||typeof modelo.schema?.indexes!=="function")throw new TypeError("Manifiesto de modelos personales inválido");
  nombres.add(nombre);return {nombre,indices:modelo.schema.indexes()};
 });
 if(!plan.length)throw new TypeError("Manifiesto vacío");
 let creadas=0,indicesSolicitados=0;
 for(const {nombre,indices} of plan){
  try{await db.createCollection(nombre);creadas++;}catch(e){if(e.code!==48)throw e;}
  for(const [campos,opciones] of indices){
   // createIndex es idempotente para la misma definición; un conflicto se propaga.
   // No usar syncIndexes/dropIndexes: nunca retirar índices existentes automáticamente.
   await db.collection(nombre).createIndex(campos,{...opciones});indicesSolicitados++;
  }
 }
 return {modelos:plan.length,coleccionesCreadas:creadas,indicesSolicitados};
}
module.exports={modelosPersonales,provisionarMongoPersonal};
