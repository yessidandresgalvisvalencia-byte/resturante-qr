const mongoose = require("mongoose");

const empleadoLaboralSchema = new mongoose.Schema(
  {
    empresaId: { type: mongoose.Schema.Types.ObjectId, ref: "Empresa", default: null, index: true },
    sedeId: { type: mongoose.Schema.Types.ObjectId, ref: "Sede", default: null, index: true },
    restaurantId: {
      type: String,
      required: true,
      index: true
    },

    nombre: {
      type: String,
      required: true,
      trim: true
    },

    documento: {
      type: String,
      required: true,
      trim: true
    },

    cargo: {
      type: String,
      required: true,
      trim: true
    },

    area: {
      type: String,
      required: true,
      trim: true
    },

    telefono: {
      type: String,
      default: ""
    },

    correo: {
      type: String,
      default: ""
    },

    contrato: {
      type: String,
      enum: ["mensual", "por_horas", "turno", "quincenal"],
      default: "mensual"
    },

    salario: {
      type: Number,
      default: 0
    },

    valorHora: {
      type: Number,
      default: 0
    },

    fotoBase: {
      type: String,
      default: ""
    },

    activo: {
      type: Boolean,
      default: true
    },
    
    descriptorFacial: {
  type: [Number],
  default: []
},
  

    fechaIngreso: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
  

);

empleadoLaboralSchema.index({ empresaId: 1, sedeId: 1, activo: 1 });
empleadoLaboralSchema.index(
  { restaurantId: 1, documento: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "EmpleadoLaboral",
  empleadoLaboralSchema
);