"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {eventoCompensatorio}=require("../../modules/finanzas-personales/services/eventoCompensatorioPersonal.service");
const {flujoCompensadoPuro}=require("../../modules/finanzas-personales/services/flujoCompensadoPersonal.service");
const usuarioId="507f1f77bcf86cd799439011",genesis="0".repeat(64);
const fechaISO="2026-10-20T15:00:00.000Z";
const periodo={usuarioId,desde:"2026-10-01T00:00:00.000Z",hasta:"2026-11-01T00:00:00.000Z"};
const gasto={_id:"507f1f77bcf86cd799439012",usuarioId,tipo:"GASTO",
 montoMinor:25000,concepto:"Rappi",categoria:"Comida",moneda:"COP",
 fecha:"2026-10-20T15:00:00.000Z",estado:"ACTIVA"};
const ingreso={...gasto,_id:"507f1f77bcf86cd799439013",tipo:"INGRESO",
 montoMinor:100000,concepto:"Pago",categoria:"Salario"};
const descriptor=m=>({usuarioId,movimientoId:m._id,tipo:m.tipo,
 montoMinor:m.montoMinor,concepto:m.concepto,categoria:m.categoria});
function crear(original,tipo,cambios,idempotencyKey,secuencia,prevHash){
 return eventoCompensatorio({original,tipo,cambios,idempotencyKey,secuencia,
  prevHash,fechaISO});
}
test("corrige gasto por eventos sin mutar asiento original y calcula saldo neto exacto",()=>{
 const e=crear(descriptor(gasto),"CORRECCION",{montoMinor:22000},"corregir",1,genesis);
 const resultado=flujoCompensadoPuro({...periodo,movimientos:[gasto,ingreso],eventos:[e]});
 assert.deepEqual(resultado,{ingresosMinor:100000,gastosMinor:22000,
  pagosDeudaMinor:0,flujoNetoMinor:78000,moneda:"COP",
  fuente:"EVENTOS_COMPENSATORIOS_VERIFICADOS"});
 assert.equal(gasto.montoMinor,25000);
});
test("una anulación posterior excluye el importe y mantiene otros movimientos",()=>{
 const a=crear(descriptor(gasto),"CORRECCION",{montoMinor:22000},"primera",1,genesis);
 const b=crear({...descriptor(gasto),montoMinor:22000},"ANULACION",{},"segunda",2,a.hashActual);
 const res=flujoCompensadoPuro({...periodo,movimientos:[gasto,ingreso],eventos:[a,b]});
 assert.equal(res.flujoNetoMinor,100000);
 assert.equal(res.gastosMinor,0);
});
test("permite cambiar tipo del movimiento mediante evento válido",()=>{
 const e=crear(descriptor(gasto),"CORRECCION",{tipo:"INGRESO",montoMinor:5000},"tipo",1,genesis);
 const r=flujoCompensadoPuro({...periodo,movimientos:[gasto,ingreso],eventos:[e]});
 assert.equal(r.ingresosMinor,105000);
 assert.equal(r.gastosMinor,0);
});
test("rechaza asiento adulterado, cambio de usuario y compensación huérfana",()=>{
 const e=crear(descriptor(gasto),"CORRECCION",{montoMinor:22000},"corr",1,genesis);
 for(const movimientos of [
  [{...gasto,montoMinor:25001}],
  [{...gasto,usuarioId:"usuario_ajeno"}],
  [ingreso]
 ])assert.throws(()=>flujoCompensadoPuro({...periodo,movimientos,eventos:[e]}),/INTEGRIDAD_LEDGER/);
});
test("rechaza hash manipulado, movimiento duplicado y montos no enteros",()=>{
 const e=crear(descriptor(gasto),"CORRECCION",{montoMinor:22000},"corr",1,genesis);
 assert.throws(()=>flujoCompensadoPuro({...periodo,movimientos:[gasto],eventos:[{...e,hashActual:"f".repeat(64)}]}),/INTEGRIDAD_LEDGER/);
 assert.throws(()=>flujoCompensadoPuro({...periodo,movimientos:[gasto,gasto]}),/INTEGRIDAD_LEDGER/);
 assert.throws(()=>flujoCompensadoPuro({...periodo,movimientos:[{...gasto,montoMinor:0.1}]}),/INTEGRIDAD_LEDGER/);
});
test("movimientos fuera de periodo no afectan el resumen y se rechazan fechas inválidas",()=>{
 const fuera={...ingreso,fecha:"2026-11-02T00:00:00.000Z"};
 assert.equal(flujoCompensadoPuro({...periodo,movimientos:[gasto,fuera]}).flujoNetoMinor,-25000);
 assert.throws(()=>flujoCompensadoPuro({...periodo,movimientos:[{...gasto,fecha:"inválida"}]}),/INTEGRIDAD_LEDGER/);
 assert.throws(()=>flujoCompensadoPuro({...periodo,hasta:periodo.desde,movimientos:[]}),/Periodo inválido/);
});

