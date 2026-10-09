'use strict';
const {createHash}=require('node:crypto');
const OID=/^[a-f0-9]{24}$/i;
const KEY=/^[a-zA-Z0-9_-]{16,128}$/;
function fail(code,statusCode){return Object.assign(new Error(code),{statusCode});}
function stable(v){if(Array.isArray(v))return '['+v.map(stable).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';return JSON.stringify(v);}
function digest(v){return createHash('sha256').update(stable(v)).digest('hex');}
function createPedidoService({mongoose,Pedido,Receipt,registrarEventoEnTransaccion}){
 if(!mongoose?.startSession||!Pedido?.create||!Receipt?.findOne||!Receipt?.create||typeof registrarEventoEnTransaccion!=='function')throw fail('DEPENDENCIAS_INCOMPLETAS',500);
 async function crear({restaurantId,sedeId='',empresaId,key,intent,resolverAutorizado,resolverSedeCanonica}){
  if(typeof restaurantId!=='string'||!restaurantId.trim()||restaurantId.length>128||typeof sedeId!=='string'||sedeId.length>128||!OID.test(String(empresaId||'')))throw fail('AMBITO_INVALIDO',403);
  if(!KEY.test(String(key||'')))throw fail('CLAVE_IDEMPOTENCIA_INVALIDA',400);
  if(!intent||typeof intent!=='object'||Array.isArray(intent)||typeof resolverAutorizado!=='function')throw fail('SOLICITUD_INVALIDA',400);
  const scope={restaurantId,sedeId,key};
  const intentDigest=digest({empresaId:String(empresaId).toLowerCase(),restaurantId,sedeId,intent});
  async function reconciliar(){
   const existing=await Receipt.findOne(scope).lean();
   if(!existing)return null;
   if(existing.intentDigest!==intentDigest)throw fail('CLAVE_REUTILIZADA',409);
   return {pedidoId:existing.pedidoId,replayed:true};
  }
  const existing=await reconciliar();
  if(existing)return existing;
  if(typeof resolverSedeCanonica!=='function')throw fail('RESOLVER_SEDE_CANONICA_REQUERIDO',500);
  const scopeSede=await resolverSedeCanonica({restaurantId,sedeId,empresaId});
  if(!scopeSede||!(scopeSede.sedeObjectId===null && sedeId==='' || OID.test(String(scopeSede.sedeObjectId||'')))||String(scopeSede.empresaId).toLowerCase()!==String(empresaId).toLowerCase()||scopeSede.restaurantId!==restaurantId||scopeSede.sedeIdOriginal!==sedeId)throw fail('SEDE_CANONICA_NO_AUTORIZADA',403);
  const payload=await resolverAutorizado({restaurantId,sedeId,empresaId,intent,sedeObjectId:scopeSede.sedeObjectId});
  if(!payload||payload.restaurantId!==restaurantId||payload.sedeId!==sedeId||!payload.productoServicioId||!Number.isFinite(payload.precio)||payload.precio<0)throw fail('PEDIDO_AUTORIZADO_INVALIDO',409);
  const session=await mongoose.startSession();
  let pedidoId;
  try{
   await session.withTransaction(async()=>{
    const [pedido]=await Pedido.create([payload],{session});
    pedidoId=pedido._id;
    await Receipt.create([{...scope,intentDigest,payloadDigest:digest(payload),pedidoId}],{session});
    await registrarEventoEnTransaccion({eventId:'PEDIDO_CREADO:'+String(pedidoId),empresaId,sedeId:scopeSede.sedeObjectId,eventName:'PEDIDO_CREADO',aggregateId:pedidoId,payload:{pedidoId:String(pedidoId),restaurantId,sedeId,estado:'pendiente'}},session);
   },{readConcern:{level:'snapshot'},writeConcern:{w:'majority'}});
   return {pedidoId,replayed:false};
  }catch(error){
   if(error?.code===11000||error?.hasErrorLabel?.('UnknownTransactionCommitResult')){
    const prior=await reconciliar();if(prior)return prior;
    throw fail('RESULTADO_INCIERTO_REQUIERE_CONCILIACION',503);
   }
   throw error;
  }finally{await session.endSession();}
 }
 return {crear};
}
module.exports={createPedidoService,digest};
