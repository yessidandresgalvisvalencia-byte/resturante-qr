"use strict";
// Proyección pura del ledger V81: no modifica eventos persistidos ni cuentas.
const TIPOS = new Set(["INGRESO", "GASTO", "CORRECCION", "ANULACION"]);
function montoValido(valor, permiteCero = false) {
  if (typeof valor !== "bigint" || valor < 0n || (!permiteCero && valor === 0n)) {
    throw new TypeError("El monto debe ser BigInt positivo en centavos");
  }
}
function proyectarLedger(eventos, usuarioId) {
  if (!Array.isArray(eventos) || typeof usuarioId !== "string" || !usuarioId) throw new TypeError("Entrada inválida");
  const registrados = new Map();
  const actuales = new Map();
  const ids = new Set();
  for (const evento of eventos) {
    if (!evento || evento.userId !== usuarioId || typeof evento.id !== "string" || !evento.id || ids.has(evento.id) || !TIPOS.has(evento.tipo)) {
      throw new TypeError("Evento duplicado, ajeno o inválido");
    }
    ids.add(evento.id);
    if (evento.tipo === "INGRESO" || evento.tipo === "GASTO") {
      montoValido(evento.montoCentavos);
      registrados.set(evento.id, evento);
      actuales.set(evento.id, { tipo: evento.tipo, montoCentavos: evento.montoCentavos });
      continue;
    }
    if (typeof evento.corrigeId !== "string" || !registrados.has(evento.corrigeId) ||
        typeof evento.motivo !== "string" || !evento.motivo.trim() || !actuales.has(evento.corrigeId)) {
      throw new TypeError("Referencia de corrección inexistente o inactiva");
    }
    if (evento.tipo === "ANULACION") {
      montoValido(evento.montoCentavos, true);
      if (evento.montoCentavos !== 0n) throw new TypeError("La anulación no debe crear importes");
      actuales.delete(evento.corrigeId);
    } else {
      montoValido(evento.montoCentavos);
      if (!["INGRESO", "GASTO"].includes(evento.tipoCorregido)) throw new TypeError("Tipo corregido inválido");
      actuales.set(evento.corrigeId, { tipo: evento.tipoCorregido, montoCentavos: evento.montoCentavos });
    }
  }
  let ingresosCentavos = 0n, gastosCentavos = 0n;
  for (const e of actuales.values()) {
    if (e.tipo === "INGRESO") ingresosCentavos += e.montoCentavos;
    else gastosCentavos += e.montoCentavos;
  }
  return Object.freeze({ ingresosCentavos, gastosCentavos, saldoCentavos: ingresosCentavos - gastosCentavos, movimientosActivos: actuales.size });
}
module.exports = { proyectarLedger };
