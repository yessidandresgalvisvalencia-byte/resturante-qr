"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {eventoCompensatorio}=require("../../modules/finanzas-personales/services/eventoCompensatorioPersonal.service");
const {crearConsultaMovimientoCompensado}=require("../../modules/finanzas-personales/services/consultaMovimientoCompensadoPersonal.service");
const usuarioId="507f1f77bcf86cd799439011",mid="507f1f77bcf86cd799439012",GENESIS="0".repeat(64);
const asiento={_id:mid,usuarioId,tipo:"GASTO",montoMinor:25000,
 concepto:"Rappi",categoria:"Comida",estado:"ACTIVA",impactoCaja:true,
 cuentaId:"507f1f77bcf86cd799439013",recurrente:false};
const original={usuarioId,movimientoId:mid,tipo:"GASTO",montoMinor:25000,
 concepto:"Rappi",categoria:"Comida"};
function evento(o,tipo,cambios,prevHash,secuencia){
 return eventoCompensatorio({original:o,tipo,cambios,
  idempotencyKey:"clave_"+secuencia,prevHash,secuencia,
  fechaISO:"2026-10-20T16:00:00.000Z"});
}
const primero=evento(original,"CORRECCION",{montoMinor:22000},GENESIS,1);
const segundo=evento({...original,montoMinor:22000},"CORRECCION",
 {concepto:"Mercado"},primero.hashActual,2);
function db({asientoActual=asiento,eventos=[],cursor=null,cuenta={
 _id:"507f1f77bcf86cd799439013",usuarioId,activa:true,
 moneda:"COP",requiereReconciliacion:false,saldoMinor:100000
}}={}){
 const cuenta={sessionCount:0,closed:0,queries:[]};
 const sesion={async withTransaction(fn){cuenta.sessionCount++;await fn();},
  async endSession(){cuenta.closed++;}};
 const query=datos=>({sort(){return this;},limit(){return this;},
  session(s){assert.equal(s,sesion);cuenta.queries.push(s);return this;},
  async lean(){return datos;}});
 return {cuenta,
  MovimientoModelo:{findOne(){return query(asientoActual);}},
  EventoModelo:{find(){return query(eventos);}},
  CuentaModelo:{findOne(){return query(cuenta);}},
  CursorModelo:{findById(){return query(cursor);}},
  nuevaSesion:async()=>sesion
 };
}
test("sin compensaciones devuelve original como versión vigente bajo snapshot",async()=>{
 const d=db();
 const r=await crearConsultaMovimientoCompensado(d)(usuarioId,mid);
 assert.deepEqual(r.original,original);
 assert.equal(r.elegibleParaCompensar,true);
 assert.equal(r.ultimaSecuencia,0);
 assert.equal(r.hashCadena,GENESIS);
 assert.equal(d.cuenta.queries.length,4);
 assert.equal(d.cuenta.closed,1);
});
test("dos cambios sucesivos conservan monto y concepto del historial",async()=>{
 const d=db({eventos:[primero,segundo],cursor:{secuencia:2,hashActual:segundo.hashActual}});
 const r=await crearConsultaMovimientoCompensado(d)(usuarioId,mid);
 assert.equal(r.original.montoMinor,22000);
 assert.equal(r.original.concepto,"Mercado");
 assert.equal(r.elegibleParaCompensar,true);
 assert.equal(r.ultimaSecuencia,2);
});
test("anulación impide nueva compensación sin borrar el histórico",async()=>{
 const anular=evento({...original,montoMinor:22000,concepto:"Mercado"},
  "ANULACION",{},segundo.hashActual,3);
 const d=db({eventos:[primero,segundo,anular],
  cursor:{secuencia:3,hashActual:anular.hashActual}});
 const r=await crearConsultaMovimientoCompensado(d)(usuarioId,mid);
 assert.equal(r.anulado,true);
 assert.equal(r.elegibleParaCompensar,false);
});
test("se niega a devolver estado si falta extremo o se adulteró original",async()=>{
 for(const args of [
  {eventos:[primero],cursor:{secuencia:2,hashActual:segundo.hashActual}},
  {eventos:[primero],cursor:null},
  {asientoActual:{...asiento,montoMinor:25001},
   eventos:[primero],cursor:{secuencia:1,hashActual:primero.hashActual}}
 ]){
  const d=db(args);
  await assert.rejects(crearConsultaMovimientoCompensado(d)(usuarioId,mid),
   e=>e.statusCode===409);
  assert.equal(d.cuenta.closed,1);
 }
});
test("rechaza consultas ajenas e identificadores inválidos",async()=>{
 const d=db({asientoActual:null}),consultar=crearConsultaMovimientoCompensado(d);
 await assert.rejects(consultar(usuarioId,mid),e=>e.statusCode===404);
 await assert.rejects(consultar("ajeno",mid),e=>e.statusCode===400);
});
test("ruta de consulta de estado protegida por autenticación personal",()=>{
 const s=fs.readFileSync(path.join(__dirname,
  "../../modules/finanzas-personales/routes.js"),"utf8");
 assert.ok(s.indexOf("router.use(auth,entitlement)")<
  s.indexOf('router.get("/v81/transacciones/:id/estado-compensado"'));
 assert.ok(s.includes("consultar(req.personalAuth.userId,req.params.id)"));
});

test("consulta no ofrece corrección de préstamo, cuota vinculada ni saldo sin conciliar",async()=>{
 for(const args of [
  {asientoActual:{...asiento,recurrenteOrigenId:"507f1f77bcf86cd799439099"}},
  {asientoActual:{...asiento,prestamoId:"507f1f77bcf86cd799439099"}},
  {asientoActual:{...asiento,recurrente:true}},
  {asientoActual:{...asiento,impactoCaja:false}},
  {cuenta:{_id:asiento.cuentaId,usuarioId,activa:true,
   moneda:"COP",requiereReconciliacion:true,saldoMinor:10000}},
  {cuenta:null}
 ]){
  const r=await crearConsultaMovimientoCompensado(db(args))(usuarioId,mid);
  assert.equal(r.elegibleParaCompensar,false);
 }
});
