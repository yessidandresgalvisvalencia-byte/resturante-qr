"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({
 usuarioId:{type:mongoose.Schema.Types.ObjectId,ref:"Usuario",required:true,index:true},
 version:{type:Number,required:true,enum:[1,2],default:1},
 accion:{type:String,required:true,trim:true},
 autorizada:{type:Boolean,required:true},
 irreversible:{type:Boolean,required:true},
 motivos:{type:[String],default:[]},
 verdades:{type:[mongoose.Schema.Types.Mixed],default:[]},
 actorId:{type:String,default:null},
 corte:{type:Date,required:true,index:true},
 idempotencyKey:{type:String,required:true,trim:true},
 requestFingerprint:{type:String,default:null,match:/^[a-f0-9]{64}$/},
 hashAlgoritmo:{type:String,enum:["SHA-256"],required:true},
 hash:{type:String,required:true,match:/^[a-f0-9]{64}$/},
 previousHash:{type:String,default:null,match:/^[a-f0-9]{64}$/},
 secuencia:{type:Number,default:null,min:1}
},{timestamps:true,versionKey:false});
schema.index({usuarioId:1,idempotencyKey:1},{unique:true});
schema.index({usuarioId:1,hash:1},{unique:true});
schema.index({usuarioId:1,secuencia:1},{unique:true,partialFilterExpression:{secuencia:{$type:"number"}}});
// Defensa en profundidad: el modelo de aplicación solo permite INSERT.
// Los permisos de base de datos deben prohibir UPDATE/DELETE por separado.
function prohibirMutacion(){
 const error=new Error("DECISION_PROOF_APPEND_ONLY");
 error.code="DECISION_PROOF_APPEND_ONLY";
 throw error;
}
for(const operacion of [
 "updateOne","updateMany","replaceOne","findOneAndUpdate",
 "findOneAndReplace","deleteOne","deleteMany","findOneAndDelete"
]){
 schema.pre(operacion,prohibirMutacion);
}
schema.pre("save",function(){
 if(!this.isNew)prohibirMutacion();
});
// Se bloquea bulkWrite completo: incluso lotes mixtos podrían modificar pruebas.
schema.pre("bulkWrite",prohibirMutacion);
module.exports=mongoose.models.DecisionProofPersonal||mongoose.model("DecisionProofPersonal",schema);
