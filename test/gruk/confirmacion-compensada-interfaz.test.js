"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const fuente=fs.readFileSync(path.resolve(__dirname,"../../public/finanzas-personales.js"),"utf8");
const inicio=fuente.indexOf('$("saveMovimiento").onclick=async');
const fin=fuente.indexOf(';$("savePrestamo").onclick=',inicio);
assert.ok(inicio>0&&fin>inicio);
for(const [estado,texto] of [["ANULADA",/movimiento anulado/],["CORREGIDA",/ya fue corregido/]]){
 test("reintento "+estado+" conserva la clave y explica el estado sin anunciar confirmación",async()=>{
  const elementos=new Map(),llamadas=[],mensajes=[];
  const $=id=>{
   if(!elementos.has(id))elementos.set(id,{value:"",checked:false,disabled:false});
   return elementos.get(id);
  };
  for(const [id,value] of Object.entries({mMonto:"3000",mConcepto:"Gasto",mCategoria:"OTROS",
   mCuenta:"BANCO",mMedio:"TRANSFERENCIA",mFecha:"2026-10-29"}))$(id).value=value;
  let limpiezas=0,cargas=0;
  const contexto=vm.createContext({$,tipo:"GASTO",manualPayloadPendiente:null,manualExternalId:null,
   resolverIntentoManual:async()=>"clave-original",limpiarIntentoManual:()=>limpiezas++,
   body:datos=>({body:datos}),msg:(_id,texto)=>mensajes.push(texto),load:async()=>cargas++,
   api:async(url,datos)=>{
    llamadas.push({url,datos});
    if(url==="/transacciones")throw Object.assign(Error("Duplicada"),{statusCode:409});
    assert.equal(url,"/transacciones/confirmar-intento");
    return {confirmado:false,estado,existe:true};
   }});
  vm.runInContext(fuente.slice(inicio,fin),contexto);
  await $("saveMovimiento").onclick();
  assert.equal(llamadas.length,2);
  assert.equal(llamadas[0].datos.body.externalId,"clave-original");
  assert.equal(llamadas[1].datos.body.externalId,"clave-original");
  assert.equal(limpiezas,0);assert.equal(cargas,0);
  assert.equal($("saveMovimiento").disabled,false);
  assert.equal($("mMonto").value,"3000");
  assert.equal(mensajes.length,1);assert.match(mensajes[0],texto);
  assert.doesNotMatch(mensajes[0],/Movimiento confirmado|Movimiento guardado/);
 });
}
