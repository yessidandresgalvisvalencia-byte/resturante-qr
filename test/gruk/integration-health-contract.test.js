"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"../..");
const source=fs.readFileSync(path.join(root,"app.js"),"utf8");
const {registerHttpHealthRoutes}=require("../../core/health/httpHealth.routes");

test("integración: app.js conserva el contrato de salud modular de main",()=>{
 assert.match(source,/registerHttpHealthRoutes\(app,mongoose,\{version:require\("\.\/package\.json"\)\.version\}\)/);
 assert.doesNotMatch(source,/app\.get\(["']\/health["']/);
 assert.doesNotMatch(source,/app\.get\(["']\/ready["']/);
});
test("integración: no se eliminan rutas empresariales ni autenticación de sockets",()=>{
 for(const required of [
  'app.use("/api/restaurants", restaurantRoutes)',
  'app.use("/api/facturacion-v2", facturacionCoreRoutes)',
  'app.use("/api/inventario",',
  'app.use("/api", apiRoutes)',
  'validarVersionSesion(payload)',
  'socket.join(`empresa-${socket.auth.empresaId}`)',
  'iniciarAplicacion();'
 ]) {
  // No verificar espacios internos ni estilos de formato en el montaje de inventario.
  if(required.includes('inventario'))assert.match(source,/app\.use\(\s*["']\/api\/inventario["']/);
  else assert.ok(source.includes(required),`Falta contrato empresarial: ${required}`);
 }
});
test("integración: /ready y /health no revelan conexión como saludable si MongoDB está caído",()=>{
 const routes=new Map();
 const app={get:(path,handler)=>routes.set(path,handler)};
 const mongo={connection:{readyState:0}};
 registerHttpHealthRoutes(app,mongo,{version:"1.0.0",commit:"a".repeat(40),uptime:()=>5.9});
 function invoke(route){
  const result={headers:{},code:200,body:null};
  const response={set(k,v){result.headers[k]=v;return this;},status(c){result.code=c;return this;},json(obj){result.body=obj;return this;}};
  routes.get(route)({},response);
  return result;
 }
 assert.equal(invoke("/ready").code,503);
 assert.equal(invoke("/health").code,503);
 assert.equal(invoke("/ready").headers["Cache-Control"],"no-store");
 assert.equal(invoke("/health").headers["Cache-Control"],"no-store");
 mongo.connection.readyState=1;
 assert.equal(invoke("/ready").code,200);
 assert.equal(invoke("/health").code,200);
 assert.equal(invoke("/health").body.uptime,5);
});
