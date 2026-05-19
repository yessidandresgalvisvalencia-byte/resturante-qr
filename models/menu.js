const mongoose = require("mongoose");

const extraSchema = new mongoose.Schema(
{
nombre: { type: String, default: "" },
precio: { type: Number, default: 0 }
},
{ _id: false }
);

const menuSchema = new mongoose.Schema({
restaurantId: { type: String, required: true },
id: { type: Number, required: true },
nombre: { type: String, required: true },

descripcion: { type: String, default: "" },

precio: { type: Number, required: true },
categoria: { type: String, required: true },

guarniciones: {
type: [String],
default: []
},

extras: {
type: [extraSchema],
default: []
},

imagen: { type: String, default: "" },
tiempoBase: { type: Number, default: 10 },
disponible: { type: Boolean, default: true }
});

module.exports = mongoose.models.Menu || mongoose.model("Menu", menuSchema);

