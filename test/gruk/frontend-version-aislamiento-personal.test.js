"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
test("el HTML personal referencia la version de frontend de las correcciones de sesion",()=>{
 const html=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.html"),"utf8");
 assert.match(html,/src="\/finanzas-personales\.js\?v=20261019-coldstart-aislamiento-sesiones"/);
 assert.doesNotMatch(html,/finanzas-personales\.js\?v=20261015-integridad-v2/);
 assert.match(html,/href="\/finanzas-personales\.css\?v=20261019-integridad-sesion-coldstart"/);
 assert.doesNotMatch(html,/finanzas-personales\.css\?v=20261013-bubble2/);
 assert.match(html,/<meta http-equiv="Cache-Control" content="no-store">/);
});
