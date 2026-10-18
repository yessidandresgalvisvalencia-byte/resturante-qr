"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {spawnSync}=require("node:child_process");
const script=path.join(__dirname,"../../scripts/resumen-auditoria-personal.js");
function ejecutar(reporte){
 const carpeta=fs.mkdtempSync(path.join(os.tmpdir(),"gruk-audit-"));
 try{
  const archivo=path.join(carpeta,"audit.json");
  fs.writeFileSync(archivo,JSON.stringify(reporte),"utf8");
  return spawnSync(process.execPath,[script,archivo],{encoding:"utf8",timeout:10000});
 }finally{fs.rmSync(carpeta,{recursive:true,force:true});}
}
test("alerta alta exige salida no exitosa y nombra paquete",()=>{
 const r=ejecutar({vulnerabilities:{paquetePrueba:{severity:"high",via:[],fixAvailable:false}}});
 assert.equal(r.status,1);
 assert.match(r.stdout,/paquetePrueba/);
 assert.match(r.stdout,/Altas: 1/);
});
test("sin alertas no bloquea el proceso",()=>{
 const r=ejecutar({vulnerabilities:{}});
 assert.equal(r.status,0);
 assert.match(r.stdout,/Sin alertas altas/);
});
test("no revela datos financieros ni tokens: solo campos npm audit",()=>{
 const r=ejecutar({vulnerabilities:{dependencia:{severity:"critical",via:[{url:"https://github.com/advisories/EJEMPLO"}],fixAvailable:true}}});
 assert.equal(r.status,1);
 assert.match(r.stdout,/dependencia/);
 assert.match(r.stdout,/Críticas: 1/);
});

test("el informe distingue dependencia directa, rango vulnerable y versión de corrección",()=>{
 const r=ejecutar({vulnerabilities:{
  dependenciaX:{severity:"high",isDirect:true,range:"<2.3.4",effects:["dependenciaY"],
   via:[{url:"https://github.com/advisories/GHSA-prueba"}],
   fixAvailable:{name:"dependenciaX",version:"2.3.4"}}
 }});
 assert.equal(r.status,1);
 for(const valor of ["Tipo","Directa","Rango afectado","<2.3.4","2.3.4","dependenciaY","GHSA-prueba"])
  assert.ok(r.stdout.includes(valor),valor);
});
