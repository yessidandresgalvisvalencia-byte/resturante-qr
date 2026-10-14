"use strict";
const mongoose=require("mongoose");
// V1000 uses a separate collection to avoid altering legacy ObjectId ledgers.
const schema=new mongoose.Schema({
 id:{type:String,required:true,immutable:true},
 empresaId:{type:String,required:true,immutable:true},
 sedeId:{type:String,required:true,immutable:true},
 tipo:{type:String,required:true,enum:["CREDITO","DEBITO","AJUSTE"],immutable:true},
 montoCentavos:{type:Number,required:true,immutable:true},
 antesCentavos:{type:Number,required:true,immutable:true},
 despuesCentavos:{type:Number,required:true,immutable:true},
 actorId:{type:String,required:true,immutable:true},
 ip:{type:String,required:true,immutable:true},
 timestamp:{type:Date,required:true,immutable:true},
 hashAnterior:{type:String,required:true,immutable:true},
 hash:{type:String,required:true,immutable:true},
 deletedAt:{type:null,default:null,immutable:true},
 secuencia:{type:Number,required:true,immutable:true,min:1}
},{collection:"gruk_movimientos_ledger_v1000",strict:"throw",versionKey:false});
schema.index({empresaId:1,sedeId:1,id:1},{unique:true});
schema.index({empresaId:1,sedeId:1,secuencia:1},{unique:true});
schema.index({empresaId:1,sedeId:1,timestamp:1});
for(const op of ["updateOne","updateMany","findOneAndUpdate","replaceOne","findOneAndReplace","deleteOne","deleteMany","findOneAndDelete"]) {
 schema.pre(op,function(){throw new Error("LEDGER_APPEND_ONLY");});
}
// A loaded document must never overwrite an existing accounting entry.
schema.pre("save",function(){if(!this.isNew)throw new Error("LEDGER_APPEND_ONLY");});
// Block collection-wide bulk mutations at the model API boundary.
schema.pre("bulkWrite",function(){throw new Error("LEDGER_BULK_WRITE_PROHIBIDO");});
module.exports=mongoose.models.MovimientoLedgerV1000||mongoose.model("MovimientoLedgerV1000",schema);
