"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {GENESIS,crearEvento,verificarCadena}=require("../../modules/finanzas-personales/services/cadenaEventosV81.service");
const base={userId:"507f1f77bcf86cd799439011",tipo:"GASTO",montoCentavos:2500030n,fechaContable:"2026-10-17",timestamp:"2026-10-17T12:00:00-05:00"};
const uno=crearEvento({...base,id:"m1",version:1},GENESIS);
const dos=crearEvento({...base,id:"m2",montoCentavos:9900n,version:2},uno.hashActual);
const tres=crearEvento({...base,id:"m3",montoCentavos:1n,version:3},dos.hashActual);
test("V81 cadena válida anclada a cabeza",()=>{
 assert.equal(verificarCadena([uno,dos,tres],tres.hashActual),true);
});
test("V81 rechaza borrado intermedio con hash final intacto",()=>{
 assert.equal(verificarCadena([uno,tres],tres.hashActual),false);
});
test("V81 rechaza monto alterado, orden cambiado y cabeza falsa",()=>{
 assert.equal(verificarCadena([uno,{...dos,montoCentavos:9901n},tres],tres.hashActual),false);
 assert.equal(verificarCadena([dos,uno,tres],tres.hashActual),false);
 assert.equal(verificarCadena([uno,dos,tres],"f".repeat(64)),false);
});
test("V81 rechaza mezcla de usuarios y cadena vacía",()=>{
 assert.equal(verificarCadena([uno,{...dos,userId:"507f1f77bcf86cd799439012"},tres],tres.hashActual),false);
 assert.equal(verificarCadena([],GENESIS),false);
});
test("V81 hash determinista y aritmética exacta BigInt",()=>{
 assert.equal(crearEvento({...base,id:"m1",version:1}).hashActual,uno.hashActual);
 assert.equal(uno.montoCentavos+dos.montoCentavos+1n,2509931n);
});
