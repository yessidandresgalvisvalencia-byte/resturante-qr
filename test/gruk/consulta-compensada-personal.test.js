"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {proyectar}=require("../../modules/finanzas-personales/services/consultaCompensadaPersonal.service");
const {eventoCompensatorio}=require("../../modules/finanzas-personales/services/eventoCompensatorioPersonal.service");
const usuarioId="usuario_1",original={usuarioId,movimientoId:"m1",tipo:"GASTO",montoMinor:25000,concepto:"Rappi",categoria:"Alimentacion"};
const fuente={...original,_id:"m1",estado:"ACTIVA",fecha:"2026-10-25",cuentaId:"cuenta_1"};
const e=eventoCompensatorio({original,tipo:"CORRECCION",cambios:{montoMinor:22000,categoria:"Otros"},idempotencyKey:"k1",prevHash:"0".repeat(64),secuencia:1,fechaISO:"2026-10-25T15:00:00.000Z"});
const entrada={usuarioId,fuentes:[fuente],eventos:[e],cursor:{_id:usuarioId,secuencia:1,hashActual:e.hashActual}};
test("lectura reconstruye importe y categoría sin alterar fuente ni metadatos",()=>{
 const [r]=proyectar(entrada);assert.equal(r.montoMinor,22000);assert.equal(r.categoria,"Otros");
 assert.equal(r.cuentaId,"cuenta_1");assert.equal(fuente.montoMinor,25000);assert.equal(Object.isFrozen(r),true);
});
test("lectura detecta cadena truncada, cursor alterado, fuente alterada e identidad ajena",()=>{
 for(const x of [{eventos:[]},{cursor:null},{cursor:{...entrada.cursor,secuencia:2}},
  {fuentes:[{...fuente,montoMinor:999}]},{fuentes:[{...fuente,usuarioId:"otro"}]},
  {eventos:[{...e,usuarioId:"otro"}]}])assert.throws(()=>proyectar({...entrada,...x}),/INTEGRIDAD_LEDGER/);
});
test("anulación se proyecta conservando el documento original",()=>{
 const a=eventoCompensatorio({original:{...original,...e.cambios},tipo:"ANULACION",cambios:{},idempotencyKey:"k2",prevHash:e.hashActual,secuencia:2,fechaISO:e.fechaISO});
 const [r]=proyectar({...entrada,eventos:[e,a],cursor:{_id:usuarioId,secuencia:2,hashActual:a.hashActual}});
 assert.equal(r.estado,"ANULADA");assert.equal(fuente.estado,"ACTIVA");
});
test("lectura sin compensaciones mantiene estado histórico",()=>{
 assert.deepEqual(proyectar({...entrada,eventos:[],cursor:null}),[fuente]);
});
test("V4 valida el pago real y mantiene su devolución en la fecha del evento",()=>{
 const {originalDesdeFuente}=require("../../modules/finanzas-personales/services/eventoCompensatorioPersonal.service");
 const {proyectarCaja}=require("../../modules/finanzas-personales/services/consultaCompensadaPersonal.service");
 const src={...fuente,tipo:"PAGO_DEUDA",prestamoId:"507f1f77bcf86cd799439011",descripcion:"Cuota 1 confirmada",montoMinor:400,montoPagadoRealMinor:450,impactoCaja:true,medioPago:"TRANSFERENCIA"};
 const evento=eventoCompensatorio({original:originalDesdeFuente(src),tipo:"ANULACION",idempotencyKey:"credito",prevHash:"0".repeat(64),secuencia:1,fechaISO:e.fechaISO});
 const datos={usuarioId,fuentes:[src],eventos:[evento],cursor:{_id:usuarioId,secuencia:1,hashActual:evento.hashActual}};
 const caja=proyectarCaja(datos);
 assert.equal(proyectar(datos)[0].estado,"ANULADA");assert.equal(src.estado,"ACTIVA");
 assert.equal(caja[1].montoMinor,450);assert.equal(caja[1].fecha.toISOString(),evento.fechaISO);
 assert.throws(()=>proyectar({...datos,fuentes:[{...src,montoPagadoRealMinor:451}]}),/INTEGRIDAD_LEDGER/);
});
test("cobro de trabajo V3 cambia el informe de ingreso sin alterar el flujo original de caja",()=>{
 const {proyectarCaja}=require("../../modules/finanzas-personales/services/consultaCompensadaPersonal.service");
 const orig={...original,tipo:"COBRO_PRESTAMO"};
 const evento=eventoCompensatorio({original:orig,tipo:"CORRECCION",cambios:{tipo:"INGRESO",categoria:"Trabajo cobrado"},idempotencyKey:"trabajo",prevHash:"0".repeat(64),secuencia:1,fechaISO:e.fechaISO});
 const src={...fuente,...orig,prestamoId:"prestamo_1",impactoCaja:true,medioPago:"TRANSFERENCIA"};
 const datos={usuarioId,fuentes:[src],eventos:[evento],cursor:{_id:usuarioId,secuencia:1,hashActual:evento.hashActual}};
 assert.equal(proyectar(datos)[0].tipo,"INGRESO");
 assert.equal(src.tipo,"COBRO_PRESTAMO");
 assert.deepEqual(proyectarCaja(datos),[src]);
 assert.throws(()=>proyectar({...datos,fuentes:[{...src,montoMinor:26000}]}),/INTEGRIDAD_LEDGER/);
});
test("reversión V2 de cuota preserva la salida original y fecha la devolución",()=>{
 const {proyectarCaja}=require("../../modules/finanzas-personales/services/consultaCompensadaPersonal.service");
 for(const impactoCaja of [true,false]){
  const orig={...original,tipo:"PAGO_DEUDA",impactoCaja};
  const evento=eventoCompensatorio({original:orig,tipo:"ANULACION",idempotencyKey:"cuota",prevHash:"0".repeat(64),secuencia:1,fechaISO:e.fechaISO});
  const src={...fuente,...orig,medioPago:impactoCaja?"TRANSFERENCIA":"OTRO"};
  const datos={usuarioId,fuentes:[src],eventos:[evento],cursor:{_id:usuarioId,secuencia:1,hashActual:evento.hashActual}};
  assert.equal(proyectar(datos)[0].estado,"ANULADA");assert.equal(src.estado,"ACTIVA");
  const caja=proyectarCaja(datos);
  assert.equal(caja.length,impactoCaja?2:1);
  if(impactoCaja){assert.equal(caja[1].montoMinor,25000);assert.equal(caja[1].fecha.toISOString(),evento.fechaISO);}
  assert.throws(()=>proyectar({...datos,fuentes:[{...src,impactoCaja:!impactoCaja}]}),/INTEGRIDAD_LEDGER/);
 }
});
test("saldo desde un ancla anterior a la corrección incluye el delta en su fecha real",()=>{
 const mongoose=require("mongoose");
 const {proyectarCaja}=require("../../modules/finanzas-personales/services/consultaCompensadaPersonal.service");
 const {saldoCuentasDesdeAnclas}=require("../../modules/finanzas-personales/services/patrimonioPersonal.service");
 const cuentaId=new mongoose.Types.ObjectId(),id=new mongoose.Types.ObjectId();
 const orig={...original,movimientoId:String(id)};
 const evento=eventoCompensatorio({original:orig,tipo:"CORRECCION",cambios:{montoMinor:22000},idempotencyKey:"ajuste_ancla",prevHash:"0".repeat(64),secuencia:1,fechaISO:"2026-10-25T15:00:00.000Z"});
 const datos={usuarioId,fuentes:[{...orig,_id:id,cuentaId,cuenta:"CAJA",fecha:new Date("2026-10-23T15:00:00Z"),estado:"ACTIVA",impactoCaja:true,medioPago:"EFECTIVO"}],eventos:[evento],cursor:{_id:usuarioId,secuencia:1,hashActual:evento.hashActual}};
 const rows=proyectarCaja(datos);
 assert.equal(rows[0].montoMinor,25000);
 assert.equal(rows[1].montoMinor,3000);
 assert.equal(rows[1].fecha.toISOString(),evento.fechaISO);
 assert.equal(saldoCuentasDesdeAnclas([{_id:cuentaId,saldoAnclaMinor:50000,saldoAnclaEn:new Date("2026-10-24T15:00:00Z")}],rows),53000);
 assert.throws(()=>proyectarCaja({...datos,fuentes:[]}),/INTEGRIDAD_LEDGER/);
});
