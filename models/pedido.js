const mongoose = require("mongoose")

const pedidoSchema = new mongoose.Schema({
    // Optional for legacy orders; mandatory for future offline-created orders.
    empresaId: { type: mongoose.Schema.Types.ObjectId, ref: "Empresa", default: null, index: true },
    offlineEventId: { type: String, default: undefined },
    restaurantId: {
        type: String,
        default: "rest1"
    },
    sedeId: {
  type: String,
  default: ""
},
menuItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Menu",
    default: null,
    index: true
},

productoServicioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ProductoServicio",
    default: null,
    index: true
},

clienteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Cliente",
    default: null,
    index: true
},

cantidad: {
    type: Number,
    required: true,
    default: 1,
    min: 1
},

precioUnitario: {
    type: Number,
    required: true,
    min: 0
},

valorExtraUnitario: {
    type: Number,
    default: 0,
    min: 0
},

extra: {
    type: String,
    default: "",
    trim: true
},
    mesa: {
        type: Number,
        required: true
    },
    observaciones: {
  type: String,
  default: ""
},
    producto: {
        type: String,
        required: true
    },
    categoria: {
        type: String,
        default: ""
    },
    precio: {
        type: Number,
        required: true
    },
    estado: {
        type: String,
        enum: ["pendiente", "preparando", "listo", "entregado"],
        default: "pendiente"
    },
    tiempoEstimado: {
        type: Number,
        default: 15
    },
    metodoPago: {
        type: String,
        enum: ["efectivo", "transferencia", "pse", "tarjeta"],
        default: "efectivo"
    },
    estadoPago: {
        type: String,
        enum: ["pendiente", "pagado"],
        default: "pendiente"
    }
}, {
    timestamps: true
})

// Offline retries must have a complete tenant identity. Without this guard,
// the unique index can accidentally deduplicate events under a null tenant or
// an empty site. Legacy orders without offlineEventId remain valid.
pedidoSchema.pre("validate", function validateOfflineTenantIdentity() {
  // Check modifications before the missing-ID early return: an existing offline
  // order could otherwise erase offlineEventId with document.save().
  if (!this.isNew && this.isModified("offlineEventId")) {
    this.invalidate("offlineEventId", "Offline tenant identity is immutable after creation");
  }
  if (this.offlineEventId === undefined || this.offlineEventId === null) return;
  // Existing offline orders must retain their tenant-scoped retry identity
  // even when updated through document.save(), which bypasses query hooks.
  if (!this.isNew && ["empresaId", "sedeId", "offlineEventId"].some(field => this.isModified(field))) {
    this.invalidate("offlineEventId", "Offline tenant identity is immutable after creation");
  }
  if (typeof this.offlineEventId !== "string" || !this.offlineEventId.trim() || this.offlineEventId !== this.offlineEventId.trim()) {
    this.invalidate("offlineEventId", "offlineEventId must be a non-empty string");
  }
  if (!this.empresaId) {
    this.invalidate("empresaId", "empresaId is required for offline retries");
  }
  if (typeof this.sedeId !== "string" || !this.sedeId.trim() || this.sedeId !== this.sedeId.trim()) {
    this.invalidate("sedeId", "sedeId is required for offline retries");
  }
});

