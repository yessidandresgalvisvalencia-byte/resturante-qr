"use strict";
const mongoose=require("mongoose");
const {Schema}=mongoose;
const HEX=/^[a-f0-9]{64}$/;
const MONEY=/^(0|[1-9][0-9]*)$/;
const SIGNED=/^-?(0|[1-9][0-9]*)$/;
// El evento es evidencia append-only, NO autorización para ejecutar una
// reparación ni sustituto del asiento original y de un control ACID.
const schema=new Schema({
 actorId:{type:Schema.Types.ObjectId,required:true},
 usuarioId:{type:Schema.Types.ObjectId,required:true},
 origenId:{type:Schema.Types.ObjectId,required:true},
 reservaId:{type:Schema.Types.ObjectId,required:true},
 periodoInicio:{type:Date,required:true},
 tipo:{type:String,required:true,enum:["RECONCILIACION_RESERVA"]},
 version:{type:Number,required:true,enum:[1]},
 idempotencyHash:{type:String,required:true,match:HEX},
 huellaEstadoPrevio:{type:String,required:true,match:HEX},
 huellaDiagnostico:{type:String,required:true,match:HEX},
 importeAnteriorMinor:{type:String,required:true,match:MONEY},
 importeNuevoMinor:{type:String,required:true,match:MONEY},
 deltaMinor:{type:String,required:true,match:SIGNED},
 fecha:{type:Date,required:true},
 hashEvento:{type:String,required:true,match:HEX}
},{collection:"fin_eventos_reconciliacion_reservas_v1",
 timestamps:false,versionKey:false,strict:"throw"});
schema.index({usuarioId:1,idempotencyHash:1},{unique:true,
 name:"fp_reconciliacion_reservas_idempotencia_v1"});
schema.index({usuarioId:1,origenId:1,periodoInicio:1,fecha:1},
 {name:"fp_reconciliacion_reservas_historial_v1"});
function denegar(){throw new Error("RECONCILIACION_RESERVAS_APPEND_ONLY: modificación prohibida");}
schema.pre("save",function(){if(!this.isNew)denegar();});
for(const op of ["updateOne","updateMany","findOneAndUpdate","replaceOne",
 "findOneAndReplace","deleteOne","deleteMany","findOneAndDelete"]){
 schema.pre(op,{query:true,document:false},denegar);
}
schema.pre("deleteOne",{query:false,document:true},denegar);
module.exports=mongoose.models.EventoReconciliacionReservaPersonal||
 mongoose.model("EventoReconciliacionReservaPersonal",schema);
