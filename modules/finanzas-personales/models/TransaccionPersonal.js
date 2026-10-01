"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({
 usuarioId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
 tipo:{type:String,enum:["INGRESO","GASTO","PAGO_DEUDA","PRESTAMO_OTORGADO","PRESTAMO_RECIBIDO","COBRO_PRESTAMO"],required:true,index:true},
 montoMinor:{type:Number,required:true,min:1,validate:{validator:Number.isSafeInteger,message:"montoMinor debe ser entero seguro"}},
 moneda:{type:String,default:"COP",enum:["COP"],uppercase:true,trim:true},
 concepto:{type:String,required:true,trim:true,maxlength:140},
 categoria:{type:String,required:true,trim:true,maxlength:80,index:true},
 subcategoria:{type:String,trim:true,maxlength:80,default:""},
 cuenta:{type:String,trim:true,maxlength:100,default:"EFECTIVO"},
 medioPago:{type:String,enum:["EFECTIVO","DEBITO","CREDITO","TRANSFERENCIA","PSE","OTRO"],default:"EFECTIVO"},
 contraparte:{type:String,trim:true,maxlength:140,default:""},
 descripcion:{type:String,trim:true,maxlength:240,default:""},
 recurrente:{type:Boolean,default:false},
 frecuencia:{type:String,enum:["NINGUNA","DIARIA","SEMANAL","QUINCENAL","MENSUAL","ANUAL"],default:"NINGUNA"},
 fecha:{type:Date,required:true,index:true},
 origen:{type:String,enum:["MANUAL","OPEN_BANKING","PASARELA","COMPROBANTE","SISTEMA"],default:"MANUAL"},
 externalIdHash:{type:String,default:null},
 metadatosCifrados:{ciphertext:{type:String,select:false,default:null},iv:{type:String,select:false,default:null},tag:{type:String,select:false,default:null}},
 keyVersion:{type:Number,select:false,default:null}
},{timestamps:true,collection:"fin_transacciones_personales"});
schema.index({usuarioId:1,fecha:-1});schema.index({usuarioId:1,tipo:1,categoria:1,fecha:-1});
schema.index({usuarioId:1,externalIdHash:1},{unique:true,partialFilterExpression:{externalIdHash:{$type:"string"}}});
module.exports=mongoose.models.TransaccionPersonal||mongoose.model("TransaccionPersonal",schema);