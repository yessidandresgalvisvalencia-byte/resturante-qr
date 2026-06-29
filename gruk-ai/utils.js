function limpiarBase64(imagen) {
  if (!imagen) return "";

  if (imagen.includes(",")) {
    return imagen.split(",")[1];
  }

  return imagen;
}

function generarCodigoVerificacion() {
  return (
    "GRUK-AI-" +
    Math.random().toString(36).substring(2, 10).toUpperCase() +
    "-" +
    Date.now()
  );
}

module.exports = {
  limpiarBase64,
  generarCodigoVerificacion
};