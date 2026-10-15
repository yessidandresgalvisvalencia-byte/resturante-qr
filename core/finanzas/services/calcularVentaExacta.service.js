"use strict";

const { copToMinor } = require("./copMinorUnits.service");

const COUNT = /^[1-9][0-9]*$/;

function calcularVentaExacta({ cantidad, precioUnitarioCOP, costoUnitarioCOP, totalCOP }) {
  if (typeof cantidad !== "string" || !COUNT.test(cantidad)) {
    throw new TypeError("VENTA_CANTIDAD_INVALIDA");
  }
  const unidades = BigInt(cantidad);
  if (unidades > 1000000000n) throw new RangeError("VENTA_CANTIDAD_FUERA_DE_RANGO");
  const precio = BigInt(copToMinor(precioUnitarioCOP));
  const costo = BigInt(copToMinor(costoUnitarioCOP));
  const total = BigInt(copToMinor(totalCOP));
  const esperado = precio * unidades;
  const MAX = 999999999999999999999999n;
  if (esperado > MAX) throw new RangeError("VENTA_TOTAL_FUERA_DE_RANGO");
  if (total !== esperado) throw new Error("VENTA_TOTAL_INCONSISTENTE");
  const costoTotal = costo * unidades;
  if (costoTotal > MAX) throw new RangeError("VENTA_COSTO_FUERA_DE_RANGO");
  const utilidad = total - costoTotal;
  return {
    cantidad,
    precioUnitarioMenor: precio.toString(),
    costoUnitarioMenor: costo.toString(),
    totalMenor: total.toString(),
    costoTotalMenor: costoTotal.toString(),
    utilidadBrutaMenor: utilidad.toString()
  };
}

module.exports = { calcularVentaExacta };
