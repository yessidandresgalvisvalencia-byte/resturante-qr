"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {resolverConfirmacion,validarClaveVinculo,coincideVinculo,decidirReintentoVinculo,conflictoTransitorioMongo}=require("../../modules/finanzas-personales/services/confirmarVinculoHistoricoV81.service");
const uid="507f1f77bcf86cd799439011";
const movimiento={_id:"507f1f77bcf86cd799439012",usuarioId:uid,cuentaId:null,
 estado:"ACTIVA",moneda:"COP"};
const cuenta={_id:"507f1f77bcf86cd799439013",usuarioId:uid,activa:true,moneda:"COP"};
const base={usuarioId:uid,movimiento,cuenta,evidencia:"Extracto bancario revisado",
 idempotencyKey:"1c279cce-fcf1-49e2-9271-9662d2fb2ee7"};
test("vínculo explícito produce sólo evidencia, sin tocar saldo",()=>{
 const x=resolverConfirmacion(base);
 assert.equal(x.movimientoId,movimiento._id);
 assert.equal(x.cuentaId,cuenta._id);
 assert.equal(Object.hasOwn(x,"saldoMinor"),false);
 assert.equal(Object.hasOwn(x,"montoMinor"),false);
});
test("otro usuario o movimiento vinculado no puede confirmar",()=>{
 assert.throws(()=>resolverConfirmacion({...base,usuarioId:"507f1f77bcf86cd799439099"}),e=>e.statusCode===404);
 assert.throws(()=>resolverConfirmacion({...base,movimiento:{...movimiento,cuentaId:cuenta._id}}),e=>e.statusCode===409);
});
test("movimientos anulados y cuentas inactivas se rechazan",()=>{
 assert.throws(()=>resolverConfirmacion({...base,movimiento:{...movimiento,estado:"ANULADA"}}),e=>e.statusCode===409);
 assert.throws(()=>resolverConfirmacion({...base,cuenta:{...cuenta,activa:false}}),e=>e.statusCode===409);
});
test("sin evidencia o clave idempotente válida se bloquea",()=>{
 assert.throws(()=>resolverConfirmacion({...base,evidencia:"sin prueba"}),e=>e.statusCode===400);
 assert.throws(()=>resolverConfirmacion({...base,idempotencyKey:"cualquier cosa"}),e=>e.statusCode===400);
});

test("UUID de idempotencia tiene estructura y variante válidas",()=>{
 assert.doesNotThrow(()=>validarClaveVinculo(base.idempotencyKey));
 for(const invalido of [undefined,null,"-".repeat(36),"00000000-0000-0000-0000-000000000000","1c279cce-fcf1-49e2-0271-9662d2fb2ee7"]){
  assert.throws(()=>validarClaveVinculo(invalido),e=>e.statusCode===400);
 }
});
test("confirmación concurrente idéntica se reconoce sin otra escritura",()=>{
 const hash="a".repeat(64);
 const previo={movimientoId:movimiento._id,cuentaId:cuenta._id,evidencia:base.evidencia,idempotencyKeyHash:hash};
 assert.equal(coincideVinculo(previo,{movimientoId:movimiento._id,cuentaId:cuenta._id,evidencia:base.evidencia,idempotencyKeyHash:hash}),true);
 for(const diferencia of [{cuentaId:"otra"},{movimientoId:"otro"},{evidencia:"Otra prueba documental"},{idempotencyKeyHash:"b".repeat(64)}]){
  assert.equal(coincideVinculo(previo,{movimientoId:movimiento._id,cuentaId:cuenta._id,evidencia:base.evidencia,idempotencyKeyHash:hash,...diferencia}),false);
 }
});

test("colisión cruzada no pasa inadvertida aunque un vínculo coincida",()=>{
 const h="f".repeat(64);
 const solicitud={movimientoId:movimiento._id,cuentaId:cuenta._id,evidencia:base.evidencia,idempotencyKeyHash:h};
 const igual={...solicitud};
 const otraClave={movimientoId:"507f1f77bcf86cd799439099",cuentaId:cuenta._id,
  evidencia:base.evidencia,idempotencyKeyHash:h};
 assert.deepEqual(decidirReintentoVinculo([],solicitud),{existe:false,coincide:false});
 assert.deepEqual(decidirReintentoVinculo([igual],solicitud),{existe:true,coincide:true});
 assert.deepEqual(decidirReintentoVinculo([igual,otraClave],solicitud),{existe:true,coincide:false});
 assert.deepEqual(decidirReintentoVinculo([otraClave,igual],solicitud),{existe:true,coincide:false});
 assert.deepEqual(decidirReintentoVinculo([otraClave],solicitud),{existe:true,coincide:false});
});

test("Mongo WriteConflict y commit incierto se identifican para reintento",()=>{
 assert.equal(conflictoTransitorioMongo({code:112}),true);
 assert.equal(conflictoTransitorioMongo({code:251}),true);
 assert.equal(conflictoTransitorioMongo({hasErrorLabel:label=>label==="TransientTransactionError"}),true);
 assert.equal(conflictoTransitorioMongo({hasErrorLabel:label=>label==="UnknownTransactionCommitResult"}),true);
 assert.equal(conflictoTransitorioMongo({code:11000}),false);
 assert.equal(conflictoTransitorioMongo(null),false);
});
