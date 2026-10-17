"use strict";
const mongoose = require("mongoose");
// Ledger V81 independiente del ledger histórico. Solo nuevos eventos; nunca migrar por escritura implícita.
const schema = new mongoose.Schema({
 usuarioId: {type: mongoose.Schema.Types.ObjectId, required: true, immutable: true},
 eventId: {type: String, required: true, immutable: true},
 version: {type: Number, required: true, min: 1, immutable: true, validate: Number.isSafeInteger},
 tipo: {type: String, required: true, immutable: true, enum: ["INGRESO","GASTO","CORRECCION","ANULACION"]},
 montoCentavos: {type: String, required: true, immutable: true, match: /^\d+$/},
 fechaContable: {type: String, required: true, immutable: true, match: /^\d{4}-\d{2}-\d{2}$/},
 timestamp: {type: String, required: true, immutable: true},
 corrigeId: {type: String, default: null, immutable: true},
 motivo: {type: String, default: null, immutable: true},
 tipoCorregido: {type: String, default: null, immutable: true},
 hashAnterior: {type: String, required: true, immutable: true, match: /^[a-f0-9]{64}$/},
 hashActual: {type: String, required: true, immutable: true, match: /^[a-f0-9]{64}$/}
}, {collection:"fin_eventos_v81",versionKey:false,strict:"throw"});
schema.index({usuarioId:1,version:1},{unique:true});
schema.index({usuarioId:1,eventId:1},{unique:true});
// Bloqueo de escrituras destructivas por consultas, documentos y operaciones masivas.\nfor(const op of ["updateOne","updateMany","findOneAndUpdate","replaceOne","findOneAndReplace","deleteOne","deleteMany","findOneAndDelete"]) {
 schema.pre(op,function(){ throw new Error("Ledger V81: operación prohibida; usa eventos compensatorios"); });
}
schema.pre("save",function() {
 if(!this.isNew)throw new Error("Ledger V81: no se permite sobrescribir eventos existentes");
});
schema.pre("bulkWrite",function() {
 throw new Error("Ledger V81: bulkWrite bloqueado; usar el servicio transaccional");
});
schema.pre("insertMany",function() {
 throw new Error("Ledger V81: insertMany bloqueado; usar el servicio transaccional");
});
module.exports=mongoose.models.FinEventoV81||mongoose.model("FinEventoV81",schema);
