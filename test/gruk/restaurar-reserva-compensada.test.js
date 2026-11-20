"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {crearRestauradorReserva}=require("../../modules/finanzas-personales/services/restaurarReservaCompensadaPersonal.service");
const usuarioId="507f1f77bcf86cd799439011",origenId="507f1f77bcf86cd799439012";
const fuente={_id:"507f1f77bcf86cd799439013",usuarioId,recurrenteOrigenId:origenId,tipo:"GASTO",montoMinor:60,impactoCaja:true,recurrente:false,fecha:new Date("2026-10-16T12:00:00Z")};
const origen={_id:origenId,montoMinor:100,impactoCaja:false,fecha:new Date("2026-09-15T12:00:00Z"),frecuencia:"MENSUAL"};
const indices=[{key:{usuarioId:1,origenId:1,periodoInicio:1},unique:true}];
function preparar({rows=[],indice=indices,base=origen,falloIndice=false,desfase=false}={}){
 const llamadas=[],session={inTransaction:()=>true};
 const restaurar=crearRestauradorReserva({
  TransaccionModelo:{findOne(f){assert.equal(f.usuarioId,usuarioId);assert.equal(f._id,origenId);return{
   maxTimeMS(n){assert.equal(n,5000);return this;},session(s){assert.equal(s,session);return this;},lean:async()=>base};}},
  ReservaModelo:{collection:{indexes:async()=>{if(falloIndice)throw Error("secreto");return indice;}},
   async findOneAndUpdate(f,u,op){llamadas.push({f,u,op});return desfase?null:{...f,reservadoMinor:f.reservadoMinor+u.$inc.reservadoMinor};}},
  consultar:async(f,op)=>{assert.equal(f.usuarioId,usuarioId);assert.equal(op.session,session);return rows;}
 });
 return{restaurar,session,llamadas};
}
const pago=(montoMinor=40,extra={})=>({_id:"otro",usuarioId,recurrenteOrigenId:origenId,montoMinor,impactoCaja:true,...extra});
test("restauración reserva exactamente el período y total vigente sin upsert",async()=>{
 const e=preparar({rows:[pago()]});
 const r=await e.restaurar({usuarioId,fuente,montoMinor:60,session:e.session});
 assert.equal(r.reservadoMinor,100);assert.equal(e.llamadas[0].f.reservadoMinor,40);
 assert.equal(e.llamadas[0].f.periodoInicio.toISOString(),"2026-10-15T05:00:00.000Z");
 assert.equal(e.llamadas[0].f.periodoFin.toISOString(),"2026-11-15T05:00:00.000Z");
 assert.equal(e.llamadas[0].op.upsert,undefined);
});
test("cupo ocupado o abono aún activo se rechazan antes de tocar reserva",async()=>{
 for(const rows of [[pago(41)],[pago(60,{_id:fuente._id})],[pago(40,{impactoCaja:false})],[pago(0)],[pago(40,{usuarioId:"otro"})],null]){
  const e=preparar({rows});await assert.rejects(e.restaurar({usuarioId,fuente,montoMinor:60,session:e.session}),x=>x.statusCode===409);
  assert.equal(e.llamadas.length,0);
 }
});
test("reserva ausente o distinta no se repara ni se crea",async()=>{
 const e=preparar({desfase:true});await assert.rejects(e.restaurar({usuarioId,fuente,montoMinor:60,session:e.session}),/desincronizada/);
 assert.equal(e.llamadas.length,1);
});
test("índice faltante, parcial, TTL, sparse o collation distinta falla cerrado",async()=>{
 for(const indice of [[],[{...indices[0],partialFilterExpression:{usuarioId:{$exists:true}}}],
  [{...indices[0],expireAfterSeconds:60}],[{...indices[0],sparse:true}],[{...indices[0],collation:{locale:"es"}}]]){
  const e=preparar({indice});await assert.rejects(e.restaurar({usuarioId,fuente,montoMinor:60,session:e.session}),x=>x.statusCode===503);
  assert.equal(e.llamadas.length,0);
 }
 const e=preparar({falloIndice:true});await assert.rejects(e.restaurar({usuarioId,fuente,montoMinor:60,session:e.session}),x=>x.statusCode===503&&!x.message.includes("secreto"));
});
test("exige transacción, propietario, importe exacto y origen recurrente verificable",async()=>{
 const e=preparar();await assert.rejects(e.restaurar({usuarioId,fuente,montoMinor:60}),/Transacción/);
 for(const cambio of [{usuarioId:"otro"},{montoMinor:50},{tipo:"INGRESO"},{recurrente:true},{impactoCaja:false}])
  await assert.rejects(e.restaurar({usuarioId,fuente:{...fuente,...cambio},montoMinor:60,session:e.session}),x=>x.statusCode===409);
 const sinOrigen=preparar({base:null});await assert.rejects(sinOrigen.restaurar({usuarioId,fuente,montoMinor:60,session:sinOrigen.session}),/Origen recurrente/);
});
