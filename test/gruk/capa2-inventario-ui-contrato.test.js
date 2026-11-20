"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../../public/js/inventario.js"),"utf8");
function takeFunction(name,next){
 const start=source.indexOf("async function "+name+"(");
 const end=source.indexOf(next,start);
 assert.ok(start>=0&&end>start,name+" presente");
 return source.slice(start,end);
}
test("Capa 2 UI: anulación no falsifica actor desde localStorage",async()=>{
 const alerts=[];
 const calls=[];
 const snippet=takeFunction("anularInventario","async function inicializarInventarioGRUK");
 const context={
  prompt:()=> "corrección de prueba",
  alert:(s)=>alerts.push(s),
  grukFetch:async(url,opts)=>{
   calls.push({url,opts});
   return {ok:true,json:async()=>({ok:true})};
  },
  cargarInventario:()=>{},
 };
 vm.createContext(context);
 vm.runInContext(snippet,context);
 await context.anularInventario("producto-1");
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,"/api/inventario/anular/producto-1");
 assert.deepEqual(JSON.parse(calls[0].opts.body),{motivo:"corrección de prueba"});
 assert.equal(alerts[0],"Producto anulado con trazabilidad");
});
test("Capa 2 UI: conflicto 409 no muestra éxito ni recarga inventario",async()=>{
 const alerts=[];
 let reload=0;
 const snippet=takeFunction("anularInventario","async function inicializarInventarioGRUK");
 const context={
  prompt:()=> "motivo válido",
  alert:(s)=>alerts.push(s),
  grukFetch:async()=>({ok:false,status:409,json:async()=>({
   ok:false,error:"Conflicto de concurrencia; consulta el estado antes de reintentar"
  })}),
  cargarInventario:()=>{reload++;}
 };
 vm.createContext(context);
 vm.runInContext(snippet,context);
 await context.anularInventario("producto-1");
 assert.equal(reload,0);
 assert.equal(alerts.length,1);
 assert.match(alerts[0],/Conflicto de concurrencia/);
});
test("Capa 2 UI: formulario conserva contrato sin campo usuario",()=>{
 const guardar=takeFunction("guardarInventario","const estadoFiltrosInventarioGRUK");
 assert.match(guardar,/restaurantId/);
 assert.match(guardar,/grukFetch\("\/api\/inventario"/);
 assert.match(guardar,/data\.error/);
});
