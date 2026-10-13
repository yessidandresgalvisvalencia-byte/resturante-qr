"use strict";
const mongoose=require("mongoose");
const {Schema}=mongoose;
const MovimientoFuenteSchema=new Schema({
 usuarioId:{type:Schema.Types.ObjectId,required:true,index:true},
 fuente:{type:String,enum:["GMAIL","BANCO_API","EXTRACTO","ANDROID"],required:true},
 cuentaFuente:{type:String,required:true,maxlength:160},
 referenciaHash:{type:String,required:true,match:/^[a-f0-9]{64}$/},
 fechaMovimiento:{type:Date,required:true},
 montoMinor:{type:Number,required:true,min:1,validate:Number.isSafeInteger},
 direccion:{type:String,enum:["ENTRADA","SALIDA"],required:true},
 moneda:{type:String,enum:["COP"],default:"COP"},
 contraparte:{type:String,default:"",maxlength:160},
 descripcion:{type:String,default:"",maxlength:500},
 estado:{type:String,enum:["DETECTADO","PENDIENTE_CONFIRMACION","CONFIRMADO","DESCARTADO"],default:"DETECTADO"},
 evidencia:{type:String,enum:["NOTIFICACION","EXTRACTO","API_BANCARIA"],required:true},
 transaccionId:{type:Schema.Types.ObjectId,default:null},
 metadata:{type:Schema.Types.Mixed,default:{}}
},{timestamps:true,strict:"throw",versionKey:false});
MovimientoFuenteSchema.index({usuarioId:1,fuente:1,cuentaFuente:1,referenciaHash:1},{unique:true,name:"uniq_movimiento_fuente_usuario"});
MovimientoFuenteSchema.index({usuarioId:1,estado:1,createdAt:-1});
module.exports=mongoose.models.MovimientoFuentePersonal||mongoose.model("MovimientoFuentePersonal",MovimientoFuenteSchema);
