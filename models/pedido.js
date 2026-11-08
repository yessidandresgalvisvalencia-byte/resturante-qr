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
  if (this.offlineEventId === undefined || this.offlineEventId === null) return;
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
     if (offlineIdentityFields.has(operator)) return true;
     if (operator === "$rename" && value && typeof value === "object") {
       if (Object.values(value).some(target => offlineIdentityFields.has(target))) return true;
     }
     if (operator.startsWith("$") && value && typeof value === "object") {
       return Object.keys(value).some(field => offlineIdentityFields.has(field.split(".")[0]));
     }
     return false;
   });
 }
 for (const operation of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace"]) {
   pedidoSchema.pre(operation, function guardOfflineIdentityQueryUpdate() {
     if (operation === "replaceOne" || operation === "findOneAndReplace" || touchesOfflineIdentity(this.getUpdate())) {
       throw new Error("Offline tenant identity cannot be changed through query updates; use validated document creation");
     }
   });
 }

module.exports = mongoose.model("Pedido", pedidoSchema)