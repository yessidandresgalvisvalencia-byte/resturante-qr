"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {filtrar}=require("../../modules/finanzas-personales/services/historialCompensadoPersonal.service");
const row=(id,extra={})=>({_id:id,tipo:"GASTO",montoMinor:22000,concepto:"Rappi [pedido]",categoria:"Otros",fecha:new Date("2026-10-25T15:00:00Z"),estado:"ACTIVA",...extra});
const filtros={q:"",tipo:"TODOS",estado:"TODOS",pagina:1};
test("filtra importe, texto literal y estado vigentes sin exponer campos internos",()=>{
 const rows=[row("1",{metadatosCifrados:{ciphertext:"interno"}}),row("2",{estado:"ANULADA"})];
 const r=filtrar(rows,{...filtros,monto:22000,q:"[pedido]"});
 assert.equal(r.length,1);assert.equal(r[0]._id,"1");assert.equal(Object.hasOwn(r[0],"metadatosCifrados"),false);
 assert.equal(filtrar(rows,{...filtros,monto:25000}).length,0);
 assert.equal(filtrar(rows,{...filtros,estado:"ANULADA"})[0]._id,"2");
});
test("paginación estable ordena y limita después de filtrar",()=>{
 const rows=Array.from({length:45},(_,i)=>row(String(i).padStart(3,"0"),{montoMinor:i%2?1:22000}));
 const p1=filtrar(rows,{...filtros,monto:22000}),p2=filtrar(rows,{...filtros,monto:22000,pagina:2});
 assert.equal(p1.length,21);assert.equal(p2.length,3);
 assert.equal(p1[20]._id,p2[0]._id);
 assert.equal(new Set([...p1.slice(0,20),...p2].map(x=>x._id)).size,23);
});
