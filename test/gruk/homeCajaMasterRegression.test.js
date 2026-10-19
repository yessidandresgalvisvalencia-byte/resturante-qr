"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs");
const src=fs.readFileSync(require.resolve("../../modules/finanzas-personales/services/homePersonal.service"),"utf8");
test("nunca excluye gastos por nombre de producto",()=>assert.doesNotMatch(src,/\/moto\/i/));
test("cuotas pendientes compensan solamente pagos de su misma deuda",()=>{
 assert.match(src,/pagosPorDeuda\.get\(String\(d\._id\)\)/);
 assert.match(src,/Math\.max\(0,cuotaDelPeriodo/);
});
test("liquidez no conciliada no se presenta como saldo disponible",()=>{
 assert.match(src,/pat\.saldoVerificado\?pat\.liquidezMinor-cuotasPendientesMesMinor:null/);
});

test("Disponible Hoy no autoriza gasto positivo si la conciliación es insuficiente",()=>{
 const {resolverSaldoAsesor,crearDecisionDisponibleHoy}=require("../../modules/finanzas-personales/services/homePersonal.service");
 const noVerificado=resolverSaldoAsesor({
  saldoVerificado:false,liquidezMinor:850000,
  hayMovimientosLedger:true,saldoDerivadoLedgerMinor:850000
 });
 assert.equal(noVerificado.requiereReconciliacion,true);
 assert.notEqual(noVerificado.confiabilidad,"VERIFICADO");
 const decision=crearDecisionDisponibleHoy({
  disponibleHoyMinor:600000,aptoParaDisponibleHoy:false,corte:new Date("2026-10-18T12:00:00Z")
 });
 assert.equal(decision.montoMinor,0);
 assert.equal(decision.requiereReconciliacion,true);
 assert.equal(decision.confianza,"NO_VERIFICADO");
 assert.equal(decision.fuente,"SALDO_PENDIENTE_CONCILIACION");
 const apta=crearDecisionDisponibleHoy({
  disponibleHoyMinor:600000,aptoParaDisponibleHoy:true,corte:new Date("2026-10-18T12:00:00Z")
 });
 assert.equal(apta.montoMinor,600000);
});

test("la interfaz no publica Disponible Hoy sin aptitud explícita",()=>{
 const html=fs.readFileSync(require.resolve("../../public/finanzas-personales.html"),"utf8");
 const js=fs.readFileSync(require.resolve("../../public/finanzas-personales.js"),"utf8");
 assert.match(html,/id="hDisponibleHoy">Pendiente de conciliación/);
 assert.match(html,/Disponible después de compromisos \(no es autorización de gasto\)/);
 assert.match(js,/home\.asesor\?\.aptoParaDisponibleHoy===true&&Number\.isSafeInteger\(home\.asesor\?\.disponibleHoyMinor\)/);
 assert.ok(js.includes('home.asesor.disponibleHoyMinor>=0&&home.verdadFinanciera?.disponibleHoy?.montoMinor===home.asesor.disponibleHoyMinor'));
 assert.ok(js.includes('home.verdadFinanciera.disponibleHoy.requiereReconciliacion===false'));
 assert.ok(js.includes('home.verdadFinanciera.disponibleHoy.confianza==="ALTA"?money(home.asesor.disponibleHoyMinor):"Pendiente de conciliación"'));
 assert.match(js,/\["hDisponibleHoy","disponibleHoy"\]/);
 assert.match(js,/\["hDisponibleHoy","hDisponible","hComprometido"/);
});

test("un saldo marcado verificado pero inseguro jamás autoriza dinero para gastar",()=>{
 const {resolverSaldoAsesor,crearDecisionDisponibleHoy}=require("../../modules/finanzas-personales/services/homePersonal.service");
 for(const liquidezMinor of [NaN,Infinity,-1,0.1,"850000",Number.MAX_SAFE_INTEGER+1,null,undefined]){
  const estado=resolverSaldoAsesor({saldoVerificado:true,liquidezMinor});
  assert.equal(estado.confiabilidad,"NO_VERIFICADO",String(liquidezMinor));
  assert.equal(estado.montoMinor,0,String(liquidezMinor));
  assert.equal(estado.requiereReconciliacion,true);
  const decision=crearDecisionDisponibleHoy({disponibleHoyMinor:0,
   aptoParaDisponibleHoy:estado.confiabilidad==="VERIFICADO"&&!estado.requiereReconciliacion,
   corte:new Date("2026-10-18T12:00:00Z")});
  assert.equal(decision.montoMinor,0);
  assert.equal(decision.requiereReconciliacion,true);
 }
 const valido=resolverSaldoAsesor({saldoVerificado:true,liquidezMinor:850000});
 assert.equal(valido.confiabilidad,"VERIFICADO");
 assert.equal(valido.montoMinor,850000);
});

test("liquidez verificada exige anclas, saldos y fechas realmente válidos",()=>{
 const {evaluarIntegridadAnclasPersonales}=require("../../modules/finanzas-personales/services/patrimonioPersonal.service");
 const cuenta={_id:"507f1f77bcf86cd799439011",saldoMinor:500000,
  saldoAnclaMinor:400000,saldoAnclaEn:new Date("2026-10-01T12:00:00Z"),
  saldoVerificadoEn:new Date("2026-10-01T12:00:00Z"),requiereReconciliacion:false};
 const verificada=evaluarIntegridadAnclasPersonales([cuenta]);
 assert.equal(verificada.saldoVerificado,true);
 assert.equal(verificada.anclaCompleta,true);
 for(const parcial of [
  {...cuenta,saldoAnclaEn:null},
  {...cuenta,saldoAnclaEn:new Date("invalida")},
  {...cuenta,saldoAnclaMinor:0.1},
  {...cuenta,saldoVerificadoEn:null},
  {...cuenta,saldoVerificadoEn:new Date("invalida")},
  {...cuenta,saldoMinor:NaN},
  {...cuenta,saldoMinor:Number.MAX_SAFE_INTEGER+1},
  {...cuenta,requiereReconciliacion:true}
 ]){
  const estado=evaluarIntegridadAnclasPersonales([cuenta,parcial]);
  assert.equal(estado.saldoVerificado,false);
  const saldo=resolverSaldoAsesorParaPrueba(estado);
  assert.notEqual(saldo.confiabilidad,"VERIFICADO");
 }
 assert.equal(evaluarIntegridadAnclasPersonales([]).saldoVerificado,false);
});
function resolverSaldoAsesorParaPrueba(estado){
 const {resolverSaldoAsesor}=require("../../modules/finanzas-personales/services/homePersonal.service");
 return resolverSaldoAsesor({saldoVerificado:estado.saldoVerificado,
  liquidezMinor:500000,hayMovimientosLedger:false});
}

test("un movimiento huérfano con nombre coincidente nunca entra silenciosamente al saldo anclado",()=>{
 const {saldoCuentasDesdeAnclas}=require("../../modules/finanzas-personales/services/patrimonioPersonal.service");
 const cuenta={_id:"507f1f77bcf86cd799439011",nombre:"Nequi",
  saldoAnclaMinor:100000,saldoAnclaEn:new Date("2026-10-01T05:00:00Z")};
 const ingreso={cuentaId:cuenta._id,cuenta:"Nequi",fecha:new Date("2026-10-02T05:00:00Z"),
  tipo:"INGRESO",montoMinor:5000,impactoCaja:true};
 assert.equal(saldoCuentasDesdeAnclas([cuenta],[ingreso]),105000);
 const huerfano={...ingreso,cuentaId:null};
 assert.throws(()=>saldoCuentasDesdeAnclas([cuenta],[huerfano]),
  e=>e.statusCode===409&&/sin cuentaId/.test(e.message));
 assert.equal(saldoCuentasDesdeAnclas([cuenta],[{...huerfano,fecha:new Date("2026-09-30T05:00:00Z")}]),100000);
 assert.throws(()=>saldoCuentasDesdeAnclas([cuenta],[{...ingreso,cuentaId:"507f1f77bcf86cd799439012"}]),
  e=>e.statusCode===409&&/inactiva, inexistente/.test(e.message));
});
test("la suma de cuentas ancladas no admite desbordamientos de enteros seguros",()=>{
 const {saldoCuentasDesdeAnclas}=require("../../modules/finanzas-personales/services/patrimonioPersonal.service");
 const fecha=new Date("2026-10-01T05:00:00Z");
 const cuenta={_id:"507f1f77bcf86cd799439011",nombre:"Nequi",
  saldoAnclaMinor:Number.MAX_SAFE_INTEGER,saldoAnclaEn:fecha};
 assert.throws(()=>saldoCuentasDesdeAnclas([cuenta, {...cuenta,_id:"507f1f77bcf86cd799439012",saldoAnclaMinor:1}],[]),
  e=>e.statusCode===409);
});

test("un huérfano posterior a la primera ancla bloquea el saldo aunque cambie el nombre de cuenta",()=>{
 const {saldoCuentasDesdeAnclas}=require("../../modules/finanzas-personales/services/patrimonioPersonal.service");
 const cuentas=[
  {_id:"507f1f77bcf86cd799439011",nombre:"Nequi",
   saldoAnclaMinor:100000,saldoAnclaEn:new Date("2026-10-01T05:00:00Z")},
  {_id:"507f1f77bcf86cd799439012",nombre:"Banco",
   saldoAnclaMinor:250000,saldoAnclaEn:new Date("2026-10-10T05:00:00Z")}
 ];
 const huerfano={cuentaId:null,cuenta:"CUENTA DESCONOCIDA",
  fecha:new Date("2026-10-05T05:00:00Z"),tipo:"INGRESO",
  montoMinor:15000,impactoCaja:true};
 assert.throws(()=>saldoCuentasDesdeAnclas(cuentas,[huerfano]),
  e=>e.statusCode===409&&/sin cuentaId/.test(e.message));
 assert.equal(saldoCuentasDesdeAnclas(cuentas,[{
  ...huerfano,fecha:new Date("2026-09-30T05:00:00Z")
 }]),350000);
 assert.equal(saldoCuentasDesdeAnclas(cuentas,[{
  ...huerfano,cuentaId:cuentas[0]._id
 }]),365000);
});

test("cuentas inexistentes o inactivas bloquean saldos anclados en vez de desaparecer",()=>{
 const {saldoCuentasDesdeAnclas}=require("../../modules/finanzas-personales/services/patrimonioPersonal.service");
 const cuentas=[{_id:"507f1f77bcf86cd799439011",nombre:"Nequi",
  saldoAnclaMinor:100000,saldoAnclaEn:new Date("2026-10-01T05:00:00Z")}];
 const movimiento={tipo:"INGRESO",montoMinor:15000,impactoCaja:true,
  cuenta:"Cuenta cerrada",fecha:new Date("2026-10-02T05:00:00Z")};
 for(const cuentaId of ["507f1f77bcf86cd799439012","no-es-object-id"]){
  assert.throws(()=>saldoCuentasDesdeAnclas(cuentas,[{...movimiento,cuentaId}]),
   e=>e.statusCode===409&&/inactiva, inexistente/.test(e.message));
 }
 assert.equal(saldoCuentasDesdeAnclas(cuentas,[{...movimiento,
  cuentaId:cuentas[0]._id}]),115000);
 assert.equal(saldoCuentasDesdeAnclas(cuentas,[{...movimiento,
  cuentaId:"507f1f77bcf86cd799439012",fecha:new Date("2026-09-30T05:00:00Z")}]),100000);
});

test("una cuenta duplicada no puede contar dos veces su saldo anclado",()=>{
 const {saldoCuentasDesdeAnclas}=require("../../modules/finanzas-personales/services/patrimonioPersonal.service");
 const cuenta={_id:"507f1f77bcf86cd799439011",nombre:"Nequi",
  saldoAnclaMinor:100000,saldoAnclaEn:new Date("2026-10-01T05:00:00Z")};
 assert.throws(()=>saldoCuentasDesdeAnclas([cuenta,{...cuenta}],[]),
  e=>e.statusCode===409&&/duplicadas/.test(e.message));
 assert.throws(()=>saldoCuentasDesdeAnclas([{...cuenta,_id:"invalido"}],[]),
  e=>e.statusCode===409&&/identidad inválida/.test(e.message));
 assert.equal(saldoCuentasDesdeAnclas([cuenta],[]),100000);
});

test("la reconstrucción patrimonial nunca suma dos veces el mismo movimiento",()=>{
 const {exigirMovimientosUnicosPatrimonio,saldoCuentasDesdeAnclas}=require("../../modules/finanzas-personales/services/patrimonioPersonal.service");
 const cuenta={_id:"507f1f77bcf86cd799439011",nombre:"Nequi",
  saldoAnclaMinor:100000,saldoAnclaEn:new Date("2026-10-01T05:00:00Z")};
 const mov={_id:"507f1f77bcf86cd799439021",cuentaId:cuenta._id,
  fecha:new Date("2026-10-02T05:00:00Z"),tipo:"INGRESO",montoMinor:5000,impactoCaja:true};
 assert.equal(saldoCuentasDesdeAnclas([cuenta],[mov]),105000);
 assert.throws(()=>saldoCuentasDesdeAnclas([cuenta],[mov,{...mov}]),
  e=>e.statusCode===409&&/duplicados/.test(e.message));
 assert.throws(()=>exigirMovimientosUnicosPatrimonio([{...mov,_id:null}],{exigirId:true}),
  e=>e.statusCode===409&&/sin identidad/.test(e.message));
 assert.throws(()=>exigirMovimientosUnicosPatrimonio([{...mov,_id:"inválido"}],{exigirId:true}),
  e=>e.statusCode===409&&/identidad inválida/.test(e.message));
 assert.equal(exigirMovimientosUnicosPatrimonio([mov],{exigirId:true}),true);
});

test("las anclas y verificaciones futuras no autorizan Disponible Hoy",()=>{
 const {evaluarIntegridadAnclasPersonales,saldoCuentasDesdeAnclas}=require("../../modules/finanzas-personales/services/patrimonioPersonal.service");
 const cuenta={_id:"507f1f77bcf86cd799439011",nombre:"Nequi",saldoMinor:100000,
  saldoAnclaMinor:100000,saldoAnclaEn:new Date("2026-10-01T05:00:00Z"),
  saldoVerificadoEn:new Date("2026-10-01T05:00:00Z"),requiereReconciliacion:false};
 const fechaFutura=new Date("2099-01-01T00:00:00Z");
 assert.equal(evaluarIntegridadAnclasPersonales([cuenta]).saldoVerificado,true);
 const anclaFutura=evaluarIntegridadAnclasPersonales([{...cuenta,saldoAnclaEn:fechaFutura}]);
 assert.equal(anclaFutura.saldoVerificado,false);
 assert.equal(anclaFutura.anclaCompleta,false);
 assert.equal(evaluarIntegridadAnclasPersonales([{...cuenta,saldoVerificadoEn:fechaFutura}]).saldoVerificado,false);
 assert.throws(()=>saldoCuentasDesdeAnclas([{...cuenta,saldoAnclaEn:fechaFutura}],[]),
  e=>e.statusCode===409);
});

test("verificación anterior al ancla no certifica saldo de una cuenta personal",()=>{
 const {evaluarIntegridadAnclasPersonales}=require("../../modules/finanzas-personales/services/patrimonioPersonal.service");
 const instante=new Date("2026-10-01T05:00:00Z");
 const cuenta={_id:"507f1f77bcf86cd799439011",nombre:"Nequi",saldoMinor:100000,
  saldoAnclaMinor:100000,saldoAnclaEn:instante,saldoVerificadoEn:instante,
  requiereReconciliacion:false};
 assert.equal(evaluarIntegridadAnclasPersonales([cuenta]).saldoVerificado,true);
 const desactualizada={...cuenta,saldoVerificadoEn:new Date("2026-09-30T05:00:00Z")};
 const revision=evaluarIntegridadAnclasPersonales([desactualizada]);
 assert.equal(revision.anclaCompleta,true);
 assert.equal(revision.saldoVerificado,false);
 assert.equal(evaluarIntegridadAnclasPersonales([cuenta,desactualizada]).saldoVerificado,false);
 const posterior={...cuenta,saldoVerificadoEn:new Date("2026-10-02T05:00:00Z")};
 assert.equal(evaluarIntegridadAnclasPersonales([posterior]).saldoVerificado,true);
});

test("ningún movimiento futuro puede incorporarse a Disponible Hoy desde el historial",()=>{
 const {exigirFechasCajaNoFuturasPatrimonio}=require("../../modules/finanzas-personales/services/patrimonioPersonal.service");
 const pasado={fecha:new Date("2026-10-01T05:00:00Z"),tipo:"INGRESO",montoMinor:50000};
 assert.equal(exigirFechasCajaNoFuturasPatrimonio([pasado]),true);
 for(const fecha of [null,undefined,"fecha mala",new Date("invalida"),new Date("2099-01-01T00:00:00Z")]){
  assert.throws(()=>exigirFechasCajaNoFuturasPatrimonio([{...pasado,fecha}]),
   e=>e.statusCode===409&&/futuro/.test(e.message));
 }
 const source=require("node:fs").readFileSync(
  require.resolve("../../modules/finanzas-personales/services/patrimonioPersonal.service"),"utf8");
 assert.ok(source.includes("exigirFechasCajaNoFuturasPatrimonio(movimientosCaja);"));
});

test("snapshot rechaza cuentas inactivas o en moneda distinta de COP",()=>{
 const {exigirCuentasCopPatrimonio}=require("../../modules/finanzas-personales/services/patrimonioPersonal.service");
 const cuenta={_id:"507f1f77bcf86cd799439011",moneda:"COP",activa:true};
 assert.equal(exigirCuentasCopPatrimonio([cuenta]),true);
 assert.equal(exigirCuentasCopPatrimonio([]),true);
 for(const invalida of [
  {...cuenta,moneda:"USD"},{...cuenta,moneda:null},
  {...cuenta,moneda:undefined},{...cuenta,activa:false},{...cuenta,activa:null}
 ]){
  assert.throws(()=>exigirCuentasCopPatrimonio([invalida]),e=>e.statusCode===409);
 }
 const source=require("node:fs").readFileSync(
  require.resolve("../../modules/finanzas-personales/services/patrimonioPersonal.service"),"utf8");
 assert.ok(source.includes("exigirCuentasCopPatrimonio(cuentas);"));
});

test("un movimiento con el mismo instante del ancla exige conciliación",()=>{
 const {saldoCuentasDesdeAnclas}=require("../../modules/finanzas-personales/services/patrimonioPersonal.service");
 const ancla=new Date("2026-10-01T05:00:00.000Z");
 const cuenta={_id:"507f1f77bcf86cd799439011",nombre:"Nequi",saldoAnclaMinor:100000,saldoAnclaEn:ancla};
 const ingreso={_id:"507f1f77bcf86cd799439021",cuentaId:cuenta._id,
  fecha:new Date(ancla),tipo:"INGRESO",montoMinor:5000,impactoCaja:true};
 assert.throws(()=>saldoCuentasDesdeAnclas([cuenta],[ingreso]),
  e=>e.statusCode===409&&/simultáneo/.test(e.message));
 assert.equal(saldoCuentasDesdeAnclas([cuenta],[{...ingreso,fecha:new Date(ancla.getTime()-1)}]),100000);
 assert.equal(saldoCuentasDesdeAnclas([cuenta],[{...ingreso,fecha:new Date(ancla.getTime()+1)}]),105000);
});

test("montos monetarios no admiten coerción y convierten texto decimal entero exactamente",()=>{
 const {safeMontoPatrimonial}=require("../../modules/finanzas-personales/services/patrimonioPersonal.service");
 assert.equal(safeMontoPatrimonial(1000),1000);
 assert.equal(safeMontoPatrimonial("1000"),1000);
 assert.equal(safeMontoPatrimonial("0001000"),1000);
 assert.equal(safeMontoPatrimonial("9007199254740991"),Number.MAX_SAFE_INTEGER);
 for(const monto of [null,false,true,{},[],1.5,NaN,Infinity,-1,"-1","1.5","1e3"," 1000","1000 ","9007199254740992"]){
  assert.throws(()=>safeMontoPatrimonial(monto),e=>e.statusCode===400,String(monto));
 }
 const source=require("node:fs").readFileSync(
  require.resolve("../../modules/finanzas-personales/services/patrimonioPersonal.service"),"utf8");
 assert.ok(source.includes("data.saldoMinor===undefined?0:data.saldoMinor"));
});

test("cuotas de préstamo nulas no se convierten silenciosamente en cero",()=>{
 const {safeMontoPatrimonial}=require("../../modules/finanzas-personales/services/patrimonioPersonal.service");
 const fuente=require("node:fs").readFileSync(
  require.resolve("../../modules/finanzas-personales/services/patrimonioPersonal.service"),"utf8");
 assert.ok(fuente.includes("cuotaMinor:safe(data.cuotaMinor===undefined?0:data.cuotaMinor)"));
 assert.equal(safeMontoPatrimonial(0),0);
 assert.equal(safeMontoPatrimonial("0"),0);
 for(const valor of [null,false,"",NaN,-1,1.5]){
  assert.throws(()=>safeMontoPatrimonial(valor),e=>e.statusCode===400);
 }
});

test("préstamos y transferencias no admiten saldos desbordados en cuentas",()=>{
 const {exigirSaldoCuentaSeguro}=require("../../modules/finanzas-personales/services/patrimonioPersonal.service");
 assert.equal(exigirSaldoCuentaSeguro({saldoMinor:0}),0);
 assert.equal(exigirSaldoCuentaSeguro({saldoMinor:Number.MAX_SAFE_INTEGER}),Number.MAX_SAFE_INTEGER);
 for(const cuenta of [null,{}, {saldoMinor:-1},{saldoMinor:0.5},
  {saldoMinor:Number.MAX_SAFE_INTEGER+1},{saldoMinor:NaN},{saldoMinor:Infinity}]){
  assert.throws(()=>exigirSaldoCuentaSeguro(cuenta),e=>e.statusCode===409);
 }
 const fuente=require("node:fs").readFileSync(
  require.resolve("../../modules/finanzas-personales/services/patrimonioPersonal.service"),"utf8");
 const crearPrestamo=fuente.slice(fuente.indexOf("async function crearPrestamo("),fuente.indexOf("async function cobrarCuentaPorCobrar("));
 const transferir=fuente.slice(fuente.indexOf("async function transferir("),fuente.indexOf("function sumaPatrimonialSegura("));
 assert.ok(crearPrestamo.includes("exigirSaldoCuentaSeguro(cuenta);"));
 assert.ok(transferir.includes("exigirSaldoCuentaSeguro(origen);"));
 assert.ok(transferir.includes("exigirSaldoCuentaSeguro(destino);"));
});

test("transferencia propia audita ambas cuentas e invalida anclas sin crear ingreso ficticio",()=>{
 const fs=require("node:fs");
 const source=fs.readFileSync(require.resolve("../../modules/finanzas-personales/services/patrimonioPersonal.service"),"utf8");
 const inicio=source.indexOf("async function transferir(");
 const fin=source.indexOf("function sumaPatrimonialSegura(",inicio);
 const transfer=source.slice(inicio,fin);
 assert.ok(inicio>=0&&fin>inicio);
 assert.match(transfer,/\$inc:\{saldoMinor:-monto\},\$set:\{requiereReconciliacion:true\}/);
 assert.match(transfer,/\$inc:\{saldoMinor:monto\},\$set:\{requiereReconciliacion:true\}/);
 assert.ok(transfer.includes('eventName:"MOVIMIENTO_PATRIMONIAL"'));
 assert.ok(transfer.includes('aggregateType:"TRANSFERENCIA_PROPIA"'));
 assert.ok(transfer.includes('origenId:String(origen._id),destinoId:String(destino._id),montoMinor:monto'));
 assert.ok(transfer.includes("},{session})"));
 assert.ok(!transfer.includes("Transaccion.create("),"la transferencia propia no debe disfrazarse de ingreso ni gasto");
 assert.ok(transfer.includes("requiereReconciliacion:true};"));
});
