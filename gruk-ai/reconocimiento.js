const { compararRostroBasico } = require("./comparador");
const { generarCodigoVerificacion } = require("./utils");

async function reconocerEmpleado({
  restaurantId,
  selfie,
  empleados,
  empleadoRecordadoId
}) {
  if (!restaurantId || !selfie) {
    return {
      ok: false,
      mensaje: "Faltan datos para reconocer empleado."
    };
  }

  if (!empleados || empleados.length === 0) {
    return {
      ok: false,
      mensaje: "No hay empleados registrados para este restaurante."
    };
  }

  const resultado = await compararRostroBasico({
  selfie,
  empleados
});
  return {
    ...resultado,
    restaurantId,
    codigoVerificacion: generarCodigoVerificacion(),
    fecha: new Date()
  };
}

module.exports = {
  reconocerEmpleado
};