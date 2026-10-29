"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const html=fs.readFileSync(path.resolve(__dirname,"../../public/finanzas-personales.html"),"utf8");
const js=fs.readFileSync(path.resolve(__dirname,"../../public/finanzas-personales.js"),"utf8");
test("HTML referencia versión actualizada de JavaScript financiero personal",()=>{
 const scripts=[...html.matchAll(/<script\s+src="([^"]*finanzas-personales\.js\?v=[^"]+)"/g)];
 assert.equal(scripts.length,1,"solo un script de la aplicación personal");
 assert.equal(scripts[0][1],"/finanzas-personales.js?v=20261029-cuotas-aislamiento-sesion-v81");
 assert.doesNotMatch(html,/finanzas-personales\.js\?v=20261020-hormiga-semana-mes/);
});
test("versión nueva contiene interfaz de tarjeta, promedio y conciliación defensiva",()=>{
 assert.match(js,/Crédito no es salida de caja hoy/);
 assert.match(js,/promedioDiarioConsumoMinor/);
 assert.match(js,/resumen\.semanaMinor\+resumen\.creditoSemanaMinor!==resumen\.consumoTotalSemanaMinor/);
 assert.match(js,/Resumen descuadrado: requiere verificación/);
 assert.match(html,/id="hormigaResumen"/);
});
