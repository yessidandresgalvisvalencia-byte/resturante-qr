function prepararRegistroFacial(empleado) {
  return {
    faceRegistrada: Boolean(empleado.fotoBase),
    fechaRegistroFacial: new Date(),
    proveedorIA: "GRUK_AI",
    estadoFacial: empleado.fotoBase ? "registrado" : "pendiente"
  };
}

module.exports = {
  prepararRegistroFacial
};