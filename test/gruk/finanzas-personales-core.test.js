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

test("acción irreversible exige verdad reconciliada, aprobación e idempotencia",()=>{const inferida={tipo:"INFERENCIA",confianza:"MEDIA",requiereReconciliacion:true};assert.equal(authorizationRisk.evaluar({accion:"PAGAR",verdades:[inferida],aprobacionExplicita:true,idempotencyKey:"pago-123456",integridadCadena:{integra:true,estado:"INTEGRA"}}).autorizada,false);const hechos=["SALDO_ORIGEN","MONTO","DESTINO"].map(evidenciaTipo=>({tipo:"HECHO",confianza:"VERIFICADO",requiereReconciliacion:false,evidenciaTipo}));assert.equal(authorizationRisk.evaluar({accion:"PAGAR",verdades:hechos,aprobacionExplicita:true,idempotencyKey:"pago-123456",integridadCadena:{integra:true,estado:"INTEGRA"}}).autorizada,true);assert.equal(authorizationRisk.evaluar({accion:"SIMULAR",verdades:[inferida]}).autorizada,true);});

test("autorización falla cerrada ante cadena ausente y acción desconocida",()=>{const hecho={tipo:"HECHO",confianza:"VERIFICADO",requiereReconciliacion:false};assert.equal(authorizationRisk.evaluar({accion:"PAGAR",verdades:[hecho],aprobacionExplicita:true,idempotencyKey:"pago-123456"}).autorizada,false);assert.deepEqual(authorizationRisk.evaluar({accion:"BORRAR_TODO",verdades:[hecho]}).motivos,["ACCION_NO_CLASIFICADA"]);});

test("prueba de decisión es determinística y detecta manipulación",()=>{const evaluacion={autorizada:true,irreversible:true,motivos:[]};const args={accion:"PAGAR",evaluacion,verdades:[{tipo:"HECHO",montoMinor:45000,fuente:"CUENTA",confianza:"VERIFICADO",requiereReconciliacion:false}],actorId:"usuario-1",corte:new Date("2026-10-05T01:00:00.000Z"),idempotencyKey:"pago-123456"};const a=decisionProof.crear(args),b=decisionProof.crear(args);assert.equal(a.hash,b.hash);assert.equal(decisionProof.verificar(a),true);assert.equal(decisionProof.verificar({...a,accion:"INVERTIR"}),false);});


test("DecisionProof verifica persistencia sin hashear metadata y falla cerrado ante manipulación",()=>{
 const evaluacion={autorizada:true,irreversible:true,motivos:[]};
 const original=decisionProof.crear({accion:"PAGAR",evaluacion,verdades:[{tipo:"HECHO",confianza:"VERIFICADO"}],actorId:"actor-1",corte:"2026-10-05T00:00:00.000Z",idempotencyKey:"proof-123456"});
 assert.equal(decisionProof.verificar(original),true);
 const persistido={...original,_id:"mongo-id",usuarioId:"usuario-id",createdAt:new Date(),updatedAt:new Date(),previousHash:"a".repeat(64)};
 assert.equal(decisionProof.verificar(persistido),true);
 assert.equal(decisionProof.verificar({...persistido,accion:"TRANSFERIR"}),false);
 for(const hash of [null,"zz","a".repeat(63),"g".repeat(64)])assert.equal(decisionProof.verificar({...persistido,hash}),false);
});


test("DecisionProof idempotencia semántica distingue misma intención de conflicto",()=>{
 const persistence=require("../../modules/finanzas-personales/services/decisionProofPersistence.service");
 const base={accion:"PAGAR",evaluacion:{autorizada:true,irreversible:true,motivos:[]},verdades:[{tipo:"HECHO",confianza:"VERIFICADO",evidenciaTipo:"MONTO",montoMinor:1000}],actorId:"actor-1",idempotencyKey:"idem-123456"};
 const fp=persistence.fingerprint(base);
 assert.equal(persistence.fingerprint({...base}),fp);
 assert.notEqual(persistence.fingerprint({...base,accion:"TRANSFERIR"}),fp);
 assert.equal(persistence.resolverExistente({requestFingerprint:fp,hash:"a".repeat(64)},fp).hash,"a".repeat(64));
 assert.throws(()=>persistence.resolverExistente({requestFingerprint:fp},"b".repeat(64)),e=>e.code==="IDEMPOTENCY_KEY_CONFLICT");
});


