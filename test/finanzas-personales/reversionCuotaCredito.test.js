"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),express=require("express"),fs=require("node:fs"),vm=require("node:vm");
const {crearReversionCuotaCredito}=require("../../modules/finanzas-personales/services/reversionCuotaCredito.handler");
const id="507f1f77bcf86cd799439011",movimientoId="507f1f77bcf86cd799439012";
test("HTTP vincula la reversión al pago exacto y a la identidad autenticada",async()=>{
 const llamadas=[],app=express();app.use(express.json());
 app.use((req,res,next)=>{if(req.get("Test-Auth"))req.personalAuth={userId:"autenticado"};next();});
 app.post("/prestamos/:id/cuotas/deshacer",crearReversionCuotaCredito({aplicar:async(usuario,prestamoId,datos)=>{
  llamadas.push({usuario,prestamoId,datos});if(datos.idempotencyKey==="fallo")throw Error("Detalle privado de MongoDB");return {duplicado:false};
 }}));
 const server=app.listen(0,"127.0.0.1");
 try{
  await new Promise(resolve=>server.once("listening",resolve));
  const request=(body={movimientoId},headers={"Test-Auth":"1","Idempotency-Key":"reverso"})=>fetch(`http://127.0.0.1:${server.address().port}/prestamos/${id}/cuotas/deshacer`,{
   method:"POST",headers:{"Content-Type":"application/json",...headers},body:JSON.stringify(body)
  });
  assert.equal((await request({movimientoId},{})).status,401);
  assert.equal((await request({},undefined)).status,400);
  assert.equal((await request({movimientoId},{"Test-Auth":"1"})).status,400);assert.equal(llamadas.length,0);
  const ok=await request({movimientoId,usuarioId:"ajeno",montoPagadoRealMinor:1});
  assert.equal(ok.status,200);assert.match(ok.headers.get("cache-control"),/no-store/);
  assert.deepEqual(llamadas[0],{usuario:"autenticado",prestamoId:id,datos:{movimientoId,idempotencyKey:"reverso"}});
  const fail=await request({movimientoId},{"Test-Auth":"1","Idempotency-Key":"fallo"});
  assert.equal(fail.status,500);assert.doesNotMatch(await fail.text(),/MongoDB|privado/);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
const src=fs.readFileSync(require.resolve("../../public/finanzas-personales.js"),"utf8");
function entorno(api){
 const helpers=src.slice(src.indexOf("const mutacionesMovimientoEnCurso="),src.indexOf("window.editMovement="));
 const inicio=src.indexOf("window.deshacerUltimaCuota=");
 const accion=src.slice(inicio,src.indexOf("\n};",inicio)+3);
 let claves=0;
 const context={window:{},token:"sesion",api,load:async()=>{},alert:()=>{},confirm:()=>true,crypto:{randomUUID:()=>"clave_"+(++claves)},encodeURIComponent};
 vm.runInNewContext(helpers+"\n"+accion,context);return context.window;
}
test("interfaz conserva pago y clave tras fallo de red, sin elegir otra cuota al reintentar",async()=>{
 const llamadas=[],window=entorno(async(path,op)=>{llamadas.push(op);if(llamadas.length===1)throw TypeError("red");});
 await window.deshacerUltimaCuota(id,movimientoId);await window.deshacerUltimaCuota(id,movimientoId);
 assert.equal(llamadas.length,2);assert.deepEqual(JSON.parse(llamadas[0].body),{movimientoId});
 assert.equal(llamadas[0].body,llamadas[1].body);
 assert.equal(llamadas[0].headers["Idempotency-Key"],llamadas[1].headers["Idempotency-Key"]);
});
test("interfaz evita doble clic y exige el identificador del pago mostrado",async()=>{
 let resolver,llamadas=0;const window=entorno(async()=>{llamadas++;await new Promise(r=>{resolver=r;});});
 await window.deshacerUltimaCuota(id);assert.equal(llamadas,0);
 const primero=window.deshacerUltimaCuota(id,movimientoId);await window.deshacerUltimaCuota(id,movimientoId);
 assert.equal(llamadas,1);resolver();await primero;
});
