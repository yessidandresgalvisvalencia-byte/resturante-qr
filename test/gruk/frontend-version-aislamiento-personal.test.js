"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
test("el HTML personal referencia la version de frontend de las correcciones de sesion",()=>{
 const html=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.html"),"utf8");
 assert.match(html,/src="\/finanzas-personales\.js\?v=20261127-control-retiros-v81"/);
 assert.doesNotMatch(html,/finanzas-personales\.js\?v=20261015-integridad-v2/);
 assert.ok(html.indexOf("/finanzas-personales-diario-portable.js?v=20261127-control-retiros-v81")<html.indexOf("/finanzas-personales-calendario.js?v=20261127-control-retiros-v81"),"cifrado carga antes de calendario");
 assert.ok(html.indexOf("/finanzas-personales-diario-portable.js?v=20261127-control-retiros-v81")<html.indexOf("/finanzas-personales-captura.js?v=20261127-control-retiros-v81"),"cifrado carga antes de captura");
 const rutas=["finanzas-personales-imputacion.js","finanzas-personales-recuperacion.js","finanzas-personales-control-mutaciones.js","finanzas-personales.js"].map(n=>"/"+n+"?v="+(["finanzas-personales.js","finanzas-personales-control-mutaciones.js","finanzas-personales-recuperacion.js","finanzas-personales-imputacion.js"].includes(n)?"20261127-control-retiros-v81":"20261106-cierre-calendario-v81"));
 assert.match(html,/src="\/finanzas-personales-constancia\.js\?v=20261127-control-retiros-v81"/);
 assert.ok(html.indexOf('/finanzas-personales-constancia.js?v=20261127-control-retiros-v81')<html.indexOf('/finanzas-personales-manual.js?v=20261127-control-retiros-v81'));
 assert.ok(html.indexOf('/finanzas-personales-manual.js?v=20261127-control-retiros-v81')<html.indexOf(rutas[3]),"diario manual carga antes de la aplicación");
 assert.equal(html.split('src="/finanzas-personales-diario-portable.js?v=20261127-control-retiros-v81"').length-1,1);
 assert.ok(html.indexOf('/finanzas-personales-diario-portable.js?v=20261127-control-retiros-v81')<html.indexOf('/finanzas-personales-manual.js?v=20261127-control-retiros-v81'));
 assert.ok(html.indexOf('/finanzas-personales-diario-portable.js?v=20261127-control-retiros-v81')<html.indexOf(rutas[0]));
 for(const ruta of rutas)assert.equal(html.split('src="'+ruta+'"').length-1,1);
 assert.ok(html.indexOf(rutas[0])<html.indexOf(rutas[1])&&html.indexOf(rutas[1])<html.indexOf(rutas[2])&&html.indexOf(rutas[2])<html.indexOf(rutas[3]),"control e imputación cargan antes de la aplicación");
 assert.match(html,/href="\/finanzas-personales\.css\?v=20261019-integridad-sesion-coldstart"/);
 assert.doesNotMatch(html,/finanzas-personales\.css\?v=20261013-bubble2/);
 assert.match(html,/<meta http-equiv="Cache-Control" content="no-store">/);
});

test("auditoría de movimientos carga una vez antes de la aplicación",()=>{const html=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.html"),"utf8"),ruta="/finanzas-personales-auditoria.js?v=20261127-control-retiros-v81";assert.equal(html.split('src="'+ruta+'"').length-1,1);assert.ok(html.indexOf(ruta)<html.indexOf("/finanzas-personales.js?v="));});

test("verificador del registro original carga antes de la auditoría",()=>{const html=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.html"),"utf8"),ruta="/finanzas-personales-registro-auditoria.js?v=20261127-control-retiros-v81";assert.equal(html.split('src="'+ruta+'"').length-1,1);assert.ok(html.indexOf(ruta)<html.indexOf("/finanzas-personales-auditoria.js?v="));});

test("historial de recibos carga una sola vez antes de la aplicación",()=>{const h=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.html"),"utf8"),ruta="/finanzas-personales-historial-revision.js?v=20261127-control-retiros-v81";assert.equal(h.split('src="'+ruta+'"').length-1,1);assert.ok(h.indexOf(ruta)<h.indexOf("/finanzas-personales.js?v="));});

test("diario portable de revisiones carga después del cifrado y antes de la aplicación",()=>{const h=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.html"),"utf8"),ruta="/finanzas-personales-revision-portable.js?v=20261127-control-retiros-v81";assert.equal(h.split('src="'+ruta+'"').length-1,1);assert.ok(h.indexOf("/finanzas-personales-diario-portable.js?v=")<h.indexOf(ruta));assert.ok(h.indexOf(ruta)<h.indexOf("/finanzas-personales.js?v="));});

test("diario durable de retiros carga una vez antes del frontend personal",()=>{const html=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.html"),"utf8"),src="/finanzas-personales-retiro-deudas.js?v=20261127-control-retiros-v81";assert.equal(html.split(src).length-1,1);assert.ok(html.indexOf("/finanzas-personales-diario-portable.js?v=20261127-control-retiros-v81")<html.indexOf(src));assert.ok(html.indexOf(src)<html.indexOf("/finanzas-personales.js?v=20261127-control-retiros-v81"));});
test("recuperación de recibos es accesible desde deudas visibles y retiradas con controles únicos",()=>{const html=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.html"),"utf8"),js=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.js"),"utf8");for(const id of ["rdHistorialDeuda","rdHistorialConsultar","rdHistorialSiguiente","rdHistorialEstado","rdHistorialLista","rdControlConsultar","rdControlEstado","rdControlLista"])assert.equal(html.split('id="'+id+'"').length-1,1);assert.ok(js.includes("window.verRecibosRetiroDeuda=id=>retiroDeudaPersonal?.consultarHistorial(id)"));assert.equal(js.split('>Ver recibos de retiro</button>').length-1,2);});
