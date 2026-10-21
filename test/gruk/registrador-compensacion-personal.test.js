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
 const b=await registrar(entrada("operacion_2"));
 assert.deepEqual([a.secuencia,b.secuencia],[1,2]);
 assert.equal(a.prevHash,GENESIS);
 assert.equal(b.prevHash,a.hashActual);
 assert.equal(data.cursor.secuencia,2);
 assert.equal(data.cursor.hashActual,b.hashActual);
 assert.equal(data.eventos.length,2);
 assert.equal(verificarCadena(data.eventos,{prevHash:GENESIS}),true);
 assert.equal(data.cerradas,2);
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
