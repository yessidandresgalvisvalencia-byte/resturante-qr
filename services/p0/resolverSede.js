'use strict';
const OBJECT_ID = /^[a-f0-9]{24}$/i;
function error(codigo,statusCode){return Object.assign(new Error(codigo),{codigo,statusCode});}
function crearResolverSede({Sede}){
 if(!Sede||typeof Sede.find!=='function')throw error('MODELO_SEDE_REQUERIDO',500);
 return async function resolverSede({empresaId,restaurantId,sedeId}){
  if(!OBJECT_ID.test(String(empresaId||''))||typeof restaurantId!=='string'||!restaurantId.trim())throw error('CONTEXTO_EMPRESARIAL_INVALIDO',403);
  if(typeof sedeId!=='string'||!sedeId.trim()||sedeId!==sedeId.trim()||sedeId.length>128)throw error('SEDE_EXPLICITA_REQUERIDA',400);
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
