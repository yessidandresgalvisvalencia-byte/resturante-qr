"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.js"),"utf8");
test("Capital de inversión V81 no redondea pesos ni acepta valores inseguros",()=>{
 const start=source.indexOf('$("iiAnalizar").onclick=async()=>'),end=source.indexOf('const j=await api("/inversiones/inteligencia"',start);
 assert.ok(start>=0&&end>start);
 const handler=source.slice(start,end);
 assert.match(handler,/const capitalTexto=\$\("iiCapital"\)\.value\.trim\(\)/);
 assert.match(handler,/Number\.isSafeInteger\(Number\(capitalTexto\)\)/);
 assert.match(handler,/capitalMinor:Number\(capitalTexto\)/);
 assert.doesNotMatch(handler,/Math\.round/);
});
