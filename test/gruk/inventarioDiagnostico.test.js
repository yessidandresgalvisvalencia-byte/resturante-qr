"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const fuente = fs.readFileSync(path.join(__dirname, "../../public/js/inventario.js"), "utf8");

function entorno(productos = []) {
  const elementos = new Map([
    ["planInventarioMensual", { innerHTML: "" }],
    ["resultadoDiagnosticoGRUK", { innerHTML: "" }]
  ]);
  class FechaFija extends Date {
    constructor(...args) {
      if (args.length === 0) super(2026, 10, 1); // Noviembre: el mes siguiente es diciembre.
      else super(...args);
    }
  }
  const contexto = vm.createContext({
    window: {},
    Date: FechaFija,
    document: { getElementById: (id) => elementos.get(id) || null },
    localStorage: { getItem: () => "rest-prueba" },
    getRestaurantId: () => "rest-prueba",
    grukFetch: async () => ({ json: async () => ({ ok: true, productos }) }),
    formatoCOP: (valor) => "$" + valor,
    alert: (mensaje) => { throw new Error(mensaje); },
    console
  });
  vm.runInContext(fuente, contexto, { filename: "public/js/inventario.js" });
  return { contexto, elementos };
}

const productos = [
  { nombre: "Bebida sin fecha", categoria: "bebida", cantidad: 10, costo: 100, diasRestantes: null, estado: "vigente" },
  { nombre: "Bebida próxima", categoria: "bebida", cantidad: 3, costo: 200, diasRestantes: 5, estado: "proximo" },
  { nombre: "Bebida vencida", categoria: "bebida", cantidad: 2, costo: 50, diasRestantes: -2, estado: "vencido" },
  { nombre: "Agotado", categoria: "insumo", cantidad: 0, costo: 40, diasRestantes: null, estado: "agotado" }
];

test("los días ausentes o inválidos no se convierten en cero", () => {
  const { contexto } = entorno();
  for (const valor of [null, undefined, "", "no-numérico", Infinity]) {
    assert.equal(contexto.obtenerDiasRestantesInventarioGRUK({ diasRestantes: valor }), null);
  }
  assert.equal(contexto.obtenerDiasRestantesInventarioGRUK({ diasRestantes: 0 }), 0);
  assert.equal(contexto.obtenerDiasRestantesInventarioGRUK({ diasRestantes: 7 }), 7);
  assert.equal(contexto.obtenerDiasRestantesInventarioGRUK({ diasRestantes: -2 }), -2);
});

test("solo se consideran próximos los productos con fecha válida y stock activo", () => {
  const { contexto } = entorno();
  assert.equal(contexto.estaProximoInventarioGRUK(productos[0], 7), false);
  assert.equal(contexto.estaProximoInventarioGRUK(productos[1], 7), true);
  assert.equal(contexto.estaProximoInventarioGRUK(productos[2], 7), false);
  assert.equal(contexto.estaProximoInventarioGRUK(productos[3], 7), false);
  assert.equal(contexto.estaProximoInventarioGRUK({ estado: "vigente", diasRestantes: 20 }, 7), false);
});

test("planificador conserva vencimientos nulos y no inventa porcentajes de demanda", async () => {
  const { contexto, elementos } = entorno(productos);
  await contexto.generarPlanInventarioMensualGRUK();
  const html = elementos.get("planInventarioMensual").innerHTML;
  assert.match(html, /Bebida sin fecha/);
  assert.match(html, /Sin vencimiento/);
  assert.doesNotMatch(html, /10%|25%|Factor de demanda|1\.25x|0 días/);
  assert.match(html, /No se calcula sin historial de ventas validado/);
  assert.match(html, /Revisar demanda estacional/);
  const filaVencida = html.match(/<td>Bebida vencida<\/td>([\s\S]*?)<\/tr>/);
  assert.ok(filaVencida, "la fila vencida debe renderizarse");
  assert.match(filaVencida[1], /No comprar más/);
  assert.doesNotMatch(filaVencida[1], /Revisar demanda estacional/);
});

test("diagnóstico excluye productos sin vencimiento del capital en riesgo", async () => {
  const { contexto, elementos } = entorno(productos);
  await contexto.diagnosticoInventarioGRUK();
  const html = elementos.get("resultadoDiagnosticoGRUK").innerHTML;
  assert.match(html, /Hay <strong>1<\/strong> producto\(s\) próximos a vencer/);
  assert.match(html, /Capital en riesgo por vencimiento:[\s\S]*?<strong>\$600<\/strong>/);
  const usarPrimero = html.split("<h3>✅ Usa primero</h3>")[1].split("<h3>✔ Para el próximo mes compra</h3>")[0];
  assert.match(usarPrimero, /Bebida próxima/);
  assert.doesNotMatch(usarPrimero, /Bebida sin fecha|Bebida vencida|Agotado/);
});
