"use strict";
const test=require("node:test");const assert=require("node:assert/strict");
const interprete=require("../../modules/finanzas-personales/services/interpreteFinanciero.service");
const colombia=require("../../modules/finanzas-personales/services/colombiaFinanciero.service");
const patrimonioPersonal=require("../../modules/finanzas-personales/services/patrimonioPersonal.service");
const finanzas=require("../../modules/finanzas-personales/services/finanzasPersonales.service");
const home=require("../../modules/finanzas-personales/services/homePersonal.service");
const authorizationRisk=require("../../modules/finanzas-personales/services/authorizationRisk.service");
const decisionProof=require("../../modules/finanzas-personales/services/decisionProof.service");
test("colombianismos monetarios exactos",()=>{assert.equal(interprete.interpretarSegmento("gasté 25 lucas en Rappi").montoMinor,25000);assert.equal(interprete.interpretarSegmento("recibí 3 palos de salario").montoMinor,3000000);assert.equal(interprete.interpretarSegmento("me pagaron medio palo").montoMinor,500000);});
test("gasto hormiga colombiano",()=>{assert.equal(colombia.clasificar("me gasté 18 lucas en un cafecito","GASTO"),"Gastos hormiga");assert.equal(colombia.clasificar("pagué el SOAT","GASTO"),"Gastos fijos");});
test("no inventa monto aproximado",()=>{const x=interprete.interpretarSegmento("gasté más o menos 30 lucas");assert.equal(x.montoMinor,0);assert.equal(x.estado,"REQUIERE_REVISION");});
test("cuenta por cobrar no se convierte en ingreso",()=>{const x=interprete.cuentaPorCobrar("Juan me debe 50 lucas");assert.equal(x.tipo,"CUENTA_POR_COBRAR");assert.equal(x.montoMinor,50000);});

test("fecha Colombia produce una fecha válida",()=>{const d=colombia.fechaColombia(0);assert.equal(Number.isNaN(d.getTime()),false);});

test("decimales colombianos se escalan sin float",()=>{assert.equal(interprete.interpretarSegmento("recibí 1.5 millones de salario").montoMinor,1500000);assert.equal(interprete.interpretarSegmento("gasté 2,5 lucas en café").montoMinor,2500);});
test("monto corto sin unidad exige revisión",()=>{const x=interprete.interpretarSegmento("gasté 20 en bus");assert.equal(x.estado,"REQUIERE_REVISION");assert.match(x.razonRevision,/ambiguo/i);});
test("vocabulario colombiano adicional",()=>{assert.equal(colombia.clasificar("hice un rebusque","INGRESO"),"Salario");assert.equal(colombia.clasificar("pagué el pagadiario","GASTO"),"Deuda");assert.equal(colombia.clasificar("compré mecato","GASTO"),"Gastos hormiga");});

test("clasificación no confunde transporte Didi con Didi Food",()=>{assert.equal(colombia.clasificar("pagué un Didi para ir al trabajo","GASTO"),"Gastos variables");assert.equal(colombia.clasificar("pedí Didi Food","GASTO"),"Gastos hormiga");});

test("parser canónico expuesto conserva semántica colombiana",()=>{assert.equal(interprete.parseMontoExacto("2,5 lucas"),2500);assert.equal(interprete.parseMontoExacto("1.5 millones"),1500000);assert.equal(interprete.parseMontoExacto("más o menos 30 lucas"),null);});
test("monto ambiguo desnudo no se vuelve treinta mil",()=>{const x=interprete.interpretarSegmento("gasté 30 en bus");assert.equal(x.montoMinor,30);assert.equal(x.estado,"REQUIERE_REVISION");});

test("corte mensual corresponde a medianoche Colombia",()=>{const d=new Date("2026-10-01T04:30:00.000Z");assert.equal(home._fechas.monthStart(d).toISOString(),"2026-09-01T05:00:00.000Z");assert.equal(home._fechas.nextMonth(d).toISOString(),"2026-10-01T05:00:00.000Z");});
test("fecha civil Colombia conserva fin de febrero",()=>{assert.equal(home._fechas.fechaCivilColombia(2027,2,31).toISOString(),"2027-02-28T05:00:00.000Z");});

