"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const {webcrypto}=require("node:crypto");
const fuente=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.js"),"utf8");
const inicio=fuente.indexOf('const CLAVE_INTENTO_MANUAL=');
const fin=fuente.indexOf('function persist()',inicio);
assert.ok(inicio>0&&fin>inicio,"Debe existir el módulo de intento manual");
const modulo=fuente.slice(inicio,fin);
function preparar(almacen){
 const sessionStorage={getItem:k=>almacen.get(k)||null,setItem:(k,v)=>almacen.set(k,v),
  removeItem:k=>almacen.delete(k)};
 const contexto=vm.createContext({sessionStorage,crypto:webcrypto,TextEncoder,token:"sesion-privada",
  manualExternalId:null,manualPayloadPendiente:null});
 vm.runInContext(modulo,contexto);
 return contexto;
}
test("el mismo borrador reusa el identificador después de recargar",async()=>{
 const almacen=new Map(), datos={tipo:"GASTO",montoMinor:25000,concepto:"Rappi"};
 const a=preparar(almacen),id=await a.resolverIntentoManual(datos);
 assert.match(id,/^[0-9a-f-]{36}$/i);
 const b=preparar(almacen);
 assert.equal(await b.resolverIntentoManual(datos),id);
 const guardado=Array.from(almacen.values()).join("");
 assert.ok(!guardado.includes("Rappi")&&!guardado.includes("25000")&&!guardado.includes("sesion-privada"));
});
test("un registro incierto impide cambiar su contenido o usuario",async()=>{
 const almacen=new Map(),a=preparar(almacen);
 await a.resolverIntentoManual({montoMinor:25000});
 await assert.rejects(a.resolverIntentoManual({montoMinor:25001}),/sin confirmar/);
 const otra=preparar(almacen);otra.token="otra-sesion";
 await assert.rejects(otra.resolverIntentoManual({montoMinor:25000}),/sin confirmar/);
 a.limpiarIntentoManual();
 assert.equal(almacen.size,0);
 assert.match(await a.resolverIntentoManual({montoMinor:25001}),/^[0-9a-f-]{36}$/i);
});
