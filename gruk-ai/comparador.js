function compararRostroBasico({ selfie, empleados }) {
  if (!selfie || !empleados || empleados.length === 0) {
    return {
      ok: false,
      mensaje: "No hay datos suficientes para comparar."
    };
  }

  return {
    ok: false,
    requiereSeleccionManual: true,
    empleados: empleados.map(e => ({
      _id: e._id,
      nombre: e.nombre,
      cargo: e.cargo,
      area: e.area,
      fotoBase: e.fotoBase
    })),
    mensaje:
      "GRUK recibió la selfie como evidencia. Selecciona tu perfil mientras se activa el reconocimiento facial automático."
  };
}

module.exports = {
  compararRostroBasico
};