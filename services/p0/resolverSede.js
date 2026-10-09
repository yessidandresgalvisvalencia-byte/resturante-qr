'use strict';
const OBJECT_ID=/^[a-f0-9]{24}$/i;
function error(codigo,statusCode){return Object.assign(new Error(codigo),{codigo,statusCode});}
function crearResolverSede({Sede,permitirSinSede=false}){
 if(!Sede||typeof Sede.find!=='function'||typeof permitirSinSede!=='boolean')throw error('CONFIGURACION_SEDE_INVALIDA',500);
 return async function resolverSede({empresaId,restaurantId,sedeId}){
  if(!OBJECT_ID.test(String(empresaId||''))||typeof restaurantId!=='string'||!restaurantId.trim())throw error('CONTEXTO_EMPRESARIAL_INVALIDO',403);
  if(typeof sedeId!=='string'||sedeId!==sedeId.trim()||sedeId.length>128)throw error('IDENTIDAD_SEDE_INVALIDA',400);
  if(!sedeId){
   if(!permitirSinSede)throw error('SEDE_EXPLICITA_REQUERIDA',400);
   const existentes=await Sede.find({empresaId,restauranteId:restaurantId}).limit(1).lean();
   if(!Array.isArray(existentes))throw error('CONSULTA_SEDE_INVALIDA',500);
   if(existentes.length)throw error('SEDE_EXPLICITA_REQUERIDA',409);
   return Object.freeze({empresaId:String(empresaId),restaurantId,sedeIdOriginal:'',sedeObjectId:null,codigoSede:null});
  }
  const selector={empresaId,restauranteId:restaurantId,$or:[{codigoSede:sedeId}]};
  if(OBJECT_ID.test(sedeId))selector.$or.push({_id:sedeId});
  const sedes=await Sede.find(selector).limit(2).lean();
  if(!Array.isArray(sedes))throw error('CONSULTA_SEDE_INVALIDA',500);
  if(!sedes.length)throw error('SEDE_NO_AUTORIZADA',403);
  if(sedes.length>1)throw error('IDENTIDAD_SEDE_AMBIGUA',409);
  const sede=sedes[0];
  if(!sede||!OBJECT_ID.test(String(sede._id||'')))throw error('SEDE_CANONICA_INVALIDA',409);
  return Object.freeze({empresaId:String(empresaId),restaurantId,sedeIdOriginal:sedeId,sedeObjectId:String(sede._id),codigoSede:String(sede.codigoSede)});
 };
}
module.exports={crearResolverSede};
