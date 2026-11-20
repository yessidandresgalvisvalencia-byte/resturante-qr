"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),mongoose=require("mongoose");
const {versionSeleccion}=require("../../modules/finanzas-personales/services/reclasificarTrabajoCompensadoPersonal.service");
test("Selección de revisión: estable con orden de claves y BSON/fechas; vinculada a dueño, fuentes y evidencia",()=>{
 const u="012345678901234567890123",p="112345678901234567890123",fecha=new Date("2026-11-01T12:00:00.000Z"),cuenta={original:{_id:new mongoose.Types.ObjectId(p),fecha,principalMinor:1000},movimientos:[{montoMinor:1000,tipo:"COBRO_PRESTAMO",compensacionHash:"a".repeat(64)}],evidencia:{confirmacionHash:"b".repeat(64)}};
 const h=versionSeleccion(u,[cuenta]);assert.match(h,/^[a-f0-9]{64}$/);
 assert.equal(versionSeleccion(u,[{evidencia:cuenta.evidencia,movimientos:cuenta.movimientos,original:{principalMinor:1000,fecha:new Date(+fecha),_id:new mongoose.Types.ObjectId(p)}}]),h);
 assert.notEqual(versionSeleccion("212345678901234567890123",[cuenta]),h);
 for(const mod of [{...cuenta,original:{...cuenta.original,principalMinor:1001}},{...cuenta,movimientos:[{...cuenta.movimientos[0],compensacionHash:"c".repeat(64)}]},{...cuenta,evidencia:{confirmacionHash:"d".repeat(64)}}])assert.notEqual(versionSeleccion(u,[mod]),h);
 assert.notEqual(versionSeleccion(u,[cuenta,{...cuenta,original:{...cuenta.original,_id:new mongoose.Types.ObjectId()}}]),h);
 assert.notEqual(versionSeleccion(u,[]),versionSeleccion("212345678901234567890123",[]));
});
