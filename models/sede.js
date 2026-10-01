const mongoose = require("mongoose");

const sedeSchema = new mongoose.Schema({
  empresaId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Empresa",
  default: null,
  index: true
},
  restauranteId: {\n    type: String,\n    default: null,\n    index: true\n  },
  nombreSede: {
    type: String,
    required: true
  },
  codigoSede: {
    type: String,
    required: true,
    unique: true
  },
  direccion: {
    type: String,
    default: ""
  }
}, { timestamps: true });

module.exports = mongoose.model("Sede", sedeSchema);