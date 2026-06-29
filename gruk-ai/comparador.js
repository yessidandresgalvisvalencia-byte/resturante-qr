const { compararCarasGRUK } = require("./rekognitionEngine");

async function compararRostroBasico({ selfie, empleados }) {
  if (!selfie || !empleados || empleados.length === 0) {
    return {
      ok: false,
      mensaje: "No hay datos suficientes para comparar."
    };
  }

  let mejorEmpleado = null;
  let mejorSimilitud = 0;

  for (const empleado of empleados) {
    if (!empleado.fotoBase) continue;

    try {
      const resultado = await compararCarasGRUK(empleado.fotoBase, selfie);
      console.log("Comparación:", empleado.nombre, resultado.similitud);

      if (resultado.similitud > mejorSimilitud) {
        mejorSimilitud = resultado.similitud;
        mejorEmpleado = empleado;
      }
    } catch (error) {
      console.error("Error comparando con", empleado.nombre, error.message);
    }
  }

 if (mejorEmpleado && mejorSimilitud >= 70) {
    return {
      ok: true,
      empleado: mejorEmpleado,
      confianza: Number(mejorSimilitud.toFixed(2)),
      metodo: "aws_rekognition"
    };
  }

  return {
    ok: false,
    requiereSeleccionManual: false,
    mensaje: "El rostro no coincide con ningún empleado registrado.",
    confianza: Number(mejorSimilitud.toFixed(2))
  };
}

module.exports = {
  compararRostroBasico
};