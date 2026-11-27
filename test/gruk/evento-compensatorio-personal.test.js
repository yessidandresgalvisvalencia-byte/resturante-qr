"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {eventoCompensatorio,verificarCadena}=require("../../modules/finanzas-personales/services/eventoCompensatorioPersonal.service");
const cero="0".repeat(64);
const original={usuarioId:"user_01",movimientoId:"mov_01",tipo:"GASTO",montoMinor:25000,concepto:"Rappi",categoria:"Alimentacion"};
const base={original,idempotencyKey:"correccion_01",prevHash:cero,secuencia:1,fechaISO:"2026-10-20T15:00:00.000Z"};
test("corrección determinística no reescribe el original",()=>{
 const antes={...original};
 const x=eventoCompensatorio({...base,tipo:"CORRECCION",cambios:{montoMinor:22000,concepto:"Comida"}});
 const y=eventoCompensatorio({...base,tipo:"CORRECCION",cambios:{concepto:"Comida",montoMinor:22000}});
 assert.equal(x.hashActual,y.hashActual);assert.equal(x.deltaCajaMinor,"3000");
 assert.deepEqual(original,antes);assert.equal(x.original.montoMinor,25000);
 assert.equal(verificarCadena([x],{prevHash:cero}),true);
});
test("reversos conservan COP exactos y el tipo de la operación",()=>{
 assert.equal(eventoCompensatorio({...base,tipo:"ANULACION"}).deltaCajaMinor,"25000");
 assert.equal(eventoCompensatorio({...base,original:{...original,tipo:"INGRESO"},tipo:"ANULACION"}).deltaCajaMinor,"-25000");
 assert.equal(eventoCompensatorio({...base,tipo:"CORRECCION",cambios:{tipo:"INGRESO"}}).deltaCajaMinor,"50000");
});
test("V2 revierte deuda con caja explícita y conserva el formato V1 anterior",()=>{
 const deuda={...original,tipo:"PAGO_DEUDA",impactoCaja:true};
 const efectivo=eventoCompensatorio({...base,original:deuda,tipo:"ANULACION"});
 const historico=eventoCompensatorio({...base,original:{...deuda,impactoCaja:false},tipo:"ANULACION"});
 assert.equal(efectivo.version,2);assert.equal(efectivo.deltaCajaMinor,"25000");
 assert.equal(historico.deltaCajaMinor,"0");
 assert.notEqual(efectivo.hashActual,historico.hashActual);
 assert.throws(()=>eventoCompensatorio({...base,original:{...original,tipo:"PAGO_DEUDA"},tipo:"ANULACION"}));
 assert.throws(()=>eventoCompensatorio({...base,original:deuda,tipo:"CORRECCION",cambios:{tipo:"INGRESO"}}));
 const viejo=eventoCompensatorio({...base,tipo:"ANULACION"});
 assert.equal(viejo.version,1);assert.equal(Object.hasOwn(viejo.original,"impactoCaja"),false);
});
test("V3 reclasifica cobros como ingresos sin sumar dinero ni permitir cambios de importe",()=>{
 const cobro={...original,tipo:"COBRO_PRESTAMO"};
 const e=eventoCompensatorio({...base,original:cobro,tipo:"CORRECCION",cambios:{tipo:"INGRESO",categoria:"Trabajo cobrado"}});
 assert.equal(e.version,3);assert.equal(e.deltaCajaMinor,"0");
 const vuelta=eventoCompensatorio({...base,tipo:"CORRECCION",original:{...original,tipo:"INGRESO"},cambios:{tipo:"COBRO_PRESTAMO",categoria:"Cuentas por cobrar"}});
 assert.equal(vuelta.version,3);assert.equal(vuelta.deltaCajaMinor,"0");
 for(const cambios of [{tipo:"INGRESO",montoMinor:1},{tipo:"GASTO"},{categoria:"Trabajo cobrado"},{tipo:"INGRESO",concepto:"Distinto"}])
  assert.throws(()=>eventoCompensatorio({...base,original:cobro,tipo:"CORRECCION",cambios}));
 assert.throws(()=>eventoCompensatorio({...base,original:cobro,tipo:"ANULACION"}));
});
test("V4 restaura capital por separado del dinero realmente pagado",()=>{
 const credito={...original,tipo:"PAGO_DEUDA",montoMinor:400,montoPagadoRealMinor:450,prestamoId:"507f1f77bcf86cd799439011",numeroCuota:1,impactoCaja:true};
 const e=eventoCompensatorio({...base,original:credito,tipo:"ANULACION"});
 assert.equal(e.version,4);assert.equal(e.original.montoMinor,400);assert.equal(e.deltaCajaMinor,"450");
 assert.equal(eventoCompensatorio({...base,original:{...credito,impactoCaja:false},tipo:"ANULACION"}).deltaCajaMinor,"0");
 for(const cambio of [{montoPagadoRealMinor:399},{numeroCuota:0},{prestamoId:"ajeno"}])
  assert.throws(()=>eventoCompensatorio({...base,original:{...credito,...cambio},tipo:"ANULACION"}));
});
test("cadena detecta alteraciones, reordenamiento y clave duplicada",()=>{
 const a=eventoCompensatorio({...base,tipo:"CORRECCION",cambios:{montoMinor:23000}});
 const b=eventoCompensatorio({...base,tipo:"ANULACION",prevHash:a.hashActual,secuencia:2,idempotencyKey:"anulacion_02"});
 assert.equal(verificarCadena([a,b],{prevHash:cero}),true);
 assert.equal(verificarCadena([a,{...b,deltaCajaMinor:"999"}],{prevHash:cero}),false);
 assert.equal(verificarCadena([b,a],{prevHash:cero}),false);
 assert.equal(verificarCadena([a,{...b,idempotencyKey:a.idempotencyKey}],{prevHash:cero}),false);
});
test("no permite floats, fechas inválidas, campos ajenos ni deltas fuera de rango",()=>{
 for(const montoMinor of [0,-1,0.1,Number.MAX_SAFE_INTEGER+1])
  assert.throws(()=>eventoCompensatorio({...base,tipo:"CORRECCION",cambios:{montoMinor}}));
 assert.throws(()=>eventoCompensatorio({...base,tipo:"CORRECCION",cambios:{usuarioId:"otro"}}));
 assert.throws(()=>eventoCompensatorio({...base,tipo:"ANULACION",cambios:{montoMinor:2}}));
 assert.throws(()=>eventoCompensatorio({...base,tipo:"CORRECCION",cambios:{montoMinor:23000},fechaISO:"2026-02-30T15:00:00.000Z"}));
 assert.throws(()=>eventoCompensatorio({...base,tipo:"CORRECCION",cambios:{montoMinor:23000},prevHash:"mal"}));
});
