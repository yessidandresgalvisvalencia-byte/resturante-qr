"use strict";
const mongoose=require("mongoose"),Venta=require("../../models/Venta"),Empresa=require("../../models/Empresa"),Documento=require("./FacturacionDocumento"),eventBus=require("../eventos/eventBus");
const FactusProvider=require("./providers/factus.provider");
function oid(v,n){if(!mongoose.Types.ObjectId.isValid(v))throw Object.assign(new Error(n+" inválido"),{statusCode:400});return new mongoose.Types.ObjectId(String(v));}
function provider(){return new FactusProvider();}
async function prepararDesdeVenta({empresaId,ventaId,createdBy=null}){
 const eid=oid(empresaId,"empresaId"),vid=oid(ventaId,"ventaId");
 const [empresa,venta]=await Promise.all([Empresa.findById(eid).select("_id nombre correo configuracion").lean(),Venta.findOne({_id:vid,empresaId:eid,estado:"pagada"}).lean()]);
 if(!empresa)throw Object.assign(new Error("Empresa no encontrada"),{statusCode:404});if(!venta)throw Object.assign(new Error("Venta pagada no encontrada en la empresa"),{statusCode:404});
 const faltantes=[];if(!empresa.nombre)faltantes.push("EMISOR_RAZON_SOCIAL");if(!empresa.correo)faltantes.push("EMISOR_CORREO");
 // NIT, responsabilidades fiscales, resolución/prefijo y adquirente fiscal no existen todavía en el modelo canónico.
 if(!process.env.FACTUS_NUMBERING_RANGE_ID)faltantes.push("RESOLUCION_NUMERACION");
 faltantes.push("ADQUIRENTE_DATOS_FISCALES");
 const snapshot={venta:{id:String(venta._id),fecha:venta.fecha,total:venta.total,concepto:venta.concepto,cantidad:venta.cantidad,precioUnitario:venta.precioUnitario,metodoPago:venta.metodoPago},emisor:{nombre:empresa.nombre,correo:empresa.correo,pais:empresa.configuracion?.pais||"CO",moneda:empresa.configuracion?.moneda||"COP"},fiscal:{numbering_range_id:process.env.FACTUS_NUMBERING_RANGE_ID||null,customer:null,items:[]}};
 const doc=await Documento.findOneAndUpdate({empresaId:eid,ventaId:vid,tipoDocumento:"FACTURA_VENTA",deletedAt:null},{$setOnInsert:{empresaId:eid,sedeId:venta.sedeId||null,ventaId:vid,tipoDocumento:"FACTURA_VENTA",createdBy:createdBy&&mongoose.Types.ObjectId.isValid(createdBy)?new mongoose.Types.ObjectId(String(createdBy)):null},$set:{estado:faltantes.length?"PENDIENTE_DATOS":"LISTA_PARA_EMITIR",faltantes,snapshot}}, {new:true,upsert:true,setDefaultsOnInsert:true});
 eventBus.emit("FACTURA_PREPARADA",{empresaId:eid,sedeId:venta.sedeId||null,ventaId:vid,facturaId:doc._id,estado:doc.estado,faltantes:doc.faltantes});return doc.toObject();
}
async function emitir({empresaId,facturaId,createdBy}){const eid=oid(empresaId,"empresaId"),fid=oid(facturaId,"facturaId");const doc=await Documento.findOne({_id:fid,empresaId:eid,deletedAt:null});if(!doc)throw Object.assign(new Error("Factura no encontrada"),{statusCode:404});if(doc.faltantes.length)throw Object.assign(new Error("Factura incompleta: "+doc.faltantes.join(", ")),{statusCode:409});try{doc.estado="ENVIANDO";doc.intentos+=1;await doc.save();const r=await provider().emitir(doc.snapshot);doc.estado="VALIDADA";doc.proveedor="FACTUS";doc.respuestaProveedor=r.raw||r;doc.cufe=r.cufe||null;doc.numero=r.numero||null;doc.proveedorDocumentoId=r.id||null;await doc.save();eventBus.emit("FACTURA_VALIDADA",{empresaId:eid,facturaId:doc._id,ventaId:doc.ventaId,createdBy});return doc.toObject();}catch(e){doc.estado=e.code==="PROVEEDOR_NO_CONFIGURADO"?"ERROR":"RECHAZADA";doc.ultimoError=e.message;await doc.save();throw e;}}
async function listar({empresaId}){return Documento.find({empresaId:oid(empresaId,"empresaId"),deletedAt:null}).sort({createdAt:-1}).limit(100).lean();}
module.exports={prepararDesdeVenta,emitir,listar};