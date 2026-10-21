"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {crearConsultaFlujoCompensado,LIMITE}=
 require("../../modules/finanzas-personales/services/consultaFlujoCompensadoPersonal.service");
const usuarioId="507f1f77bcf86cd799439011";
const monto={_id:"507f1f77bcf86cd799439012",usuarioId,tipo:"GASTO",montoMinor:1000,
 concepto:"Café",categoria:"Hormiga",moneda:"COP",estado:"ACTIVA",
 fecha:"2026-10-20T11:00:00.000Z"};
function modelos({movimientos=[monto],eventos=[],cursor=null}={}){
 const filtros=[],sesiones=[],estado={cerradas:0,transacciones:0};
 function query(datos){
  const q={limit(n){filtros.push(n);return q;},sort(){return q;},
   session(session){sesiones.push(session);return q;},async lean(){return datos;}};
  return q;
 }
 const nuevaSesion=async()=>({
  async withTransaction(fn){estado.transacciones++;await fn();},
  async endSession(){estado.cerradas++;}
 });
 return {filtros,sesiones,estado,nuevaSesion,
  TransaccionModelo:{find(){return query(movimientos);}},
  EventoModelo:{find(){return query(eventos);}},
  CursorModelo:{findById(){return query(cursor);}}};
}
const periodo={desde:"2026-10-01",hasta:"2026-11-01"};
test("consulta compensada produce neto exacto sin recuperar otro usuario",async()=>{
 const db=modelos();const consultar=crearConsultaFlujoCompensado(db);
 const r=await consultar(usuarioId,periodo);
 assert.equal(r.flujoNetoMinor,-1000);
 assert.deepEqual(db.filtros,[LIMITE+1,LIMITE+1]);
});
test("consulta falla cerrada cuando los datos exceden el máximo verificable",async()=>{
 for(const datos of [
  {movimientos:Array.from({length:LIMITE+1},()=>monto)},
  {eventos:Array.from({length:LIMITE+1},()=>({}))}
 ]){
  const consultar=crearConsultaFlujoCompensado(modelos(datos));
  await assert.rejects(()=>consultar(usuarioId,periodo),e=>e.statusCode===503);
 }
});
test("consulta bloquea periodo e identidad inválidos antes de leer datos",async()=>{
 const consultar=crearConsultaFlujoCompensado(modelos());
 await assert.rejects(()=>consultar("ajeno",periodo),e=>e.statusCode===400);
 await assert.rejects(()=>consultar(usuarioId,{desde:"2026-11-01",hasta:"2026-10-01"}),e=>e.statusCode===400);
 await assert.rejects(()=>consultar(usuarioId,{}),e=>e.statusCode===400);
});
test("endpoint personal de flujo compensado está detrás de autenticación global",()=>{
 const rutas=fs.readFileSync(path.join(__dirname,
  "../../modules/finanzas-personales/routes.js"),"utf8");
 const auth=rutas.indexOf("router.use(auth,entitlement);");
 const endpoint=rutas.indexOf('router.get("/v81/flujo-compensado"');
 assert.ok(auth>=0&&endpoint>auth);
 assert.ok(rutas.slice(endpoint,endpoint+650).includes("req.personalAuth.userId"));
});

test("consulta movimientos, cadena y cursor bajo la misma sesión snapshot",async()=>{
 const db=modelos(),consultar=crearConsultaFlujoCompensado(db);
 await consultar(usuarioId,periodo);
 assert.equal(db.estado.transacciones,1);
 assert.equal(db.estado.cerradas,1);
 assert.equal(db.sesiones.length,3);
 assert.equal(new Set(db.sesiones).size,1);
});
test("si faltan eventos respecto al cursor no devuelve flujo parcial",async()=>{
 const db=modelos({cursor:{secuencia:1,hashActual:"a".repeat(64)}});
 await assert.rejects(()=>crearConsultaFlujoCompensado(db)(usuarioId,periodo),
  e=>e.statusCode===409&&/cursor y eventos desincronizados/.test(e.message));
 assert.equal(db.estado.cerradas,1);
});
test("bloquea historial con eventos sin cursor",async()=>{
 const db=modelos({eventos:[{secuencia:1}]});
 await assert.rejects(()=>crearConsultaFlujoCompensado(db)(usuarioId,periodo),
  e=>e.statusCode===409&&/eventos sin cursor/.test(e.message));
});
