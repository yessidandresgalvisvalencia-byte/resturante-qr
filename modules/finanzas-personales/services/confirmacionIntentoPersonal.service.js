"use strict";
// Verifica el contenido completo de un reintento, no solo su clave. Así una
// clave reutilizada con otro importe nunca se declara como "confirmada".
const CAMPOS=["tipo","montoMinor","moneda","concepto","categoria","subcategoria","cuenta","medioPago","contraparte","descripcion","recurrente","frecuencia","origen"];
function coincideIntento(original,esperado){
 if(!original||!esperado)return false;
 for(const campo of CAMPOS){
  if(original[campo]!==esperado[campo])return false;
 }
 const a=new Date(original.fecha),b=new Date(esperado.fecha);
 if(!Number.isFinite(a.getTime())||!Number.isFinite(b.getTime())||a.getTime()!==b.getTime())return false;
 const id=v=>v===null||v===undefined?"":String(v);
 if(id(original.recurrenteOrigenId)!==id(esperado.recurrenteOrigenId))return false;
 if(id(original.prestamoId)!==id(esperado.prestamoId))return false;
 return true;
}
async function confirmarIntento({Transaccion,usuarioId,externalIdHash,esperado}){
 if(!externalIdHash)throw Object.assign(new Error("Identificador de operación obligatorio"),{statusCode:400});
 const encontrado=await Transaccion.findOne({usuarioId,externalIdHash}).lean();
 if(!encontrado)return {confirmado:false};
 if(!coincideIntento(encontrado,esperado))
  throw Object.assign(new Error("La clave corresponde a otra operación; no se registró ningún movimiento nuevo"),{statusCode:409});
 if(encontrado.estado==="ANULADA")
  return {confirmado:false,estado:"ANULADA",existe:true};
 // Fail-closed: un estado ausente o inesperado nunca constituye prueba de pago.
 if(encontrado.estado!=="ACTIVA")
  throw Object.assign(new Error("Estado de transacción no verificable; requiere conciliación"),{statusCode:409});
 return {confirmado:true,estado:"ACTIVA",existe:true,transaccionId:encontrado._id?String(encontrado._id):null};
}
module.exports={coincideIntento,confirmarIntento};
