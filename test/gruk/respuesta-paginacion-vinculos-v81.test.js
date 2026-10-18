"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {crearConsultaVinculosHistoricosV81}=require("../../modules/finanzas-personales/services/consultaVinculosHistoricosV81.handler");
const usuario="507f1f77bcf86cd799439011";
const cursor="507f1f77bcf86cd799439013";
async function invocar(query,principal={verificado:true,userId:usuario}){
 let llamadas=0,recibido;
 const req={query,personalAuth:principal};
 const res={statusCode:200,body:null,headers:{},
  set(k,v){this.headers[k]=v;return this;},
  status(n){this.statusCode=n;return this;},json(x){this.body=x;return this;}};
 await crearConsultaVinculosHistoricosV81(async(id,args)=>{
  llamadas++;recibido={id,args};
  return {soloLectura:true,truncado:false,siguienteCursor:null,movimientos:[]};
 })(req,res);
 return {res,llamadas,recibido};
}
test("paginación válida mantiene identidad autenticada y evita caché",async()=>{
 const {res,llamadas,recibido}=await invocar({limite:"20",cursor});
 assert.equal(res.statusCode,200);
 assert.equal(res.headers["Cache-Control"],"no-store");
 assert.equal(llamadas,1);
 assert.deepEqual(recibido,{id:usuario,args:{limite:20,cursor}});
});
test("rechaza coerciones ambiguas de límite sin consultar base",async()=>{
 for(const limite of ["0","01","001","1e2","2.0"," 2 ","101","-1","",[],["1"],null,100]){
  const {res,llamadas}=await invocar({limite});
  assert.equal(res.statusCode,400,String(limite));
  assert.equal(llamadas,0,String(limite));
 }
});
test("cursor malformado y parámetros ajenos bloqueados",async()=>{
 for(const q of [{cursor:"invalido"},{cursor:""},{cursor:["507f1f77bcf86cd799439013"]},
  {usuarioId:"507f1f77bcf86cd799439099"},{cursor,admin:true}]){
  const {res,llamadas}=await invocar(q);
  assert.equal(res.statusCode,400);
  assert.equal(llamadas,0);
 }
});
test("sesión sin verificar nunca consulta datos de otro usuario",async()=>{
 const {res,llamadas}=await invocar({limite:"1"},{verificado:false,userId:usuario});
 assert.equal(res.statusCode,401);
 assert.equal(llamadas,0);
});