test("Bloque 1 falla cerrado: hecho ambiguo nunca queda listo ni se inventa como gasto contable",()=>{const x=interprete.interpretarSegmento("se movieron 80 lucas");assert.equal(x.tipo,"POR_CLASIFICAR");assert.equal(x.estado,"REQUIERE_REVISION");assert.match(x.razonRevision,/naturaleza financiera/i);});
test("Bloque 1: saldo existente es reconciliación y no ingreso",()=>{const x=interprete.interpretarSegmento("En mi billetera tengo 312000 pesos en efectivo, que no había registrado.");assert.equal(x.tipo,"AJUSTE_SALDO");assert.equal(x.montoMinor,312000);assert.notEqual(x.tipo,"INGRESO");});
test("Bloque 1: transferencia propia no es ingreso ni gasto",()=>{const x=interprete.interpretarSegmento("pasé 50 lucas de Nequi a Daviplata");assert.equal(x.tipo,"TRANSFERENCIA_PROPIA");assert.equal(x.estado,"LISTO");assert.equal(x.montoMinor,50000);});
test("Bloque 1: ahorro es movimiento patrimonial y no gasto",()=>{const x=interprete.interpretarSegmento("ahorré 100 lucas en mi cuenta de ahorro");assert.equal(x.tipo,"AHORRO_ACTIVO");assert.equal(x.montoMinor,100000);assert.notEqual(x.tipo,"GASTO");});
test("Bloque 1: compra financiada de moto crea deuda y no gasto",()=>{const x=interprete.interpretarSegmento("compré una moto de 7 millones, pago un millón cada día 15 y ya he abonado dos millones quinientos, sin interés");assert.equal(x.tipo,"DEUDA_POR_PAGAR");assert.equal(x.principalMinor,7000000);assert.equal(x.saldoMinor,4500000);assert.equal(x.cuotaMinor,1000000);assert.notEqual(x.tipo,"GASTO");});


test("Outbox acepta SALDO_RECONCILIADO para commit ACID de ajuste de saldo",()=>{const Outbox=require("../../modules/finanzas-personales/models/outboxPersonal.model");const d=new Outbox({usuarioId:"507f1f77bcf86cd799439011",eventId:"saldo-reconciliado-test",eventName:"SALDO_RECONCILIADO",aggregateId:"507f1f77bcf86cd799439012",payload:{saldoNuevoMinor:312000}});const err=d.validateSync();assert.equal(err,undefined);});


test("Context Engine reconoce seguimiento de deuda sin cambiar al resumen mensual",()=>{const ctx=require("../../modules/finanzas-personales/services/contextoPersonal.service");const x=ctx.detectarReferencia("¿Cuánto me falta?");assert.equal(x.seguimiento,true);assert.equal(x.deudaExplicita,false);});
test("Context Engine reconoce referencia explícita a la moto",()=>{const ctx=require("../../modules/finanzas-personales/services/contextoPersonal.service");const x=ctx.detectarReferencia("¿Cuánto debo de la moto?");assert.equal(x.deudaExplicita,true);assert.equal(x.seguimiento,true);});


test("ahorro existente no registrado es reconciliación patrimonial, no ingreso ni transferencia",()=>{const i=require("../../modules/finanzas-personales/services/interpreteFinanciero.service");const x=i.interpretarSegmento("Tengo 508000 como ahorro que no había registrado");assert.equal(x.tipo,"AJUSTE_SALDO_AHORRO");assert.equal(x.montoMinor,508000);assert.equal(x.estado,"LISTO");assert.equal(x.cuentaDestino,"AHORRO");});


