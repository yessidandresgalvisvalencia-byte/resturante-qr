const mongoose = require("mongoose");

const usuarioSchema = new mongoose.Schema({
  restauranteId: {
    type: String,
    required: true
  },
  sedeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Sede",
    default: null
  },
  nombre: {
    type: String,
    required: true
  },
  usuario: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  rol: {
    type: String,
    enum: ["admin_general", "admin_sede", "mesero"],
    default: "mesero"
  },
  estado: {
    type: String,
    enum: ["activo", "inactivo"],
    default: "activo"
  }
}, { timestamps: true });

module.exports = mongoose.model("Usuario", usuarioSchema);