test("flujo real GRUK no descuenta saldo total de deuda",()=>{const x=home.calcularFlujoMes({ingresosMinor:74000,gastosMinor:10000,pagosDeudaRegistradosMinor:0,cuotasVencenMesMinor:1000000});assert.equal(x.flujoRealizadoMinor,64000);assert.equal(x.cuotasPendientesMesMinor,1000000);assert.equal(x.flujoProyectadoMesMinor,-936000);});
test("cuota pagada no se descuenta dos veces",()=>{const x=home.calcularFlujoMes({ingresosMinor:1500000,gastosMinor:100000,pagosDeudaRegistradosMinor:1000000,cuotasVencenMesMinor:1000000});assert.equal(x.cuotasPendientesMesMinor,0);assert.equal(x.flujoRealizadoMinor,400000);assert.equal(x.flujoProyectadoMesMinor,400000);});


test("parser reconoce millón singular y millones plural sin confundir mil",()=>{assert.equal(interprete.parseMontoExacto("1 millón"),1000000);assert.equal(interprete.parseMontoExacto("1.5 millones"),1500000);assert.equal(interprete.parseMontoExacto("2,5 millones"),2500000);assert.equal(interprete.parseMontoExacto("2,5 lucas"),2500);});

test("compra con tarjeta de crédito no reduce caja realizada",()=>{assert.equal(home.gastoAfectaCaja({tipo:"GASTO",medioPago:"CREDITO",montoMinor:200000}),false);});
test("gasto en débito o efectivo sí reduce caja realizada",()=>{assert.equal(home.gastoAfectaCaja({tipo:"GASTO",medioPago:"DEBITO",montoMinor:200000}),true);assert.equal(home.gastoAfectaCaja({tipo:"GASTO",medioPago:"EFECTIVO",montoMinor:200000}),true);});
test("pago de tarjeta no se clasifica como gasto de consumo",()=>{assert.equal(home.gastoAfectaCaja({tipo:"PAGO_DEUDA",medioPago:"DEBITO",montoMinor:200000}),false);});

test("saldo verificado tiene autoridad contable",()=>{const x=home.resolverSaldoAsesor({saldoVerificado:true,liquidezMinor:45000,fuenteLiquidez:"CUENTAS"});assert.equal(x.montoMinor,45000);assert.equal(x.confiabilidad,"VERIFICADO");assert.equal(x.requiereReconciliacion,false);});
test("ledger sin ancla se identifica como reconstrucción pendiente",()=>{const x=home.resolverSaldoAsesor({saldoVerificado:false,hayMovimientosLedger:true,saldoDerivadoLedgerMinor:45000,liquidezMinor:0});assert.equal(x.montoMinor,45000);assert.equal(x.confiabilidad,"RECONSTRUIDO_SIN_ANCLA");assert.equal(x.requiereReconciliacion,true);});

test("resumen financiero comparte la semántica canónica de caja",()=>{assert.equal(finanzas.gastoAfectaCaja({tipo:"GASTO",medioPago:"CREDITO"}),false);assert.equal(finanzas.gastoAfectaCaja({tipo:"GASTO",medioPago:"DEBITO"}),true);assert.equal(finanzas.gastoAfectaCaja({tipo:"PAGO_DEUDA",medioPago:"DEBITO"}),false);});

test("ledger patrimonial aplica delta de caja exactamente una vez",()=>{assert.equal(patrimonioPersonal.deltaCaja({tipo:"INGRESO",montoMinor:74000,medioPago:"TRANSFERENCIA"}),74000);assert.equal(patrimonioPersonal.deltaCaja({tipo:"GASTO",montoMinor:10000,medioPago:"DEBITO"}),-10000);assert.equal(patrimonioPersonal.deltaCaja({tipo:"GASTO",montoMinor:200000,medioPago:"CREDITO"}),0);assert.equal(patrimonioPersonal.deltaCaja({tipo:"PAGO_DEUDA",montoMinor:1000000,medioPago:"DEBITO"}),-1000000);});

test("saldo reconciliado evoluciona solo con deltas posteriores",()=>{const x=patrimonioPersonal.saldoDesdeAncla(45000,[{tipo:"INGRESO",montoMinor:20000,medioPago:"TRANSFERENCIA"},{tipo:"GASTO",montoMinor:5000,medioPago:"DEBITO"},{tipo:"GASTO",montoMinor:30000,medioPago:"CREDITO"},{tipo:"PAGO_DEUDA",montoMinor:10000,medioPago:"DEBITO"}]);assert.equal(x,50000);});