test("parser semántico reconoce múltiples formas de declarar ahorro preexistente",()=>{
 const frases=[
  ["Tenía 508 lucas ahorradas desde antes",508000],
  ["Cuento con 508 mil de ahorro que no te había dicho",508000],
  ["Hay 508000 guardados que no estaban registrados",508000],
  ["Se me olvidó registrar 508 lucas que tenía ahorradas",508000],
  ["Tengo 508 mil de platica aparte",508000],
  ["Me quedaron 508 lucas guardadas de antes",508000],
  ["Dispongo de 508000 en un fondo que ya tenía",508000],
  ["Tengo un colchón de 508 lucas",508000]
 ];
 for(const [frase,valor] of frases){
  const x=interprete.interpretarSegmento(frase);
  assert.equal(x.tipo,"AJUSTE_SALDO_AHORRO",frase);
  assert.equal(x.montoMinor,valor,frase);
  assert.notEqual(x.tipo,"INGRESO",frase);
 }
});

test("parser semántico separa ahorro nuevo de saldo preexistente",()=>{
 for(const frase of ["Hoy ahorré 100 lucas en mi cuenta de ahorro","Ayer guardé 80 lucas en ahorro","Acabo de meter 50 lucas al fondo"]){
  const x=interprete.interpretarSegmento(frase);
  assert.notEqual(x.tipo,"AJUSTE_SALDO_AHORRO",frase);
 }
});

test("señales patrimoniales son composables y no dependen de una oración exacta",()=>{
 const s=interprete.señalesPatrimoniales("Se me pasó decir que cuento con 300 lucas de platica aparte desde antes");
 assert.equal(s.posesion,true);assert.equal(s.ahorro,true);assert.equal(s.preexistente,true);
});


test("Accounting Frame clasifica naturaleza económica antes del tipo contable",()=>{
 const frame=require("../../modules/finanzas-personales/services/semanticAccountingFrame.service");
 const casos=[
  ["Tengo 312 mil en efectivo que no había registrado",312000,"DECLARAR_SALDO","PATRIMONIO","EFECTIVO"],
  ["Tengo 508 lucas ahorradas desde antes",508000,"DECLARAR_SALDO","PATRIMONIO","AHORRO"],
  ["Carlos me debe 500 lucas",500000,"DECLARAR_CUENTA_POR_COBRAR","PATRIMONIO","CUENTA_POR_COBRAR"],
  ["Pasé 100 lucas de Nequi a Bancolombia",100000,"TRANSFERIR","TRASPASO","CUENTA_PROPIA"],
  ["Pagué 200 lucas de la deuda",200000,"PAGAR_OBLIGACION","PASIVO","DEUDA"],
  ["Debo 7 millones de la moto",7000000,"DECLARAR_OBLIGACION","PASIVO","DEUDA"],
  ["Me pagaron 500 lucas por un servicio",500000,"RECIBIR","FLUJO","DINERO"],
  ["Gasté 25 lucas en almuerzo",25000,"CONSUMIR","FLUJO","DINERO"]
 ];
 for(const [texto,monto,acto,naturaleza,entidad] of casos){
  const x=frame.construirFrame(texto,{montoMinor:monto});
  assert.equal(x.acto,acto,texto);assert.equal(x.naturaleza,naturaleza,texto);assert.equal(x.entidad,entidad,texto);assert.deepEqual(x.faltantes,[],texto);
 }
});

test("Accounting Frame falla cerrado cuando no conoce la naturaleza",()=>{
 const frame=require("../../modules/finanzas-personales/services/semanticAccountingFrame.service");
 const x=frame.construirFrame("Se movieron 80 lucas",{montoMinor:80000});
 assert.equal(x.naturaleza,"NO_CLASIFICADO");
 assert.equal(x.acto,"NO_IDENTIFICADO");
 assert.deepEqual(x.faltantes,["NATURALEZA"]);
});

test("Accounting Frame distingue consulta de hecho financiero",()=>{
 const frame=require("../../modules/finanzas-personales/services/semanticAccountingFrame.service");
 const x=frame.construirFrame("¿Cuánto debo de la moto?",{montoMinor:null});
 assert.equal(x.acto,"CONSULTAR");assert.equal(x.naturaleza,"NO_CLASIFICADO");assert.deepEqual(x.faltantes,[]);
});
