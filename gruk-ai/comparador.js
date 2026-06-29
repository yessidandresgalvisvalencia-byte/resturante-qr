const {
  obtenerDescriptorFacialGRUK,
  distanciaFacialGRUK
} = require("./faceEngine");

async function compararRostroBasico({ selfie, empleados }) {
  if (!selfie || !empleados || empleados.length === 0) {
    return {
      ok: false,
      mensaje: "No hay datos suficientes para comparar."
    };
  }

  const descriptorSelfie = await obtenerDescriptorFacialGRUK(selfie);

  if (!descriptorSelfie) {
    return {
      ok: false,
      mensaje: "No se detectó un rostro claro. Intenta con buena luz y mirando al frente."
    };
  }

  let mejorEmpleado = null;
  let mejorDistancia = Infinity;

  for (const empleado of empleados) {
    if (!empleado.descriptorFacial || !empleado.descriptorFacial.length) {
      continue;
    }

    const distancia = distanciaFacialGRUK(
      descriptorSelfie,
      empleado.descriptorFacial
    );

    if (distancia < mejorDistancia) {
      mejorDistancia = distancia;
      mejorEmpleado = empleado;
    }
  }

  if (mejorEmpleado && mejorDistancia <= 0.52) {
    return {
      ok: true,
      empleado: mejorEmpleado,
      distancia: mejorDistancia,
      confianza: Number(((1 - mejorDistancia) * 100).toFixed(2)),
      metodo: "reconocimiento_facial_real"
    };
  }

  return {
    ok: false,
    requiereSeleccionManual: false,
    mensaje: "El rostro no coincide con ningún empleado registrado.",
    distancia: mejorDistancia === Infinity ? null : mejorDistancia
  };
}

module.exports = {
  compararRostroBasico
};