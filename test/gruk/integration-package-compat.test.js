"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {diffMap,validate}=require("../../scripts/audit-finanzas-package-compat");
test("dependencias: detecta cambio, alta y baja sin esconder versiones",()=>{
 assert.deepEqual(diffMap({axios:"^1.6.0",a:"1"}, {axios:"1.20.0",b:"2"}),[
  {name:"a",main:"1",personal:null},
  {name:"axios",main:"^1.6.0",personal:"1.20.0"},
  {name:"b",main:null,personal:"2"}
 ]);
});
test("dependencias: cambios nuevos quedan explícitamente bloqueados",()=>{
 const result=validate({dependencies:{axios:"^1.6.0",multer:"^2.1.1",segura:"1"},scripts:{start:"node app.js"}},{dependencies:{axios:"1.20.0",multer:"^2.3.0",segura:"2"},scripts:{start:"node app.js","start:personal":"node modules/finanzas-personales/server.js"}});
 assert.deepEqual(result.blockers,["segura"]);
 assert.ok(result.personalScriptsToPreserve.includes("start:personal"));
});
test("dependencias: sin diferencias no inventa conflictos",()=>{
 const x={dependencies:{axios:"1.20.0"},scripts:{start:"node app.js"}};
 const r=validate(x,x);
 assert.deepEqual(r.dependencies,[]);
 assert.deepEqual(r.personalScriptsToPreserve,[]);
 assert.deepEqual(r.blockers,[]);
});
