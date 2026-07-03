const mongoose = require("mongoose");

const IngredienteRecetaSchema = new mongoose.Schema({
  inventarioId: String,
  nombre: String,
  categoria: String,
  cantidad: Number,
  unidad: String,
  costoUnitarioInventario: Number,
  unidadInventario: String,
  costoTotal: Number
}, { _id: false });

const RecetaSchema = new mongoose.Schema({
  restaurantId: {
    type: String,
    required: true
  },

  codigo: String,
  nombre: {
    type: String,
    required: true
  },

  categoria: String,
  porciones: Number,
  tiempo: Number,
  responsable: String,
  precioVenta: Number,
  observaciones: String,

  ingredientes: [IngredienteRecetaSchema],

  materiaPrima: Number,
  manoObra: Number,
  cis: Number,
  costoTotal: Number,
  costoPorPorcion: Number,
  margenBruto: Number,

  porcentajeMateriaPrima: Number,
  porcentajeManoObra: Number,
  porcentajeCIS: Number,

  activa: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Receta", RecetaSchema);