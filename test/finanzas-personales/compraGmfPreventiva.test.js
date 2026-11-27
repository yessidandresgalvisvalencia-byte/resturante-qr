"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const G=require("../../modules/finanzas-personales/services/gastoInteligentePersonal.service"),H=require("../../modules/finanzas-personales/services/homePersonal.service"),fixture=require("./helpers/homeVerificadoFixture");
const ahora=new Date("2026-11-26T17:00:00Z");
async function conHome(h,fn){const old=H.obtener;H.obtener=async()=>h;try{await fn();}finally{H.obtener=old;}}
test("reserva conservadora exacta en unidades enteras, sin asumir exención",()=>{
 for(const precio of [1,249,250,251,100000,1000001,Number.MAX_SAFE_INTEGER-100000000000000]){
  const r=G.simularCompraGravada(Number.MAX_SAFE_INTEGER,precio),reserva=(BigInt(precio)*4n+999n)/1000n;
  assert.equal(BigInt(r.reservaGmfMinor),reserva);assert.equal(BigInt(r.totalSalidaMinor),BigInt(precio)+reserva);
  assert.equal(r.exencionVerificada,false);assert.equal(r.escenario,"SIMULACION_GRAVADO_NO_VERIFICADO");
 }
});
test("frontera del máximo conjunto coincide con home y un peso adicional no cabe",()=>{
 for(const saldoMinor of [1,2,10,100,1000,1000000,Number.MAX_SAFE_INTEGER]){
  const a=H.calcularDisponibleHoy({saldoMinor}),g=H.calcularEscenarioGmfGravado({saldoMinor});
  if(g.gastoMaximoSiGravadoMinor>0)assert.equal(G.simularCompraGravada(a.disponibleHoyMinor,g.gastoMaximoSiGravadoMinor).cabe,true);
  assert.equal(G.simularCompraGravada(a.disponibleHoyMinor,g.gastoMaximoSiGravadoMinor+1).cabe,false);
 }
});
test("rechaza coerción, decimales, negativos y desbordamiento del total",()=>{
 for(const p of [null,"100",0,-1,0.1,Infinity,NaN,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>G.simularCompraGravada(1000,p));
 assert.throws(()=>G.simularCompraGravada(1000,Number.MAX_SAFE_INTEGER),e=>e.statusCode===400);
});
test("precio justo no se autoriza sin verificar GMF; obligación requiere plan y no exención inventada",async()=>{
 const h=fixture(ahora),original=JSON.stringify(h),precio=h.asesor.disponibleHoyMinor;
 await conHome(h,async()=>{
  const r=await G.evaluar("propietario",{montoMinor:precio},{ahora});
  assert.equal(r.estado,"GMF_POR_VERIFICAR");assert.equal(r.restanteMinor,0);assert.equal(r.escenarioGravado.cabe,false);
  assert.equal(r.consecuenciaSiGravado.promedioDiarioMinor,0);assert.match(r.mensaje,/no autorizo/);assert.ok(r.mensaje.split("\n").length<=6);
  const obligacion=await G.evaluar("propietario",{montoMinor:precio,obligatorio:true},{ahora});assert.equal(obligacion.estado,"REQUIERE_PLAN");
 });assert.equal(JSON.stringify(h),original);
});
test("compra normal distingue restante de precio y de escenario gravado sin doble reserva",async()=>{
 const h=fixture(ahora);await conHome(h,async()=>{
  const r=await G.evaluar("propietario",{montoMinor:100000,credito:{interesesMinor:1000,cargosMinor:500,cuotas:2}},{ahora});
  assert.equal(r.estado,"CABE");assert.equal(r.restanteMinor,150000);assert.equal(r.escenarioGravado.reservaGmfMinor,400);
  assert.equal(r.escenarioGravado.restanteMinor,149600);assert.equal(r.consecuenciaSiGravado.promedioDiarioMinor,74800);
  assert.equal(r.metodos[1].costoTotalMinor,101500);assert.match(r.mensaje,/no acredita cuotas futuras cubiertas/);assert.ok(r.mensaje.split("\n").length<=6);
 });
});
test("sin evidencia de ingreso o conciliación no se divulga una simulación alternativa",async()=>{
 for(const h of [null,fixture(ahora,{saldoRequiereReconciliacion:true}),fixture(ahora,{proximoIngreso:{fecha:"2026-11-26",montoMinor:1000000}})])await conHome(h,async()=>{
  const r=await G.evaluar("propietario",{montoMinor:1},{ahora});assert.equal(r.estado,"FALTAN_DATOS");assert.deepEqual(Object.keys(r).sort(),["estado","mensaje"]);
 });
});
function ui(api){
 const vm=require("node:vm"),s=require("node:fs").readFileSync(require("node:path").join(__dirname,"../../public/finanzas-personales.js"),"utf8"),a=s.indexOf('$("evaluarCompra").onclick='),b=s.indexOf('function datosMovimientoManual',a),nodes=Object.fromEntries(["evaluarCompra","compraRespuesta","compraEstado","app","compraMonto"].map(k=>[k,{hidden:false,textContent:"",value:"250000"}])),ctx=vm.createContext({$:k=>nodes[k],token:"propietario",api,body:x=>({method:"POST",body:JSON.stringify(x)}),invalidarAutorizacionDisponible:()=>{}});
 vm.runInContext(s.slice(a,b),ctx);return{nodes,ctx,vm};
}
test("interfaz real presenta el bloqueo GMF del servicio como texto y no registra gasto",async()=>{
 await conHome(fixture(ahora),async()=>{
  const llamadas=[],v=ui(async(path,op)=>{llamadas.push({path,op});return{evaluacion:await G.evaluar("propietario",JSON.parse(op.body),{ahora})};});
  await v.nodes.evaluarCompra.onclick();assert.equal(llamadas.length,1);assert.equal(llamadas[0].path,"/gastos/evaluar");
  assert.equal(v.nodes.compraRespuesta.hidden,false);assert.match(v.nodes.compraRespuesta.textContent,/no autorizo esta compra/);
  assert.match(v.nodes.compraEstado.textContent,/ningún gasto fue registrado/);assert.equal(v.nodes.evaluarCompra.disabled,false);
 });
});
test("respuesta de compra tardía tras cambiar sesión no se muestra al otro dueño",async()=>{
 let resolver;const p=new Promise(r=>{resolver=r;}),v=ui(()=>p),pendiente=v.nodes.evaluarCompra.onclick();
 v.vm.runInContext('token="otro"',v.ctx);resolver({evaluacion:{estado:"GMF_POR_VERIFICAR",mensaje:"dato privado"}});await pendiente;
 assert.equal(v.nodes.compraRespuesta.textContent,"");assert.equal(v.nodes.compraRespuesta.hidden,true);assert.equal(v.nodes.evaluarCompra.disabled,false);
});
