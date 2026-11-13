"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),express=require("express");
const fs=require("node:fs"),vm=require("node:vm");
const {crearReversionCuota}=require("../../modules/finanzas-personales/services/reversionCuotaCompromiso.handler");
const id="507f1f77bcf86cd799439011",movimientoId="507f1f77bcf86cd799439012";
test("HTTP exige pago exacto, clave y usuario autenticado; oculta errores internos",async()=>{
 const llamadas=[];
 const app=express();app.use(express.json());
 app.use((req,res,next)=>{if(req.get("Test-Auth"))req.personalAuth={userId:"usuario_autenticado"};next();});
 app.post("/compromisos/:id/:numero",crearReversionCuota({aplicar:async(usuario,datos)=>{
  llamadas.push({usuario,datos});if(datos.idempotencyKey==="fallo")throw Error("URI secreta de MongoDB");
  return {duplicado:false};
 }}));
 const server=app.listen(0,"127.0.0.1");
 try{
  await new Promise(resolve=>server.once("listening",resolve));
  const request=(body={movimientoId},headers={"Test-Auth":"1","Idempotency-Key":"reverso"},numero="1")=>fetch(`http://127.0.0.1:${server.address().port}/compromisos/${id}/${numero}`,{
   method:"POST",headers:{"Content-Type":"application/json",...headers},body:JSON.stringify(body)
  });
  assert.equal((await request({movimientoId},{})).status,401);
  assert.equal((await request({movimientoId},{"Test-Auth":"1"})).status,400);
  assert.equal((await request({})).status,400);
  assert.equal((await request({movimientoId},undefined,"361")).status,400);
  assert.equal(llamadas.length,0);
  const ok=await request({movimientoId,usuarioId:"ajeno",montoMinor:1});
  assert.equal(ok.status,200);assert.match(ok.headers.get("cache-control"),/no-store/);
  assert.deepEqual(llamadas[0],{usuario:"usuario_autenticado",datos:{compromisoId:id,numero:1,movimientoId,idempotencyKey:"reverso"}});
  const fallo=await request({movimientoId},{"Test-Auth":"1","Idempotency-Key":"fallo"});
  assert.equal(fallo.status,500);assert.doesNotMatch(await fallo.text(),/secreta|MongoDB/);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
const src=fs.readFileSync(require.resolve("../../public/finanzas-personales.js"),"utf8");
function entorno(api){
 const helper=src.slice(src.indexOf("const mutacionesMovimientoEnCurso="),src.indexOf("window.editMovement="));
 const accion=src.slice(src.indexOf("window.deshacerCuotaCompromiso="),src.indexOf("\nfunction invalidarIndicadoresFinancieros"));
 let n=0;
 const context={window:{},api,load:async()=>{},cargarCompromisosCuotas:async()=>{},token:"sesion",crypto:{randomUUID:()=>"clave_"+(++n)},confirm:()=>true,alert:()=>{},encodeURIComponent};
 vm.runInNewContext(helper+"\n"+accion,context);return context.window;
}
test("interfaz conserva clave de reintento y vincula la reversión al pago exacto",async()=>{
 const llamadas=[];
 const window=entorno(async(path,op)=>{llamadas.push({path,op});if(llamadas.length===1)throw TypeError("red");});
 await window.deshacerCuotaCompromiso(id,1,movimientoId);
 await window.deshacerCuotaCompromiso(id,1,movimientoId);
 assert.equal(llamadas.length,2);
 assert.equal(llamadas[0].op.headers["Idempotency-Key"],llamadas[1].op.headers["Idempotency-Key"]);
 assert.deepEqual(JSON.parse(llamadas[0].op.body),{movimientoId});
});
test("interfaz evita doble clic y no envía reversiones sin identificador de pago",async()=>{
 let resolver,llamadas=0;
 const window=entorno(async()=>{llamadas++;await new Promise(r=>{resolver=r;});});
 await window.deshacerCuotaCompromiso(id,1);
 assert.equal(llamadas,0);
 const primero=window.deshacerCuotaCompromiso(id,1,movimientoId);
 await window.deshacerCuotaCompromiso(id,1,movimientoId);
 assert.equal(llamadas,1);resolver();await primero;
});