test("AJUSTE_SALDO es conciliación patrimonial, no ingreso ni gasto del período",()=>{
 const ajuste={...gasto,_id:"507f1f77bcf86cd799439014",tipo:"AJUSTE_SALDO",
  concepto:"Conciliación",montoMinor:50000};
 const r=flujoCompensadoPuro({...periodo,movimientos:[gasto,ajuste,ingreso]});
 assert.equal(r.ingresosMinor,100000);
 assert.equal(r.gastosMinor,25000);
 assert.equal(r.flujoNetoMinor,75000);
});

test("detecta anulación legada sobre asiento previamente compensado",()=>{
 const e=crear(descriptor(gasto),"CORRECCION",{montoMinor:22000},"doble_estado",1,genesis);
 assert.throws(()=>flujoCompensadoPuro({...periodo,
  movimientos:[{...gasto,estado:"ANULADA"}],eventos:[e]}),
  /INTEGRIDAD_LEDGER: movimiento original alterado/);
});
test("no oculta estados históricos desconocidos ni acepta doble anulación",()=>{
 assert.throws(()=>flujoCompensadoPuro({...periodo,
  movimientos:[{...gasto,estado:"BORRADA"}]}),
  /INTEGRIDAD_LEDGER: estado de movimiento inválido/);
 const e=crear(descriptor(gasto),"ANULACION",{},"anular_con_evento",1,genesis);
 assert.equal(flujoCompensadoPuro({...periodo,movimientos:[gasto],eventos:[e]}).gastosMinor,0);
});

test("anulación no esconde fecha, moneda ni monto histórico adulterados",()=>{
 const e=crear(descriptor(gasto),"ANULACION",{},"anulado_verificado",1,genesis);
 for(const cambio of [
  {fecha:"inválida"},{moneda:"USD"},{montoMinor:0},{montoMinor:0.5}
 ]){
  assert.throws(()=>flujoCompensadoPuro({...periodo,
   movimientos:[{...gasto,...cambio}],eventos:[e]}),/INTEGRIDAD_LEDGER/);
 }
});
test("filtro del período no esconde corrupción en otros meses",()=>{
 const fuera={...ingreso,fecha:"2026-11-02T00:00:00.000Z"};
 for(const cambio of [{montoMinor:-10},{montoMinor:0.1},{moneda:"USD"}]){
  assert.throws(()=>flujoCompensadoPuro({...periodo,
   movimientos:[gasto,{...fuera,...cambio}]}),/INTEGRIDAD_LEDGER/);
 }
});
test("anulación heredada también comprueba metadatos antes de descartarse",()=>{
 assert.throws(()=>flujoCompensadoPuro({...periodo,
  movimientos:[{...gasto,estado:"ANULADA",fecha:"incorrecta"}]}),
  /INTEGRIDAD_LEDGER: fecha inválida/);
});

test("una obligación recurrente sin impacto de caja no figura como gasto pagado",()=>{
 const pendiente={...gasto,_id:"507f1f77bcf86cd799439015",
  recurrente:true,impactoCaja:false,montoMinor:500000,concepto:"Arriendo"};
 const pago={...gasto,_id:"507f1f77bcf86cd799439016",
  recurrente:false,recurrenteOrigenId:pendiente._id,impactoCaja:true,
  montoMinor:200000,concepto:"Abono arriendo"};
 const r=flujoCompensadoPuro({...periodo,movimientos:[pendiente,pago]});
 assert.equal(r.gastosMinor,200000);
 assert.equal(r.flujoNetoMinor,-200000);
});
test("asiento sin impacto de caja no puede recibir compensación monetaria",()=>{
 const e=crear(descriptor(gasto),"CORRECCION",{montoMinor:22000},"sin_impacto",1,genesis);
 assert.throws(()=>flujoCompensadoPuro({...periodo,
  movimientos:[{...gasto,impactoCaja:false}],eventos:[e]}),
  /INTEGRIDAD_LEDGER: compensación sobre asiento sin impacto/);
});
test("rechaza indicador de caja adulterado incluso fuera del período",()=>{
 const fuera={...ingreso,impactoCaja:"false",fecha:"2026-12-05T12:00:00.000Z"};
 assert.throws(()=>flujoCompensadoPuro({...periodo,movimientos:[fuera]}),
  /INTEGRIDAD_LEDGER: indicador de impacto/);
});
