"use strict";

const mongoose = require("mongoose");
const Empresa = require("../../models/Empresa");
const Inventario = require("../../models/Inventario");
const { obtenerResumenVentas } = require("../../core/finanzas/finanzas.service");

const KPI_DIRECCION = Object.freeze({
  margen_bruto_confiable: "MAYOR_ES_MEJOR",
  cobertura_costo_porcentaje: "MAYOR_ES_MEJOR",
  ticket_promedio: "MAYOR_ES_MEJOR",
  porcentaje_items_agotados: "MENOR_ES_MEJOR",
  cac: "MENOR_ES_MEJOR",
  configuracion_core: "MAYOR_ES_MEJOR"
});

function periodoActualUTC() {
  const ahora = new Date();
  return {
    desde: new Date(Date.UTC(
      ahora.getUTCFullYear(),
      ahora.getUTCMonth(),
      1,
      0,
      0,
      0,
      0
    )),
    hasta: new Date(Date.UTC(
      ahora.getUTCFullYear(),
      ahora.getUTCMonth() + 1,
      1,
      0,
      0,
      0,
      0
    ))
  };
}

function validarEmpresaId(empresaId) {
  if (!mongoose.Types.ObjectId.isValid(empresaId)) {
    throw new Error("MEMORIA_EMPRESA_ID_INVALIDO");
  }
  return new mongoose.Types.ObjectId(String(empresaId));
}

function normalizarNumero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

async function cargarEmpresa(empresaId, session) {
  const query = Empresa.findById(empresaId)
    .select(
      "_id configuracion.margen_objetivo configuracion.ticket_objetivo " +
      "configuracion.cac_maximo configuracion.punto_equilibrio " +
      "configuracion.empleados_actuales"
    )
    .lean();

  if (session) query.session(session);
  return query;
}

function medirConfiguracionCore(empresa) {
  const campos = [
    "margen_objetivo",
    "punto_equilibrio",
    "ticket_objetivo",
    "cac_maximo",
    "empleados_actuales"
  ];

  const configurados = campos.filter((campo) => {
    const valor = empresa.configuracion?.[campo];
    return valor !== null && valor !== undefined && valor !== "";
  }).length;

  return Number(((configurados / campos.length) * 100).toFixed(2));
}

async function medirKpi({ empresaId, kpi, session = null }) {
  const empresaObjectId = validarEmpresaId(empresaId);
  const direccion = KPI_DIRECCION[kpi];

  if (!direccion) {
    throw new Error("MEMORIA_KPI_NO_SOPORTADO");
  }

  const empresa = await cargarEmpresa(empresaObjectId, session);
  if (!empresa) {
    throw new Error("MEMORIA_EMPRESA_NO_ENCONTRADA");
  }

  const measuredAt = new Date();
  let valor = null;
  let objetivo = null;
  let medible = true;

  if (
    kpi === "margen_bruto_confiable" ||
    kpi === "cobertura_costo_porcentaje" ||
    kpi === "ticket_promedio"
  ) {
    const { desde, hasta } = periodoActualUTC();
    const ventas = await obtenerResumenVentas({
      empresaId: empresaObjectId,
      desde,
      hasta,
      session
    });

    if (kpi === "margen_bruto_confiable") {
      valor = normalizarNumero(ventas.margenBrutoConfiable);
      objetivo = normalizarNumero(empresa.configuracion?.margen_objetivo);
      medible = valor !== null;
    }

    if (kpi === "cobertura_costo_porcentaje") {
      valor = normalizarNumero(ventas.coberturaCostoPorcentaje);
      objetivo = 100;
    }

    if (kpi === "ticket_promedio") {
      valor = ventas.ventasTotales > 0
        ? normalizarNumero(ventas.ingresosTotales / ventas.ventasTotales)
        : null;
      objetivo = normalizarNumero(empresa.configuracion?.ticket_objetivo);
      medible = valor !== null;
    }
  }

  if (kpi === "porcentaje_items_agotados") {
    const totalQuery = Inventario.countDocuments({
      empresaId: empresaObjectId,
      anulado: false
    });
    const agotadosQuery = Inventario.countDocuments({
      empresaId: empresaObjectId,
      anulado: false,
      $or: [
        { estado: "agotado" },
        { cantidad: { $lte: 0 } }
      ]
    });

    if (session) {
      totalQuery.session(session);
      agotadosQuery.session(session);
    }

    const [total, agotados] = await Promise.all([
      totalQuery,
      agotadosQuery
    ]);

    valor = total > 0
      ? Number(((agotados / total) * 100).toFixed(2))
      : 0;
    objetivo = 0;
  }

  if (kpi === "cac") {
    // Marketing todavía no tiene atribución canónica suficiente.
    // La memoria conserva null en vez de inventar un CAC.
    valor = null;
    objetivo = normalizarNumero(empresa.configuracion?.cac_maximo);
    medible = false;
  }

  if (kpi === "configuracion_core") {
    valor = medirConfiguracionCore(empresa);
    objetivo = 100;
  }

  return {
    kpi,
    direccion,
    valor,
    objetivo,
    medible,
    measuredAt
  };
}

module.exports = {
  medirKpi,
  medirConfiguracionCore,
  KPI_DIRECCION
};
