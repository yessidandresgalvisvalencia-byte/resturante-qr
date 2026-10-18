"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const src=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.js"),"utf8");
test("Un reintento manual con respuesta incierta bloquea cambios de importe o concepto",()=>{
 const a=src.indexOf('$("saveMovimiento").onclick=async()=>'),b=src.indexOf(';$("savePrestamo")',a);
 assert.ok(a>=0&&b>a);
 const guard=src.slice(a,b);
 assert.match(guard,/manualPayloadPendiente&&JSON\.stringify/);
 assert.match(guard,/throw new Error\("Hay un envío anterior sin confirmar/);\n assert.doesNotMatch(guard,/confirm\(/);
 assert.match(guard,/manualPayloadPendiente=datosMovimiento;await api\("\/transacciones",body\(datosMovimiento\)\)/);
 assert.match(guard,/manualExternalId=null;manualPayloadPendiente=null;msg\("movMsg","Movimiento guardado\."/);
 assert.match(src,/function clearToken\(\)\{cancelarSolicitudes\(\);manualExternalId=null;manualPayloadPendiente=null/);
});
