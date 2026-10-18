"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.js"),"utf8");
test("Guardado confirmado no se reporta como fallido si la actualización del panel falla",()=>{
 const a=source.indexOf('$("saveMovimiento").onclick=async()=>'),z=source.indexOf(';$("savePrestamo")',a);
 assert.ok(a>=0&&z>a);
 const code=source.slice(a,z);
 assert.match(code,/await api\("\/transacciones",body\(datosMovimiento\)\)/);
 assert.match(code,/msg\("movMsg","Movimiento guardado\."\)/);
 assert.match(code,/try\{await load\(\)\}catch\(e\)/);
 assert.match(code,/Movimiento guardado, pero el panel no se actualizó/);
 assert.match(code,/No se pudo confirmar si el movimiento quedó guardado/);
 assert.match(code,/GRUK conserva el identificador/);
});
