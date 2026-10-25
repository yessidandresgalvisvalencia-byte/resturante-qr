"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {crearRegistrador,verificarIndices,exigirIndices,GENESIS}=
 require("../../modules/finanzas-personales/services/registradorCompensacionPersonal.service");
const {verificarCadena}=require("../../modules/finanzas-personales/services/eventoCompensatorioPersonal.service");
const original={usuarioId:"507f1f77bcf86cd799439011",movimientoId:"507f1f77bcf86cd799439012",
 tipo:"GASTO",montoMinor:25000,concepto:"Rappi",categoria:"Alimentacion"};
const fechaISO="2026-10-20T15:00:00.000Z";
function bancoSimulado({colision=false,repetido=false,romperInsercion=false}={}){
 const data={cursor:null,eventos:[],cerradas:0,abortadas:0,indices:0};
 let staged=null;
 const ModeloCursor={
  findById(){return {session(){return {lean:async()=>staged.cursor};}};},
  async create(rows){staged.cursor={...rows[0]};return rows;},
  async findOneAndUpdate(filter,update){
   if(colision||!staged.cursor||staged.cursor.secuencia!==filter.secuencia||
      staged.cursor.hashActual!==filter.hashActual)return null;
   staged.cursor={...staged.cursor,...update.$set};
   return staged.cursor;
  }
 };
 const ModeloEvento={
  find(filter){return {sort(){return {session(){return {lean:async()=>
   staged.eventos.filter(e=>e.usuarioId===filter.usuarioId&&e.movimientoId===filter.movimientoId)
    .sort((a,b)=>a.secuencia-b.secuencia)};}};}};},
  findOne(filter){return {session(){return {lean:async()=>
   repetido?{idempotencyKey:filter.idempotencyKey}:staged.eventos.find(e=>e.idempotencyKey===filter.idempotencyKey)||null};}};},
  async create(rows){
   if(romperInsercion)throw new Error("Fallo de inserción");
   staged.eventos.push(...rows);return rows;
  }
 };
 const nuevaSesion=async()=>({
  async withTransaction(fn){
   staged={cursor:data.cursor&&{...data.cursor},eventos:[...data.eventos]};
   try{await fn();data.cursor=staged.cursor;data.eventos=staged.eventos;}
   catch(error){data.abortadas++;throw error;}
  },
  async endSession(){data.cerradas++;}
 });
 const registrar=crearRegistrador({EventoModelo:ModeloEvento,CursorModelo:ModeloCursor,nuevaSesion,
  revisarIndices:async()=>{data.indices++;}});
 return {data,registrar};
}
const entrada=(key="operacion_1")=>({original,tipo:"CORRECCION",
 cambios:{montoMinor:22000},idempotencyKey:key,fechaISO});
