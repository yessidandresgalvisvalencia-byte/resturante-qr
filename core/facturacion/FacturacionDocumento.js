"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({
 empresaId:{type:mongoose.Schema.Types.ObjectId,ref:"Empresa",required:true,index:true},
 sedeId:{type:mongoose.Schema.Types.ObjectId,ref:"Sede",default:null,index:true},
 ventaId:{type:mongoose.Schema.Types.ObjectId,ref:"Venta",required:true,index:true},
 tipoDocumento:{type:String,enum:["FACTURA_VENTA","NOTA_CREDITO","NOTA_DEBITO"],default:"FACTURA_VENTA",required:true},
 estado:{type:String,enum:["BORRADOR","PENDIENTE_DATOS","LISTA_PARA_EMITIR","ENVIANDO","VALIDADA","RECHAZADA","ERROR"],default:"BORRADOR",index:true},
 proveedor:{type:String,default:"NO_CONFIGURADO"},
 proveedorDocumentoId:{type:String,default:null},
 numero:{type:String,default:null},cufe:{type:String,default:null},
 faltantes:{type:[String],default:[]},
 snapshot:{type:mongoose.Schema.Types.Mixed,default:{}},
 respuestaProveedor:{type:mongoose.Schema.Types.Mixed,default:null},
 intentos:{type:Number,default:0,min:0},
 ultimoError:{type:String,default:null},
 createdBy:{type:mongoose.Schema.Types.ObjectId,ref:"Usuario",default:null},
 deletedAt:{type:Date,default:null,index:true}
},{timestamps:true,collection:"facturacion_documentos"});
schema.index({empresaId:1,ventaId:1,tipoDocumento:1},{unique:true,partialFilterExpression:{deletedAt:null}});
module.exports=mongoose.models.FacturacionDocumento||mongoose.model("FacturacionDocumento",schema);