"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const code=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.js"),"utf8");
test("El formulario manual rechaza decimales y cifras inseguras antes de enviar",()=>{
 const a=code.indexOf('$("saveMovimiento").onclick=async()=>');
 const b=code.indexOf(';$("savePrestamo")',a);
 assert.ok(a>=0&&b>a);
 const save=code.slice(a,b);
 assert.match(save,/const montoTexto=\$\("mMonto"\)\.value\.trim\(\)/);
 assert.match(save,/Number\.isSafeInteger\(Number\(montoTexto\)\)/);
 assert.match(save,/montoMinor:Number\(montoTexto\)/);
 assert.doesNotMatch(save,/Math\.round/);
 assert.ok(save.indexOf("const montoTexto=")<save.indexOf("manualExternalId=await resolverIntentoManual(datosMovimiento)"));
});
