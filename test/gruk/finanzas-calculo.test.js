'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

function cargarCalculo() {
  const archivo = fs.readFileSync(path.join(__dirname, '../../public/finanzas.js'), 'utf8');
  const inicio = archivo.indexOf('function calcularEstadoResultadosGRUK');
  const fin = archivo.indexOf('function calcularSemaforoGRUK', inicio);
  assert.ok(inicio >= 0 && fin > inicio);
  const contexto = {};
  vm.runInNewContext(archivo.slice(inicio, fin) + '\nthis.calcular = calcularEstadoResultadosGRUK;', contexto);
  return contexto.calcular;
}

test('no duplica produccion ni gastos financieros', () => {
  const calcular = cargarCalculo();
  const r = calcular({ ingresosTotales: 10000000, costosMateriaPrima: 2000000, gastosProduccion: 1000000, totalGastos: 2500000, gastosFinancieros: 500000, gastoNomina: 2000000 });
  assert.equal(r.costoProduccionVentas, 3000000);
  assert.equal(r.gastosOperativosRegistrados, 1000000);
  assert.equal(r.utilidadOperacional, 4000000);
  assert.equal(r.otrosEgresos, 500000);
  assert.equal(r.utilidadNeta, 3500000);
  assert.equal(r.totalCostoYGasto, 6500000);
});