test("primer evento crea cursor y evento; segundo enlaza hash y secuencia",async()=>{
 const {data,registrar}=bancoSimulado();
 const a=await registrar(entrada("operacion_1"));
 const b=await registrar({...entrada("operacion_2"),original:{...original,montoMinor:22000},cambios:{montoMinor:20000}});
 assert.deepEqual([a.secuencia,b.secuencia],[1,2]);
 assert.equal(a.prevHash,GENESIS);
 assert.equal(b.prevHash,a.hashActual);
 assert.equal(data.cursor.secuencia,2);
 assert.equal(data.cursor.hashActual,b.hashActual);
 assert.equal(data.eventos.length,2);
 assert.equal(verificarCadena(data.eventos,{prevHash:GENESIS}),true);
 assert.equal(data.cerradas,2);
});
test("corrección con estado obsoleto aborta sin agregar eventos ni avanzar cursor",async()=>{
 const {data,registrar}=bancoSimulado();
 const primero=await registrar(entrada());
 await assert.rejects(registrar(entrada("otra_clave")),/desactualizado/);
 assert.equal(data.eventos.length,1);
 assert.equal(data.cursor.hashActual,primero.hashActual);
});
test("anulación usa el importe vigente y bloquea nuevos reversos con otra clave",async()=>{
 const {data,registrar}=bancoSimulado();
 await registrar(entrada());
 const solicitud={...entrada("anular"),original:{...original,montoMinor:22000},tipo:"ANULACION",cambios:{}};
 const reverso=await registrar(solicitud);
 assert.equal(reverso.deltaCajaMinor,"22000");
 await assert.rejects(registrar({...solicitud,idempotencyKey:"anular_otra"}),/ya anulado/);
 await assert.rejects(registrar({...entrada("corregir_anulada"),original:solicitud.original}),/ya anulado/);
 assert.equal(data.eventos.length,2);
 assert.equal(data.cursor.hashActual,reverso.hashActual);
});
test("clave idempotente repetida aborta sin avanzar la cadena",async()=>{
 const {data,registrar}=bancoSimulado();
 await registrar(entrada());
 await assert.rejects(registrar(entrada()),/Idempotencia ya utilizada/);
 assert.equal(data.cursor.secuencia,1);
 assert.equal(data.eventos.length,1);
 assert.equal(data.abortadas,1);
 assert.equal(data.cerradas,2);
});
test("historial alterado bloquea la escritura antes de avanzar el cursor",async()=>{
 const {data,registrar}=bancoSimulado();
 await registrar(entrada());
 data.eventos[0]={...data.eventos[0],deltaCajaMinor:"999999"};
 const hash=data.cursor.hashActual;
 await assert.rejects(registrar({...entrada("otra"),original:{...original,montoMinor:22000}}),/INTEGRIDAD_LEDGER/);
 assert.equal(data.eventos.length,1);
 assert.equal(data.cursor.hashActual,hash);
});
test("una anulación no bloquea un movimiento distinto del mismo usuario",async()=>{
 const {data,registrar}=bancoSimulado();
 await registrar({...entrada("anular"),tipo:"ANULACION",cambios:{}});
 await registrar({...entrada("distinto"),original:{...original,movimientoId:"otro_movimiento"}});
 assert.equal(data.eventos.length,2);
 assert.equal(data.cursor.secuencia,2);
});
test("una actualización concurrente del cursor impide insertar evento huérfano",async()=>{
 const {data,registrar}=bancoSimulado({colision:true});
 await assert.rejects(registrar(entrada()),/Cadena financiera modificada concurrentemente/);
 assert.equal(data.cursor,null);
 assert.equal(data.eventos.length,0);
 assert.equal(data.abortadas,1);
 assert.equal(data.cerradas,1);
});
test("un fallo de insert revierte el cursor y cierra sesión",async()=>{
 const {data,registrar}=bancoSimulado({romperInsercion:true});
 await assert.rejects(registrar(entrada()),/Fallo de inserción/);
 assert.equal(data.cursor,null);
 assert.equal(data.eventos.length,0);
 assert.equal(data.cerradas,1);
});
test("se rechazan operaciones sin usuario o idempotencia antes de consultar índices",async()=>{
 const {data,registrar}=bancoSimulado();
 await assert.rejects(registrar({...entrada(),original:{...original,usuarioId:" "}}),/Usuario e idempotencia/);
 await assert.rejects(registrar({...entrada(),original:{...original,movimientoId:undefined}}),/Usuario e idempotencia/);
 await assert.rejects(registrar({...entrada(),idempotencyKey:" "}),/Usuario e idempotencia/);
 assert.equal(data.indices,0);
});
test("el verificador exige índices únicos exactos y falla cerrado sin conexión",async()=>{
 const idx=[
  {name:"fp_compensacion_idempotencia_usuario_v1",unique:true,key:{usuarioId:1,idempotencyKey:1}},
  {name:"fp_compensacion_orden_usuario_v1",unique:true,key:{usuarioId:1,secuencia:1}}
 ];
 assert.equal(verificarIndices(idx,"fp_compensacion_orden_usuario_v1",[["usuarioId",1],["secuencia",1]]),true);
 assert.equal(verificarIndices([{...idx[1],unique:false}],"fp_compensacion_orden_usuario_v1",[["usuarioId",1],["secuencia",1]]),false);
 for(const opciones of [{partialFilterExpression:{secuencia:{$gt:100}}},{sparse:true}]){
  const incompleto={...idx[1],...opciones};
  assert.equal(verificarIndices([incompleto],"fp_compensacion_orden_usuario_v1",[["usuarioId",1],["secuencia",1]]),false);
  await assert.rejects(exigirIndices({
   EventoModelo:{collection:{indexes:async()=>[idx[0],incompleto]}},
   CursorModelo:{collection:{indexes:async()=>[{name:"_id_",unique:true,key:{_id:1}}]}}
  }),/Falta un índice único/);
 }
 const CursorModelo={collection:{indexes:async()=>[{name:"_id_",unique:true,key:{_id:1}}]}};
 const EventoModelo={collection:{indexes:async()=>idx}};
 await exigirIndices({EventoModelo,CursorModelo});
 await assert.rejects(exigirIndices({
  EventoModelo:{collection:{indexes:async()=>idx.slice(0,1)}},CursorModelo
 }),/Falta un índice único/);
 await assert.rejects(exigirIndices({
  EventoModelo:{collection:{indexes:async()=>{throw Error("sin mongo");}}},CursorModelo
 }),/no verificables/);
});
