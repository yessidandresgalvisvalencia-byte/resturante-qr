const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({
  restaurantId: { type: String, required: true, unique: true },
  usuario: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

module.exports = mongoose.model("Admin", adminSchema);
const paramsLogo = new URLSearchParams(window.location.search);
const restaurantIdLogo = paramsLogo.get("restaurantId");

async function cargarLogoRestaurante() {
  if (!restaurantIdLogo) return;

  const res = await fetch(`/api/restaurants/${restaurantIdLogo}`);
  const data = await res.json();

  if (data.ok && data.restaurante.logoUrl) {
    const logo = document.getElementById("logoRestaurante");

    if (logo) {
      logo.src = data.restaurante.logoUrl;
    }

    document.body.style.setProperty(
      "--fondo-restaurante",
      `url(${data.restaurante.logoUrl})`
    );
  }
}

cargarLogoRestaurante();