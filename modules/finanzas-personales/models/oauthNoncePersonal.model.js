"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({
 usuarioId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
 proveedor:{type:String,enum:["GOOGLE_GMAIL"],required:true},
 nonceHash:{type:String,required:true,match:/^[a-f0-9]{64}$/},
 expiraEn:{type:Date,required:true},
 consumidoEn:{type:Date,default:null}
},{timestamps:true,collection:"fin_oauth_nonces_personales"});
schema.index({nonceHash:1},{unique:true});
schema.index({expiraEn:1},{expireAfterSeconds:0});
module.exports=mongoose.models.OAuthNoncePersonal||mongoose.model("OAuthNoncePersonal",schema);
