"use strict";

const {
  calcularDistribucionDueno
} = require("../../core/finanzas/distribucionDueno.service");

function dinero(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function construirGuiaGanancia(calculo) {
  const estado = String(calculo?.estado || "DATOS_INSUFICIENTES");
  const utilidad = dinero(calculo?.utilidadOperacionalConfiable);
  const cajaLibre = dinero(calculo?.cajaLibreDistribuible);
  const distribuible = dinero(calculo?.montoPropuesto);

  const base = {
    estado,
    principio: "VENTAS != CAJA != UTILIDAD != DINERO_DEL_DUENO",
    cifras: {
      utilidad_operacional_confiable: utilidad,
      saldo_actual: dinero(calculo?.saldoActual),
      obligaciones_30d: dinero(calculo?.obligaciones30d),
      reservas_activas: dinero(calculo?.reservasActivas),
      reserva_minima_caja: dinero(calculo?.reservaMinimaCaja),
      caja_libre_distribuible: cajaLibre,
      monto_maximo_propuesto_dueno: distribuible
    },
    puede_retirar: estado === "DISTRIBUIBLE" && distribuible > 0,
    requiere_aprobacion: estado === "DISTRIBUIBLE" && distribuible > 0,
    advertencias: [],
    siguiente_paso: null
  };

  switch (estado) {
    case "DISTRIBUIBLE":
      base.mensaje = `La empresa presenta utilidad confiable. Con la política vigente y la caja disponible, el máximo propuesto para el dueño es ${distribuible}. No debe confundirse la utilidad total con efectivo libre para retirar.`;
      base.siguiente_paso = "Crear la propuesta de reserva de utilidad del dueño y someterla a aprobación.";
      break;
    case "POLITICA_INACTIVA":
      base.mensaje = "Existe información financiera, pero GRUK no recomendará retiros hasta que el dueño defina y active su política de distribución.";
      base.advertencias.push("No existe una política activa de distribución del dueño.");
      base.siguiente_paso = "Definir porcentaje de utilidad y reserva mínima de caja.";
      break;
    case "CIERRE_NO_CONFIABLE":
      base.mensaje = "GRUK no puede recomendar cuánto retirar porque el cierre no tiene costos suficientemente confiables.";
      base.advertencias.push("Una utilidad incompleta no puede convertirse en dinero distribuible.");
      base.siguiente_paso = "Completar costos del periodo y volver a cerrar con información confiable.";
      break;
    case "TESORERIA_NO_CONFIABLE":
    case "HORIZONTE_30D_INCOMPLETO":
      base.mensaje = "Puede existir utilidad contable, pero GRUK no puede recomendar un retiro sin conocer de forma confiable la caja y las obligaciones próximas.";
      base.advertencias.push("Utilidad no equivale a liquidez.");
      base.siguiente_paso = "Completar tesorería y obligaciones de los próximos 30 días.";
      break;
    case "SIN_UTILIDAD_DISTRIBUIBLE":
      base.mensaje = "El periodo no presenta utilidad operacional confiable positiva para distribuir al dueño.";
      base.siguiente_paso = "Proteger caja y revisar margen, costos y gastos antes de retirar dinero.";
      break;
    case "SIN_CAJA_LIBRE":
      base.mensaje = "Hay utilidad, pero la caja libre no soporta un retiro después de obligaciones, reservas y colchón mínimo.";
      base.advertencias.push("Retirar dinero ahora comprometería la política de liquidez definida.");
      base.siguiente_paso = "No retirar utilidad por ahora; recuperar caja y reevaluar.";
      break;
    default:
      base.mensaje = "GRUK todavía no tiene evidencia suficiente para recomendar un retiro.";
      base.advertencias.push("No se inventarán porcentajes ni montos.");
      base.siguiente_paso = "Completar los datos financieros faltantes y recalcular.";
  }

  return base;
}

async function recomendarGanancia({ empresaId, cierreId }) {
  const calculo = await calcularDistribucionDueno({ empresaId, cierreId });
  return {
    tipo: "GUIA_EJECUTIVA_GANANCIA",
    generadoAt: new Date(),
    recomendacion: construirGuiaGanancia(calculo),
    calculo
  };
}

module.exports = {
  construirGuiaGanancia,
  recomendarGanancia
};
