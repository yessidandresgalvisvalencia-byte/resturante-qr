const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({
restaurantId: { type: String, required: true, unique: true },
usuario: { type: String, required: true, unique: true },
password: { type: String, required: true },
tokenVersion: { type: Number, default: 0, min: 0 }
});

module.exports =
mongoose.models.Admin ||
mongoose.model("Admin", adminSchema);