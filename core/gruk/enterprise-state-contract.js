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
const validId = x => typeof x === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(x);
function transition({tipo,desde,hacia,empresaId,sedeId,entidadId,actorId,eventoId,fecha}) {
  for (const [key,value] of Object.entries({empresaId,sedeId,entidadId,actorId,eventoId})) {
    if (!validId(value)) throw new TypeError('P005_ID_INVALIDO:'+key);
  }
  if (!Object.hasOwn(transitions,tipo) || !Object.hasOwn(transitions[tipo],desde))
    throw new TypeError('P005_ESTADO_INVALIDO');
  if (!transitions[tipo][desde].includes(hacia)) throw new Error('P005_TRANSICION_PROHIBIDA');
  if (typeof fecha !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(fecha) || !Number.isFinite(Date.parse(fecha)) || new Date(Date.parse(fecha)).toISOString() !== fecha.replace(/Z$/, match => fecha.includes('.') ? match : '.000Z'))
    throw new TypeError('P005_FECHA_INVALIDA');
  return Object.freeze({
    tipo,empresaId,sedeId,entidadId,estadoAnterior:desde,estadoNuevo:hacia,
    evento:Object.freeze({eventoId,tipo,empresaId,sedeId,entidadId,actorId,fecha,desde,hacia})
  });
}
module.exports={transitions,transition};