test("cada cuenta respeta su propia fecha de reconciliación",()=>{const cuentas=[{nombre:"Nequi",saldoAnclaMinor:45000,saldoAnclaEn:new Date("2026-10-01T00:00:00Z")},{nombre:"Banco",saldoAnclaMinor:100000,saldoAnclaEn:new Date("2026-10-03T00:00:00Z")}];const movimientos=[{cuenta:"Nequi",tipo:"INGRESO",montoMinor:20000,medioPago:"TRANSFERENCIA",fecha:new Date("2026-10-02T00:00:00Z")},{cuenta:"Banco",tipo:"GASTO",montoMinor:10000,medioPago:"DEBITO",fecha:new Date("2026-10-02T00:00:00Z")},{cuenta:"Banco",tipo:"GASTO",montoMinor:5000,medioPago:"DEBITO",fecha:new Date("2026-10-04T00:00:00Z")}];assert.equal(patrimonioPersonal.saldoCuentasDesdeAnclas(cuentas,movimientos),160000);});

test("Disponible Hoy usa una sola fórmula exacta y nunca devuelve gasto libre negativo",()=>{assert.deepEqual(home.calcularDisponibleHoy({saldoMinor:45000,gastosFijosAntesProximoIngresoMinor:1000000}),{colchonMinor:4500,baseMinor:-959500,disponibleHoyMinor:0,estaEnRojo:true});assert.deepEqual(home.calcularDisponibleHoy({saldoMinor:100001,gastosFijosAntesProximoIngresoMinor:20000}),{colchonMinor:10000,baseMinor:70001,disponibleHoyMinor:70001,estaEnRojo:false});assert.throws(()=>home.calcularDisponibleHoy({saldoMinor:1.5,gastosFijosAntesProximoIngresoMinor:0}),/enteros seguros/);});

test("acción irreversible exige verdad reconciliada, aprobación e idempotencia",()=>{const inferida={tipo:"INFERENCIA",confianza:"MEDIA",requiereReconciliacion:true};assert.equal(authorizationRisk.evaluar({accion:"PAGAR",verdades:[inferida],aprobacionExplicita:true,idempotencyKey:"pago-123456",integridadCadena:{integra:true}}).autorizada,false);const hechos=["SALDO_ORIGEN","MONTO","DESTINO"].map(evidenciaTipo=>({tipo:"HECHO",confianza:"VERIFICADO",requiereReconciliacion:false,evidenciaTipo}));assert.equal(authorizationRisk.evaluar({accion:"PAGAR",verdades:hechos,aprobacionExplicita:true,idempotencyKey:"pago-123456",integridadCadena:{integra:true}}).autorizada,true);assert.equal(authorizationRisk.evaluar({accion:"SIMULAR",verdades:[inferida]}).autorizada,true);});

test("autorización falla cerrada ante cadena ausente y acción desconocida",()=>{const hecho={tipo:"HECHO",confianza:"VERIFICADO",requiereReconciliacion:false};assert.equal(authorizationRisk.evaluar({accion:"PAGAR",verdades:[hecho],aprobacionExplicita:true,idempotencyKey:"pago-123456"}).autorizada,false);assert.deepEqual(authorizationRisk.evaluar({accion:"BORRAR_TODO",verdades:[hecho]}).motivos,["ACCION_NO_CLASIFICADA"]);});

test("prueba de decisión es determinística y detecta manipulación",()=>{const evaluacion={autorizada:true,irreversible:true,motivos:[]};const args={accion:"PAGAR",evaluacion,verdades:[{tipo:"HECHO",montoMinor:45000,fuente:"CUENTA",confianza:"VERIFICADO",requiereReconciliacion:false}],actorId:"usuario-1",corte:new Date("2026-10-05T01:00:00.000Z"),idempotencyKey:"pago-123456"};const a=decisionProof.crear(args),b=decisionProof.crear(args);assert.equal(a.hash,b.hash);assert.equal(decisionProof.verificar(a),true);assert.equal(decisionProof.verificar({...a,accion:"INVERTIR"}),false);});
