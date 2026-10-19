"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

test("cambio de cuenta: se borran efectivamente todos los datos privados renderizados", () => {
 const src = fs.readFileSync(path.join(__dirname, "../../public/finanzas-personales.js"), "utf8");
 const start = src.indexOf("function invalidarIndicadoresFinancieros(){");
 const end = src.indexOf("let cargaPanelEnCurso=", start);
 assert.ok(start >= 0 && end > start);
 const numbers = ["hDisponibleHoy","hDisponible","hComprometido","hFlujo","hPatrimonio","rIngresos","rGastos","rFlujo","rDeuda","pActivos","pInversiones","pDeudas","pNeto"];
 const lists = ["diario","listaPorCobrar","listaPorPagar","listaPrestamosPagados","homeDecisions","compromisosActivos","compromisosArchivados","flujoConciliacion"];
 const privateContent = ["chatHistory","drafts","histResultados","answer","iiResultado"];
 const privateInputs = ["captureText","histQ","histMonto","histDesde","histHasta"];
 const notices = ["homeGreeting","captureMsg","iiMsg","live","histMensaje"];
 const ids = [...numbers,...lists,...privateContent,...privateInputs,...notices,"healthPercent","healthLabel","healthArrow","healthBubble","metricExplanation","histMas"];
 const nodes = Object.fromEntries(ids.map(id => [id, {
  textContent:"INFORMACION CONFIDENCIAL CUENTA A",
  value:"INFORMACION CONFIDENCIAL CUENTA A",
  children:["INFORMACION CONFIDENCIAL CUENTA A"],
  replaceChildren(){this.children=[];this.textContent="";},
  hidden:false,
  className:"healthBubble red",
  dataset:{alert:"true"},
  title:"CONFIDENCIAL"
 }]));
 const ctx = {
  $: id => nodes[id] || null,
  window:{grukExplain:() => "CONFIDENCIAL"}
 };
 vm.runInNewContext(src.slice(start,end),ctx);
 ctx.invalidarIndicadoresFinancieros();
 for(const id of numbers) assert.equal(nodes[id].textContent,"No actualizado",id);
 for(const id of lists) assert.equal(nodes[id].textContent,"No actualizado",id);
 for(const id of privateContent) {
  assert.equal(nodes[id].textContent,"",id);
  assert.deepEqual(nodes[id].children,[],id);
 }
 for(const id of privateInputs) assert.equal(nodes[id].value,"",id);
 for(const id of notices) assert.equal(nodes[id].textContent,"",id);
 assert.equal(nodes.healthPercent.textContent,"Sin datos confirmados");
 assert.equal(nodes.healthBubble.className,"healthBubble neutral");
 assert.equal(nodes.live.dataset.alert,"false");
 assert.equal(nodes.histMas.hidden,true);
 assert.equal(nodes.metricExplanation.hidden,true);
 assert.equal(ctx.window.grukExplain(), undefined);
});
