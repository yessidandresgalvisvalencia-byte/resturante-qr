"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {crearRegistrador,verificarIndices,exigirIndices,GENESIS}=
 require("../../modules/finanzas-personales/services/registradorCompensacionPersonal.service");
const {verificarCadena}=require("../../modules/finanzas-personales/services/eventoCompensatorioPersonal.service");
const original={usuarioId:"507f1f77bcf86cd799439011",movimientoId:"507f1f77bcf86cd799439012",
 tipo:"GASTO",montoMinor:25000,concepto:"Rappi",categoria:"Alimentacion"};
const fechaISO="2026-10-20T15:00:00.000Z";
function bancoSimulado({colision=false,repetido=false,romperInsercion=false,asientoAusente=false,asientoAjeno=false,asientoAlterado=false,asientoAnulado=false,sinImpactoCaja=false}={}){
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
  find(filter){
   let limite=Infinity;
   const consulta={
    sort(){return consulta;},
    limit(n){limite=n;return consulta;},
    session(){return consulta;},
    async lean(){
     return staged.eventos.filter(e=>e.usuarioId===filter.usuarioId)
      .sort((a,b)=>a.secuencia-b.secuencia).slice(0,limite);
    }
   };
   return consulta;
  },
  findOne(filter){
   const leer=async()=>filter.idempotencyKey!==undefined?
     (repetido?{idempotencyKey:filter.idempotencyKey}:staged.eventos.find(e=>e.idempotencyKey===filter.idempotencyKey)||null):
     ([...staged.eventos].reverse().find(e=>e.usuarioId===filter.usuarioId&&(filter.movimientoId===undefined||e.movimientoId===filter.movimientoId))||null);
   return {sort(){return {session(){return {lean:leer};}};},
    session(){return {lean:leer};}};
  },
  async create(rows){
   if(romperInsercion)throw new Error("Fallo de inserción");
   staged.eventos.push(...rows);return rows;
  }
 };
 const ModeloTransaccion={
  findOne(filter){
   return {session(){return {lean:async()=>{
    if(asientoAusente||asientoAjeno||String(filter._id)!==original.movimientoId||
       String(filter.usuarioId)!==original.usuarioId)return null;
    return {_id:original.movimientoId,usuarioId:original.usuarioId,
     tipo:original.tipo,montoMinor:asientoAlterado?25001:original.montoMinor,
     concepto:original.concepto,categoria:original.categoria,
     estado:asientoAnulado?"ANULADA":"ACTIVA",impactoCaja:!sinImpactoCaja};
   }};}};
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
 const registrar=crearRegistrador({EventoModelo:ModeloEvento,CursorModelo:ModeloCursor,TransaccionModelo:ModeloTransaccion,nuevaSesion,
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

test("un segundo evento con importe obsoleto se rechaza dentro del snapshot",async()=>{
 const {data,registrar}=bancoSimulado();
 await registrar(entrada("primero"));
 await assert.rejects(registrar(entrada("segundo")),/Movimiento desactualizado/);
 assert.equal(data.eventos.length,1);
 assert.equal(data.cursor.secuencia,1);
});
test("una anulación cierra permanentemente el movimiento para nuevas compensaciones",async()=>{
 const {data,registrar}=bancoSimulado();
 await registrar({...entrada("anular"),tipo:"ANULACION",cambios:{}});
 await assert.rejects(registrar(entrada("corregir_despues")),/Movimiento anulado/);
 await assert.rejects(registrar({...entrada("anular_dos"),tipo:"ANULACION",cambios:{}}),/Movimiento anulado/);
 assert.equal(data.eventos.length,1);
});

test("no registra compensación con cursor avanzado y último evento ausente",async()=>{
 const {data,registrar}=bancoSimulado();
 await registrar(entrada("corr_1"));
 data.eventos.length=0;
 await assert.rejects(registrar({...entrada("corr_2"),original:{...original,montoMinor:22000},cambios:{montoMinor:20000}}),
  /Cursor y cadena compensatoria completa desincronizados/);
 assert.equal(data.cursor.secuencia,1);
 assert.equal(data.eventos.length,0);
});
test("bloquea evento borrado conservando cursor en génesis",async()=>{
 const {data,registrar}=bancoSimulado();
 await registrar(entrada("corr_1"));
 data.cursor={_id:original.usuarioId,secuencia:0,hashActual:GENESIS};
 await assert.rejects(registrar(entrada("corr_2")),/Cursor y cadena compensatoria completa desincronizados/);
 assert.equal(data.eventos.length,1);
});
test("no acepta último evento manipulado aunque cursor coincida con su hash",async()=>{
 const {data,registrar}=bancoSimulado();
 await registrar(entrada("corr_1"));
 data.eventos[0]={...data.eventos[0],deltaCajaMinor:"123456"};
 await assert.rejects(registrar({...entrada("corr_2"),original:{...original,montoMinor:22000},cambios:{montoMinor:20000}}),
  /Cursor y cadena compensatoria completa desincronizados/);
 assert.equal(data.eventos.length,1);
});

test("no avanza el cursor si se ha eliminado una compensación intermedia",async()=>{
 const {data,registrar}=bancoSimulado();
 await registrar(entrada("primera"));
 await registrar({...entrada("segunda"),original:{...original,montoMinor:22000},
  cambios:{montoMinor:20000}});
 data.eventos.splice(0,1);
 await assert.rejects(registrar({...entrada("tercera"),original:{...original,montoMinor:20000},
  cambios:{montoMinor:19000}}),/cadena compensatoria completa desincronizados/);
 assert.equal(data.cursor.secuencia,2);
 assert.equal(data.eventos.length,1);
});
test("no avanza el cursor si el hash de un evento intermedio fue manipulado",async()=>{
 const {data,registrar}=bancoSimulado();
 await registrar(entrada("primera"));
 await registrar({...entrada("segunda"),original:{...original,montoMinor:22000},
  cambios:{montoMinor:20000}});
 data.eventos[0]={...data.eventos[0],deltaCajaMinor:"999999"};
 await assert.rejects(registrar({...entrada("tercera"),original:{...original,montoMinor:20000},
  cambios:{montoMinor:19000}}),/cadena compensatoria completa desincronizados/);
 assert.equal(data.cursor.secuencia,2);
});

test("rechaza movimiento ausente o de otro usuario sin insertar evento",async()=>{
 for(const opciones of [{asientoAusente:true},{asientoAjeno:true}]){
  const {data,registrar}=bancoSimulado(opciones);
  await assert.rejects(registrar(entrada("sin_asiento")),/Movimiento original inexistente o ajeno/);
  assert.equal(data.eventos.length,0);
  assert.equal(data.cursor,null);
 }
});
test("bloquea compensación si el importe persistido difiere del original",async()=>{
 const {data,registrar}=bancoSimulado({asientoAlterado:true});
 await assert.rejects(registrar(entrada("alterado")),/Movimiento original distinto al ledger/);
 assert.equal(data.eventos.length,0);
 assert.equal(data.cursor,null);
});
test("bloquea un original proporcionado con campos financieros inventados",async()=>{
 const {data,registrar}=bancoSimulado();
 await assert.rejects(registrar({...entrada("inventado"),original:{...original,montoMinor:999}}),
  /Movimiento original distinto al ledger/);
 assert.equal(data.eventos.length,0);
});

test("no compensa movimiento ya anulado por legado o sin impacto de caja",async()=>{
 for(const opciones of [{asientoAnulado:true},{sinImpactoCaja:true}]){
  const {data,registrar}=bancoSimulado(opciones);
  await assert.rejects(registrar(entrada("sin_caja")),/Movimiento original ya alterado o sin impacto/);
  assert.equal(data.cursor,null);
  assert.equal(data.eventos.length,0);
 }
});
