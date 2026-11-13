"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("las rutas privadas requieren autenticar antes de servir datos", () => {
 const code = read("modules/finanzas-personales/routes.js");
 const gate = code.indexOf("router.use(auth,entitlement);");
 const routes = ["/diagnostico-integridad", "/home", "/resumen", "/compromisos-cuotas"];
 assert.ok(gate >= 0);
 for (const endpoint of routes) {
  const index = code.indexOf('router.get("' + endpoint + '"');
  assert.ok(index > gate, endpoint + " debe estar tras autenticación");
 }
});

test("las respuestas financieras autenticadas nunca se guardan en caché", () => {
 const code = read("modules/finanzas-personales/routes.js");
 const gate = code.indexOf("router.use(auth,entitlement);");
 const cacheMiddleware = code.indexOf("router.use((req,res,next)=>", gate);
 const privacy = code.indexOf('res.set("Cache-Control","private, no-store, max-age=0")', cacheMiddleware);
 const firstPrivate = code.indexOf('router.get("/diagnostico-integridad"');
 assert.ok(cacheMiddleware > gate && cacheMiddleware < firstPrivate);
 assert.ok(privacy > cacheMiddleware && privacy < firstPrivate);
 assert.match(code, /res\.set\("Pragma","no-cache"\)/);
});

test("las lecturas de cuotas siempre filtran por dueño y no confían en ID del cliente", () => {
 const code = read("modules/finanzas-personales/services/compromisosCuotas.service.js");
 assert.match(code, /Padre\.find\(\{usuarioId\}\)/);
 assert.match(code, /Cuota\.find\(\{usuarioId,compromisoId:/);
 assert.match(code, /Padre\.findOne\(\{_id:compromisoId,usuarioId/);
 assert.match(code, /Cuenta\.findOneAndUpdate\(\{_id:cuentaId,usuarioId/);
});

test("recargar no borra los indicadores y cambiar de identidad sí los invalida", () => {
 const code = read("public/finanzas-personales.js");
 assert.match(code, /async function load\(\)[\s\S]*?const ejecucion=\(async\(\)=>\{const liveAlCargar=/);
 assert.match(code, /if\(token!==j\.token\)\{cancelarSolicitudes\(\);limpiarIntentoManual\(\);invalidarIndicadoresFinancieros\(\)/);
 assert.match(code, /Las cifras visibles pueden corresponder a una consulta anterior/);
});

test("cabecera de revisión antes de auth no sirve datos ni sustituye handler autenticado",()=>{const code=read("modules/finanzas-personales/routes.js"),gate=code.indexOf("router.use(auth,entitlement);"),inicio=code.indexOf('router.get("/metas/revision-fuentes"'),handler=code.lastIndexOf('router.get("/metas/revision-fuentes"');assert.ok(inicio>=0&&inicio<gate&&handler>gate);const previo=code.slice(inicio,gate);assert.match(previo,/return next\(\);/);assert.doesNotMatch(previo,/res\.(json|send|status)\(/);assert.match(code.slice(handler,handler+160),/revisionFuentesMetaPersonal.handler/);});
