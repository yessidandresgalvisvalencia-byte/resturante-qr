"use strict";
const mongoose=require("mongoose");
const {Schema}=mongoose;
const HEX=/^[a-f0-9]{64}$/;
const NONEMPTY=/^[A-Za-z0-9_-]{1,128}$/;
const moneySigned=/^-?(0|[1-9][0-9]*)$/;
const original=new Schema({
 usuarioId:{type:String,required:true,match:NONEMPTY},
 movimientoId:{type:String,required:true,match:NONEMPTY},
 tipo:{type:String,required:true,enum:["INGRESO","GASTO","PAGO_DEUDA","COBRO_PRESTAMO"]},
 impactoCaja:{type:Boolean,required:function(){return this.tipo==="PAGO_DEUDA";},default:undefined},
 montoMinor:{type:Number,required:true,validate:Number.isSafeInteger,min:1},
 concepto:{type:String,required:true,minlength:1},
 categoria:{type:String,required:true,minlength:1}
},{_id:false,strict:"throw"});
const cambios=new Schema({
 tipo:{type:String,enum:["INGRESO","GASTO","COBRO_PRESTAMO"]},
 montoMinor:{type:Number,validate:{validator:v=>v==null||Number.isSafeInteger(v)&&v>0}},
 concepto:{type:String,minlength:1},
 categoria:{type:String,minlength:1}
},{_id:false,strict:"throw"});
const schema=new Schema({
 version:{type:Number,required:true,enum:[1,2,3]},
 usuarioId:{type:String,required:true,match:NONEMPTY},
 movimientoId:{type:String,required:true,match:NONEMPTY},
 tipo:{type:String,required:true,enum:["CORRECCION","ANULACION"]},
 secuencia:{type:Number,required:true,validate:{validator:v=>Number.isSafeInteger(v)&&v>0}},
 fechaISO:{type:String,required:true,validate:{validator:v=>typeof v==="string"&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString()===v}},
 idempotencyKey:{type:String,required:true,match:NONEMPTY},
 prevHash:{type:String,required:true,match:HEX},
 hashActual:{type:String,required:true,match:HEX},
 original:{type:original,required:true},
 cambios:{type:cambios,required:true},
 deltaCajaMinor:{type:String,required:true,match:moneySigned}
},{collection:"fin_eventos_compensatorios_personales_v1",strict:"throw",versionKey:false,timestamps:false});
schema.index({usuarioId:1,idempotencyKey:1},{unique:true,name:"fp_compensacion_idempotencia_usuario_v1"});
schema.index({usuarioId:1,secuencia:1},{unique:true,name:"fp_compensacion_orden_usuario_v1"});
schema.index({usuarioId:1,movimientoId:1,secuencia:1},{name:"fp_compensacion_movimiento_v1"});
// Defensa de aplicación, NO sustituto de roles Mongo insert-only ni de garantías de transacción.
function prohibirMutacion(){throw new Error("LEDGER_PERSONAL_APPEND_ONLY: modificación o borrado prohibido");}
schema.pre("save",function(){if(!this.isNew)prohibirMutacion();});
for(const operation of ["updateOne","updateMany","findOneAndUpdate","replaceOne","findOneAndReplace",
 "deleteOne","deleteMany","findOneAndDelete","findOneAndRemove"]){
 schema.pre(operation,{query:true,document:false},prohibirMutacion);
}
schema.pre("deleteOne",{query:false,document:true},prohibirMutacion);
module.exports=mongoose.models.EventoCompensatorioPersonal||
 mongoose.model("EventoCompensatorioPersonal",schema);
