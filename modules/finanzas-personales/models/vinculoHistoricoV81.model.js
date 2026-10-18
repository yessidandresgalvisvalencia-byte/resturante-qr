"use strict";
const mongoose=require("mongoose");
// Evidencia separada del ledger original: solo INSERT, nunca modificación.
const schema=new mongoose.Schema({
 usuarioId:{type:mongoose.Schema.Types.ObjectId,required:true,immutable:true},
 movimientoId:{type:mongoose.Schema.Types.ObjectId,required:true,immutable:true},
 cuentaId:{type:mongoose.Schema.Types.ObjectId,required:true,immutable:true},
 evidencia:{type:String,required:true,immutable:true,maxlength:240},
 confirmadoEn:{type:Date,required:true,immutable:true,default:Date.now},
 idempotencyKeyHash:{type:String,required:true,immutable:true,match:/^[a-f0-9]{64}$/}
},{collection:"fin_vinculos_historicos_v81",versionKey:false,strict:"throw"});
schema.index({usuarioId:1,movimientoId:1},{unique:true});
schema.index({usuarioId:1,idempotencyKeyHash:1},{unique:true});
schema.index({usuarioId:1,cuentaId:1,movimientoId:1});
for(const op of ["updateOne","updateMany","findOneAndUpdate","replaceOne","findOneAndReplace","deleteOne","deleteMany","findOneAndDelete","bulkWrite"]){
 schema.pre(op,function(){throw new Error("Vínculos históricos inmutables: solo insertar");});
}
schema.pre("save",function(){if(!this.isNew)throw new Error("No se permite editar un vínculo histórico");});
module.exports=mongoose.models.FinVinculoHistoricoV81||mongoose.model("FinVinculoHistoricoV81",schema);
