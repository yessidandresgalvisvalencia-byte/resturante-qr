"use strict";

const mongoose = require("mongoose");
const Empresa = require("../../models/Empresa");
const Cliente = require("../../models/Cliente");

function calcularActivacionModulos({ empleadosActuales, clientesRecurrentes }) {
  const empleados =
    empleadosActuales === null || empleadosActuales === undefined
      ? null
      : Number(empleadosActuales);
  const recurrentes = Number(clientesRecurrentes || 0);

  return {
    gente: Number.isFinite(empleados) && empleados > 15,
    servicio_cliente: recurrentes > 100
  };
}

async function evaluarModulosAutomaticos(empresaId) {
  if (!mongoose.Types.ObjectId.isValid(empresaId)) {
    throw new Error("MODULOS_EMPRESA_ID_INVALIDO");
  }

  const empresa = await Empresa.findById(empresaId);
  if (!empresa) throw new Error("MODULOS_EMPRESA_NO_ENCONTRADA");

  const empleados = empresa.configuracion?.empleados_actuales ?? null;
  const recurrentes = await Cliente.countDocuments({
    empresaId: empresa._id,
    deletedAt: null,
    numeroCompras: { $gte: 2 }
  });

  const activacion = calcularActivacionModulos({
    empleadosActuales: empleados,
    clientesRecurrentes: recurrentes
  });

  let cambio = false;
  if (empresa.modulos.gente !== activacion.gente) {
    empresa.modulos.gente = activacion.gente;
    cambio = true;
  }
  if (empresa.modulos.servicio_cliente !== activacion.servicio_cliente) {
    empresa.modulos.servicio_cliente = activacion.servicio_cliente;
    cambio = true;
  }
  if (cambio) await empresa.save();

  return {
    ...activacion,
    empleados_actuales: empleados === null ? null : Number(empleados),
    clientes_recurrentes: recurrentes
  };
}

module.exports = {
  calcularActivacionModulos,
  evaluarModulosAutomaticos
};
