"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {crearRegistroMovimientoV81}=require("../../modules/finanzas-personales/services/registroMovimientoV81.handler");
const {normalizarErrorTransaccionalV81}=require("../../modules/finanzas-personales/services/persistenciaLedgerV81.service");
const usuarioId="507f1f77bcf86cd799439011";
const entrada={id:"v81_entrada_000001",tipo:"GASTO",montoCop:"25000.30",fechaContable:"2026-01-01",timestamp:"2026-01-01T10:00:00-05:00"};
function respuesta(){
 const res={headers:{},statusCode:200,body:null};
 res.set=(key,value)=>{res.headers[key]=value;return res;};
 res.status=code=>{res.statusCode=code;return res;};
 res.json=body=>{res.body=body;return res;};
 return res;
}
async function solicitar(escribir,body=entrada,principal={verificado:true,userId:usuarioId}){
 const res=respuesta();
 await crearRegistroMovimientoV81(escribir)({personalAuth:principal,body},res);
 return res;
}
test("V81 devuelve 201 y centavos exactos sin elegir usuario en el cuerpo",async()=>{
 let persistido=null;
 const res=await solicitar(async(id,datos)=>{
  persistido={id,datos};
  return {id:datos.id,tipo:datos.tipo,montoCentavos:datos.montoCentavos,version:1,hashActual:"a".repeat(64)};
 });
 assert.equal(res.statusCode,201);
 assert.equal(res.headers["Cache-Control"],"no-store");
 assert.equal(persistido.id,usuarioId);
 assert.equal(persistido.datos.montoCentavos,2500030n);
 assert.equal(res.body.evento.montoCentavos,"2500030");
});
test("V81 responde 409 reintentable con el mismo ID al resultado incierto",async()=>{
 const err=normalizarErrorTransaccionalV81(Object.assign(new Error("write conflict"),{code:112}));
 const res=await solicitar(async()=>{throw err;});
 assert.equal(res.statusCode,409);
 assert.equal(res.headers["Cache-Control"],"no-store");
 assert.equal(res.body.codigo,"REINTENTAR_MISMO_ID");
});
test("V81 separa alteración de integridad de conflicto reintentable",async()=>{
 const res=await solicitar(async()=>{throw Object.assign(new Error("Integridad comprometida"),{statusCode:409});});
 assert.equal(res.statusCode,409);
 assert.equal(res.body.codigo,"CONFLICTO_NO_REINTENTABLE");
});
test("V81 rechaza usuario no verificado sin escribir",async()=>{
 let llamadas=0;
 const res=await solicitar(async()=>{llamadas++;},entrada,{verificado:false,userId:usuarioId});
 assert.equal(res.statusCode,401);
 assert.equal(llamadas,0);
});
test("V81 rechaza importe flotante y usuario arbitrario del cuerpo",async()=>{
 let llamadas=0;
 const escribe=async()=>{llamadas++;};
 assert.equal((await solicitar(escribe,{...entrada,montoCop:0.1})).statusCode,400);
 assert.equal((await solicitar(escribe,{...entrada,usuarioId:"507f1f77bcf86cd799439012"})).statusCode,400);
 assert.equal(llamadas,0);
});

test("V81 conserva error de validacion 400 devuelto por la persistencia",async()=>{
 const res=await solicitar(async()=>{throw Object.assign(new Error("Correccion invalida"),{statusCode:400});});
 assert.equal(res.statusCode,400);
 assert.equal(res.body.codigo,"DATOS_INVALIDOS");
 assert.equal(res.headers["Cache-Control"],"no-store");
});
test("V81 conserva rechazo de acceso 403 sin exponer detalles",async()=>{
 const res=await solicitar(async()=>{throw Object.assign(new Error("Usuario ajeno, detalle privado"),{statusCode:403});});
 assert.equal(res.statusCode,403);
 assert.equal(res.body.codigo,"ACCESO_DENEGADO");
 assert.equal(res.body.error,"Acceso denegado");
 assert.equal(res.headers["Cache-Control"],"no-store");
});
test("V81 no transforma fallas desconocidas en respuestas exitosas",async()=>{
 const res=await solicitar(async()=>{throw Object.assign(new Error("Storage failure"),{statusCode:503});});
 assert.equal(res.statusCode,500);
 assert.equal(res.body.codigo,"ERROR_INTERNO");
 assert.doesNotMatch(res.body.error,/Storage failure/);
});

test("V81 no confunde TypeError interno de persistencia con entrada inválida",async()=>{
 const res=await solicitar(async()=>{throw new TypeError("Fallo interno del adaptador Mongo");});
 assert.equal(res.statusCode,500);
 assert.equal(res.body.codigo,"ERROR_INTERNO");
 assert.equal(res.body.error,"No fue posible registrar el movimiento");
 assert.equal(res.headers["Cache-Control"],"no-store");
});
test("V81 mantiene HTTP 400 para fecha inválida antes de persistir",async()=>{
 let escrituras=0;
 const res=await solicitar(async()=>{escrituras++;}, {...entrada,fechaContable:"2026-02-30"});
 assert.equal(res.statusCode,400);
 assert.equal(res.body.codigo,"DATOS_INVALIDOS");
 assert.equal(escrituras,0);
});
