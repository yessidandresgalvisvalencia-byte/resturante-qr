'use strict';
// P0-05: pure, deterministic enterprise lifecycle contract. No database writes.
// Integrators must persist the returned event and state atomically under tenant scope.
const transitions = Object.freeze({
  pedido: {creado:['preparando','cancelado'],preparando:['listo','cancelado'],listo:['entregado','cancelado'],entregado:[],cancelado:[]},
  pago: {pendiente:['autorizado','fallido','cancelado'],autorizado:['capturado','cancelado'],capturado:['reembolsado'],fallido:[],cancelado:[],reembolsado:[]},
  inventario: {reservado:['consumido','liberado'],consumido:['revertido'],liberado:[],revertido:[]},
  devolucion: {solicitada:['aprobada','rechazada'],aprobada:['ejecutada'],rechazada:[],ejecutada:[]},
  entrega: {pendiente:['en_camino','cancelada'],en_camino:['entregada','fallida'],fallida:['en_camino','cancelada'],entregada:[],cancelada:[]}
});
// Freeze nested state maps and target arrays: consumers must not be able to
// authorize forbidden financial or inventory transitions at runtime.
for (const states of Object.values(transitions)) {
  for (const targets of Object.values(states)) Object.freeze(targets);
  Object.freeze(states);
}
const validId = x => typeof x === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(x);
function transition(input) {
  // Reject malformed payloads at the boundary instead of leaking destructuring errors.
  if (input === null || typeof input !== 'object' || Array.isArray(input))
    throw new TypeError('P005_PAYLOAD_INVALIDO');
  // Require own, explicitly declared fields: inherited tenant identities and shadow
  // scope aliases must never be silently accepted at the audit boundary.
  const required = ['tipo','desde','hacia','empresaId','sedeId','entidadId','actorId','eventoId','fecha'];
  if (Reflect.ownKeys(input).some(key => typeof key !== 'string' || !required.includes(key)) ||
      required.some(key => !Object.hasOwn(input,key)))
    throw new TypeError('P005_CAMPOS_INVALIDOS');
  // Only plain records are accepted; never trust inherited scope or class instances.
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null)
    throw new TypeError('P005_PROTOTIPO_INVALIDO');
  // Read descriptor values directly. A Proxy can intercept property reads even when
  // its descriptor trap reports ordinary data fields; never trigger its get trap.
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (Object.values(descriptors).some(d => !Object.hasOwn(d, 'value')))
    throw new TypeError('P005_ACCESOR_PROHIBIDO');
  // Non-enumerable fields disappear on JSON transport and cannot be audited or replayed.
  if (required.some(key => descriptors[key].enumerable !== true))
    throw new TypeError('P005_CAMPO_NO_ENUMERABLE');
  const {tipo,desde,hacia,empresaId,sedeId,entidadId,actorId,eventoId,fecha} =
    Object.fromEntries(required.map(key => [key, descriptors[key].value]));
  for (const [key,value] of Object.entries({empresaId,sedeId,entidadId,actorId,eventoId})) {
    if (!validId(value)) throw new TypeError('P005_ID_INVALIDO:'+key);
  }
  if (typeof tipo !== 'string' || typeof desde !== 'string' || !Object.hasOwn(transitions,tipo) || !Object.hasOwn(transitions[tipo],desde))
    throw new TypeError('P005_ESTADO_INVALIDO');
  if (typeof hacia !== 'string' || !transitions[tipo][desde].includes(hacia)) throw new Error('P005_TRANSICION_PROHIBIDA');
  if (typeof fecha !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(fecha) || !Number.isFinite(Date.parse(fecha)) || new Date(Date.parse(fecha)).toISOString() !== fecha.replace(/(?:\.(\d{1,3}))?Z$/, (_, ms) => '.' + (ms || '').padEnd(3, '0') + 'Z'))
    throw new TypeError('P005_FECHA_INVALIDA');
  return Object.freeze({
    tipo,empresaId,sedeId,entidadId,estadoAnterior:desde,estadoNuevo:hacia,
    evento:Object.freeze({eventoId,tipo,empresaId,sedeId,entidadId,actorId,fecha,desde,hacia})
  });
}
module.exports={transitions,transition};
