const mongoose = require("mongoose");

const empresaSchema = new mongoose.Schema(
  {
    empresaId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    nombre: {
      type: String,
      required: true,
      trim: true
    },

    tipoNegocio: {
      type: String,
      required: true,
      enum: [
        "restaurante",
        "retail",
        "servicios",
        "otro"
      ],
      default: "restaurante"
    },

    correo: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },

    estado: {
      type: String,
      enum: [
        "activa",
        "inactiva",
        "suspendida"
      ],
      default: "activa"
    },

    configuracion: {
      moneda: {
        type: String,
        default: "COP"
      },

      pais: {
        type: String,
        default: "CO"
      },

      zonaHoraria: {
        type: String,
        default: "America/Bogota"
      },

      idioma: {
        type: String,
        default: "es"
      }
    },

    modulos: {
      restaurante: {
        type: Boolean,
        default: false
      },

      inventario: {
        type: Boolean,
        default: true
      },

      finanzas: {
        type: Boolean,
        default: true
      },

      facturacion: {
        type: Boolean,
        default: false
      },

      laboral: {
        type: Boolean,
        default: false
      },

      inteligencia: {
        type: Boolean,
        default: false
      }
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Empresa", empresaSchema);