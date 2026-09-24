"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { calcularActivacionModulos } = require("../../core/modulos/modulos.service");
const { roleCheck, ROLES_GRUK } = require("../../core/auth/roleCheck.middleware");

test("Gente no se activa con 15 empleados", () => {
  assert.equal(calcularActivacionModulos({ empleadosActuales: 15, clientesRecurrentes: 0 }).gente, false);
});

test("Gente se activa con 16 empleados", () => {
  assert.equal(calcularActivacionModulos({ empleadosActuales: 16, clientesRecurrentes: 0 }).gente, true);
});

test("Servicio al Cliente no se activa con 100 recurrentes", () => {
  assert.equal(calcularActivacionModulos({ empleadosActuales: 3, clientesRecurrentes: 100 }).servicio_cliente, false);
});

test("Servicio al Cliente se activa con 101 recurrentes", () => {
  assert.equal(calcularActivacionModulos({ empleadosActuales: 3, clientesRecurrentes: 101 }).servicio_cliente, true);
});

test("EMPLEADO recibe 403 en una frontera reservada a Finanzas", () => {
  const middleware = roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE);
  const req = { auth: { rol: ROLES_GRUK.EMPLEADO } };
  let statusCode = null;
  let payload = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json(body) { payload = body; return this; }
  };
  middleware(req, res, () => assert.fail("EMPLEADO no debe pasar"));
  assert.equal(statusCode, 403);
  assert.equal(payload.ok, false);
});


test("Cerebro desempata por confianza y luego menor riesgo de caja", () => {
  const { compararCandidatos } = require("../../intelligence/brain/cerebro");
  const base = { hallazgo: { impacto_financiero_estimado: 1000, confianza: 90 } };
  const marketing = { ...base, regla: { departamento: "MARKETING" } };
  const finanzas = { ...base, regla: { departamento: "FINANZAS" } };
  assert.ok(compararCandidatos(finanzas, marketing) < 0);

  const ventasMayorConfianza = {
    hallazgo: { impacto_financiero_estimado: 1000, confianza: 95 },
    regla: { departamento: "VENTAS" }
  };
  assert.ok(compararCandidatos(ventasMayorConfianza, finanzas) < 0);
});


test("filtroTenant nunca permite a ADMIN_SEDE consultar otra sede", () => {
  const { filtroTenant } = require("../../intelligence/brain/cerebro.service");
  const auth = {
    empresaId: "64b000000000000000000001",
    sedeId: "64b000000000000000000002",
    rol: ROLES_GRUK.ADMIN_SEDE
  };
  const filtro = filtroTenant(auth, {
    _id: "64b000000000000000000003",
    sedeId: "64b000000000000000000099"
  });
  assert.equal(String(filtro.empresaId), auth.empresaId);
  assert.equal(String(filtro.sedeId), auth.sedeId);
});

test("filtroTenant rechaza ADMIN_SEDE sin sede autorizada", () => {
  const { filtroTenant } = require("../../intelligence/brain/cerebro.service");
  assert.throws(
    () => filtroTenant({
      empresaId: "64b000000000000000000001",
      sedeId: null,
      rol: ROLES_GRUK.ADMIN_SEDE
    }),
    (error) => error.statusCode === 403
  );
});


test("Peluqueria de 3 empleados mantiene modulos automaticos apagados", () => {
  assert.deepEqual(
    calcularActivacionModulos({ empleadosActuales: 3, clientesRecurrentes: 0 }),
    { gente: false, servicio_cliente: false }
  );
});

test("Restaurante de 18 empleados activa Gente sin inventar Servicio al Cliente", () => {
  assert.deepEqual(
    calcularActivacionModulos({ empleadosActuales: 18, clientesRecurrentes: 0 }),
    { gente: true, servicio_cliente: false }
  );
});


test("Cerebro inmediato solo se dispara con KPI CRITICO", () => {
  const { debeTomarDecision } = require("../../intelligence/orchestrator/cicloInteligencia");
  const reportesAlerta = [
    { kpi_principal: { estado: "ALERTA" }, necesita_decision_de_cerebro: true }
  ];
  const reportesCritico = [
    { kpi_principal: { estado: "CRITICO" }, necesita_decision_de_cerebro: false }
  ];

  assert.equal(debeTomarDecision(reportesAlerta, false), false);
  assert.equal(debeTomarDecision(reportesCritico, false), true);
  assert.equal(debeTomarDecision(reportesAlerta, true), true);
});


test("Las cinco neuronas implementan el contrato GRUK", () => {
  const neuronas = [
    require("../../intelligence/neurons/finanzas.neuron"),
    require("../../intelligence/neurons/ventas.neuron"),
    require("../../intelligence/neurons/marketing.neuron"),
    require("../../intelligence/neurons/operaciones.neuron"),
    require("../../intelligence/neurons/gente.neuron")
  ];

  assert.equal(neuronas.length, 5);
  for (const neurona of neuronas) {
    assert.equal(typeof neurona.getRequiredEvents, "function");
    assert.equal(typeof neurona.analyze, "function");
    assert.ok(Array.isArray(neurona.getRequiredEvents()));
  }
});

test("Empresa nueva activa inteligencia GRUK por defecto", () => {
  const Empresa = require("../../models/Empresa");
  const empresa = new Empresa({
    empresaId: "emp_test_default_intelligence",
    nombre: "Empresa Test",
    tipoNegocio: "servicios",
    correo: "test@example.com"
  });

  assert.equal(empresa.modulos.inteligencia, true);
});


test("Situacion ejecutiva refleja ordenes pendientes aunque no haya CRITICOS", () => {
  const { construirSituacion } = require("../../intelligence/brain/cerebro");
  const texto = construirSituacion([], [{}, {}, {}, {}]);
  assert.equal(texto, "4 orden(es) empresariales requieren seguimiento.");
});

test("Situacion ejecutiva combina funciones criticas y ordenes", () => {
  const { construirSituacion } = require("../../intelligence/brain/cerebro");
  const texto = construirSituacion([{}], [{}, {}]);
  assert.equal(texto, "1 funcion(es) critica(s) requieren atencion y 2 orden(es) esperan gestion.");
});
