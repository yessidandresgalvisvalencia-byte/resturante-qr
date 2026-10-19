"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const src=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.js"),"utf8");
test("el asesor no presenta mensajes de una cuenta anterior",()=>{
 const a=src.indexOf('let chatSending=false;'),b=src.indexOf('$("iiAnalizar").onclick=',a);
 assert.ok(a>=0&&b>a);
 const code=src.slice(a,b);
 assert.match(code,/const tokenConsulta=token/);
 assert.match(code,/const j=await api\("\/copilot"/);
 assert.match(code,/r=j\.resultado;if\(!tokenConsulta\|\|token!==tokenConsulta\|\|\$\("app"\)\.hidden\)return;chatBubble/);
 assert.match(code,/await loadDrafts\(\);if\(!tokenConsulta\|\|token!==tokenConsulta\|\|\$\("app"\)\.hidden\)return/);
 assert.match(code,/catch\(e\)\{if\(!tokenConsulta\|\|token!==tokenConsulta\|\|\$\("app"\)\.hidden\)return/);
});
test("el analista de inversiones no renderiza respuesta tardia de otra cuenta",()=>{
 const a=src.indexOf('$("iiAnalizar").onclick='),b=src.indexOf("const SR=window.SpeechRecognition",a);
 assert.ok(a>=0&&b>a);
 const code=src.slice(a,b);
 assert.match(code,/const tokenConsulta=token/);
 assert.match(code,/api\("\/inversiones\/inteligencia"/);
 assert.match(code,/star=r\.recomendacion_estrella;if\(!tokenConsulta\|\|token!==tokenConsulta\|\|\$\("app"\)\.hidden\)return;\$\("iiResultado"\)/);
 assert.match(code,/catch\(e\)\{if\(!tokenConsulta\|\|token!==tokenConsulta\|\|\$\("app"\)\.hidden\)return/);
});