// Partial unique key protects against concurrent retries without changing legacy orders.
pedidoSchema.index({ empresaId: 1, sedeId: 1, offlineEventId: 1 }, {
  unique: true,
  name: "uniq_pedido_offline_event_tenant",
  partialFilterExpression: { offlineEventId: { $type: "string" } }
});


 // Identity is immutable through query updates: document pre('validate') is not
 // invoked by updateOne/findOneAndUpdate. Keep ordinary status updates working.
 const offlineIdentityFields = new Set(["empresaId", "sedeId", "offlineEventId"]);
 function touchesOfflineIdentity(update) {
   if (!update || typeof update !== "object") return false;
   // MongoDB aggregation-pipeline updates are arrays of stages; inspect each
   // stage instead of treating numeric array indexes as update operators.
   if (Array.isArray(update)) return update.some(touchesOfflineIdentity);
   return Object.entries(update).some(([operator, value]) => {
     // Pipeline stages can replace the entire document or remove identity
     // indirectly. Neither operation is safe for immutable offline keys.
     if (["$replaceRoot", "$replaceWith", "$project"].includes(operator)) return true;
     if (offlineIdentityFields.has(operator)) return true;
     if (operator === "$unset" && (typeof value === "string" ? [value] : Array.isArray(value) ? value : []).some(field => typeof field === "string" && offlineIdentityFields.has(field.split(".")[0]))) return true;
     if (operator === "$rename" && value && typeof value === "object") {
       if (Object.entries(value).some(([source, target]) =>
         offlineIdentityFields.has(source.split(".")[0]) ||
         (typeof target === "string" && offlineIdentityFields.has(target.split(".")[0])))) return true;
     }
     if (operator.startsWith("$") && value && typeof value === "object") {
       return Object.keys(value).some(field => offlineIdentityFields.has(field.split(".")[0]));
     }
     return false;
   });
 }
 // Upsert equality filters can create an offline key indirectly, including
 // inside $and/$or clauses. Scan nested filter expressions before dispatch.
 function filterContainsOfflineEventId(filter) {
   if (!filter || typeof filter !== "object") return false;
   if (Array.isArray(filter)) return filter.some(filterContainsOfflineEventId);
   return Object.entries(filter).some(([key, value]) =>
     key.split(".")[0] === "offlineEventId" ||
     (key.startsWith("$") && filterContainsOfflineEventId(value))
   );
 }
 for (const operation of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace"]) {
   pedidoSchema.pre(operation, function guardOfflineIdentityQueryUpdate() {
     if (operation === "replaceOne" || operation === "findOneAndReplace" || touchesOfflineIdentity(this.getUpdate()) ||
         (this.getOptions().upsert && this.getFilter() && filterContainsOfflineEventId(this.getFilter()))) {
       throw new Error("Offline tenant identity cannot be changed through query updates; use validated document creation");
     }
   });
 }


 // Mongoose bulkWrite bypasses query middleware. Apply the same immutable
 // tenant identity policy to bulk updates before any operation reaches MongoDB.
 pedidoSchema.pre("bulkWrite", function guardOfflineIdentityBulkWrite(operations) {
   for (const entry of operations) {
     // Validate the tenant retry key before any unordered bulk batch is sent.
     // Otherwise a valid insert may persist alongside an invalid offline event.
     if (entry.insertOne && entry.insertOne.document) {
       const doc = entry.insertOne.document;
       if (doc.offlineEventId !== undefined && doc.offlineEventId !== null &&
           (!mongoose.isObjectIdOrHexString(doc.empresaId) || typeof doc.sedeId !== "string" || !doc.sedeId.trim() || doc.sedeId !== doc.sedeId.trim() ||
            typeof doc.offlineEventId !== "string" || !doc.offlineEventId.trim() || doc.offlineEventId !== doc.offlineEventId.trim())) {
         throw new Error("Offline tenant identity is invalid for bulk insert");
       }
     }
     if (entry.replaceOne || (entry.updateOne && (touchesOfflineIdentity(entry.updateOne.update) ||
         (entry.updateOne.upsert && entry.updateOne.filter && filterContainsOfflineEventId(entry.updateOne.filter)))) ||
         (entry.updateMany && (touchesOfflineIdentity(entry.updateMany.update) ||
         (entry.updateMany.upsert && entry.updateMany.filter && filterContainsOfflineEventId(entry.updateMany.filter))))) {
       throw new Error("Offline tenant identity cannot be changed through bulk updates; use validated document creation");
     }
   }
 });

module.exports = mongoose.model("Pedido", pedidoSchema)