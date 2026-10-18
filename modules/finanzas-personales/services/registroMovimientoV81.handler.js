"use strict";
const {randomUUID}=require("node:crypto");
const {resolverUsuarioAutorizadoV81}=require("./autorizacionV81.service");
const {anexarEventoV81}=require("./persistenciaLedgerV81.service");
const {parsearCopACentavos}=require("./dineroExactoV81.service");
function validarSolicitudV81(body){
 if(!body||typeof body!=="object"||Array.isArray(body))throw new TypeError("Solicitud inválida");
 const campos=Object.keys(body);
 if(campos.some(k=>!["id","tipo","montoCop","fechaContable","timestamp"].includes(k)))throw new TypeError("Campos no permitidos");
 if(typeof body.id!=="string"||!(/^[a-zA-Z0-9_-]{8,100}$/.test(body.id)))throw new TypeError("Idempotencia inválida");
 if(!["INGRESO","GASTO"].includes(body.tipo))throw new TypeError("Tipo inválido");
 const montoCentavos=parsearCopACentavos(body.montoCop);
 if(montoCentavos<=0n)throw new TypeError("Monto positivo obligatorio");
 if(typeof body.fechaContable!=="string"||!/^(\d{4})-(\d{2})-(\d{2})$/.test(body.fechaContable))throw new TypeError("Fecha inválida");
 const fecha=new Date(body.fechaContable+"T00:00:00Z");
 if(!Number.isFinite(fecha.getTime())||fecha.toISOString().slice(0,10)!==body.fechaContable||fecha.getTime()>Date.now())throw new TypeError("Fecha inválida o futura");
 // Exigir RFC3339 explícito con zona horaria: nunca depender del huso del servidor.
 if(typeof body.timestamp!=="string"||!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(body.timestamp))throw new TypeError("Timestamp inválido");
 const offset=body.timestamp.match(/([+-])(\d{2}):(\d{2})$/);
 if(offset && Number(offset[2])===14 && Number(offset[3])!==0)
  throw new TypeError("Desfase horario fuera del rango UTC válido");
 const partes=body.timestamp.slice(0,10).split("-").map(Number);
 const [anio,mes,dia]=partes;
 const calendario=new Date(0);
 calendario.setUTCFullYear(anio,mes-1,dia);
 if(calendario.getUTCFullYear()!==anio||calendario.getUTCMonth()!==mes-1||calendario.getUTCDate()!==dia)
  throw new TypeError("Fecha de timestamp inexistente");
 const instante=Date.parse(body.timestamp);
 if(!Number.isFinite(instante)||instante>Date.now()+60000)throw new TypeError("Timestamp inválido o futuro");
 return {id:body.id,tipo:body.tipo,montoCentavos,fechaContable:body.fechaContable,timestamp:body.timestamp};
}
function crearRegistroMovimientoV81(escribir=anexarEventoV81){
 if(typeof escribir!=="function")throw new TypeError("Servicio obligatorio");
 return async function registrarMovimientoV81(req,res){
  try{
   const usuarioId=resolverUsuarioAutorizadoV81({autenticado:req.personalAuth?.verificado===true,usuarioId:req.personalAuth?.userId});
   const datos=validarSolicitudV81(req.body);
   const evento=await escribir(usuarioId,datos);
   return res.set("Cache-Control","no-store").status(201).json({ok:true,evento:{id:evento.id,version:evento.version,tipo:evento.tipo,montoCentavos:evento.montoCentavos.toString(),hashActual:evento.hashActual}});
  }catch(e){
   const status=e.statusCode===401?401:e.statusCode===409?409:e instanceof TypeError?400:500;
   return res.status(status).json({ok:false,error:status===401?"Autenticación requerida":status===409?"Conflicto de integridad o idempotencia":status===400?"Datos del movimiento inválidos":"No fue posible registrar el movimiento"});
  }
 };
}
module.exports={validarSolicitudV81,crearRegistroMovimientoV81};
