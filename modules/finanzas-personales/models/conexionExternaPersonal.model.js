"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({
 usuarioId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
 proveedor:{type:String,enum:["GOOGLE_GMAIL"],required:true},
 tokenCifrado:{ciphertext:{type:String,required:true,select:false},iv:{type:String,required:true,select:false},tag:{type:String,required:true,select:false},keyVersion:{type:Number,required:true,select:false}},
 scope:{type:String,enum:["https://www.googleapis.com/auth/gmail.readonly"],required:true},
 expiraEn:{type:Date,required:true},
 estado:{type:String,enum:["ACTIVA","REVOCADA"],default:"ACTIVA"},
 ultimaSincronizacion:{type:Date,default:null}
},{timestamps:true,collection:"fin_conexiones_externas_personales"});
schema.index({usuarioId:1,proveedor:1},{unique:true});
module.exports=mongoose.models.ConexionExternaPersonal||mongoose.model("ConexionExternaPersonal",schema);
