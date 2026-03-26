function mostrarToast(mensaje, tipo = "info") {
  let container = document.getElementById("toastContainer");

  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${tipo}`;
  toast.innerText = mensaje;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);

  sonidoNotificacion();
  vibrar();
}

function sonidoNotificacion() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = 660;
    gain.gain.value = 0.05;

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {}
}

function vibrar() {
  if (navigator.vibrate) {
    navigator.vibrate(100);
  }
}
const mongoose = require("mongoose");

const menuSchema = new mongoose.Schema({
  restaurantId: { type: String, required: true },
  id: { type: Number, required: true },
  nombre: { type: String, required: true },
  precio: { type: Number, required: true },
  categoria: { type: String, required: true },
  imagen: { type: String, default: "" },
  tiempoBase: { type: Number, default: 10 },
  disponible: { type: Boolean, default: true }
});

module.exports = mongoose.model("Menu", menuSchema);