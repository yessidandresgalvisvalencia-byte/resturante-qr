"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Transaccion=require("../../modules/finanzas-personales/models/TransaccionPersonal");
test("índices de conciliación aíslan usuario, cuenta y período",()=>{
 const indexes=Transaccion.schema.indexes();
 const buscar=(name)=>indexes.find(([,opciones])=>opciones.name===name);
 const cuenta=buscar("fp_conciliacion_cuenta_periodo_v81");
 const huerfanos=buscar("fp_conciliacion_huerfanos_periodo_v81");
 assert.ok(cuenta,"Falta índice de movimientos asociados a cuenta");
 assert.ok(huerfanos,"Falta índice de movimientos históricos sin cuentaId");
 assert.deepEqual(cuenta[0],{usuarioId:1,cuentaId:1,fecha:1});
 assert.deepEqual(huerfanos[0],{usuarioId:1,cuentaId:1,cuenta:1,fecha:1});
 assert.notEqual(cuenta[1].unique,true,"No bloquear movimientos legítimos repetidos");
 assert.notEqual(huerfanos[1].unique,true,"No bloquear homónimos ni históricos");
});
