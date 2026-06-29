function compararRostroBasico({ selfie, empleados, empleadoRecordadoId }) {
  if (!selfie || !empleados || empleados.length === 0) {
    return {
      ok: false,
      mensaje: "No hay datos suficientes para comparar."
    };
  }

  if (empleadoRecordadoId) {
    const empleadoRecordado = empleados.find(e =>
      String(e._id) === String(empleadoRecordadoId)
    );

    if (empleadoRecordado) {
      return {
        ok: true,
        empleado: empleadoRecordado,
        confianza: 85,
        metodo: "empleado_recordado"
      };
    }
  }

  if (empleados.length === 1) {
    return {
      ok: true,
      empleado: empleados[0],
      confianza: 80,
      metodo: "empleado_unico"
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
      "GRUK recibió la selfie como evidencia. Selecciona tu perfil para activar el ingreso automático en este dispositivo."
  };
}

module.exports = {
  compararRostroBasico
};