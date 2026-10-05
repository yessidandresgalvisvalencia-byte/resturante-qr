"use strict";
const {EventEmitter}=require("events");
const EVENTS=Object.freeze({GASTO_REGISTRADO:"GASTO_REGISTRADO",INGRESO_DETECTADO:"INGRESO_DETECTADO",PAGO_DEUDA:"PAGO_DEUDA",MOVIMIENTO_PATRIMONIAL:"MOVIMIENTO_PATRIMONIAL",CUENTA_POR_COBRAR_REGISTRADA:"CUENTA_POR_COBRAR_REGISTRADA",CUENTA_POR_COBRAR_COBRADA:"CUENTA_POR_COBRAR_COBRADA",RECORDATORIO_COBRO:"RECORDATORIO_COBRO",MOVIMIENTO_CORREGIDO:"MOVIMIENTO_CORREGIDO",MOVIMIENTO_ANULADO:"MOVIMIENTO_ANULADO",ACCION_PROGRESO_ACTUALIZADA:"ACCION_PROGRESO_ACTUALIZADA",SALDO_RECONCILIADO:"SALDO_RECONCILIADO"});
class PersonalEventBus extends EventEmitter{
 emitFinancial(eventName,event){if(!Object.values(EVENTS).includes(eventName))throw new TypeError("Evento financiero personal no permitido");if(!event?.eventId||!event?.usuarioId)throw new TypeError("Evento sin identidad o aislamiento de usuario");return super.emit(eventName,Object.freeze({...event,eventName,occurredAt:event.occurredAt||new Date()}));}
}
const bus=new PersonalEventBus();bus.setMaxListeners(50);module.exports={personalEventBus:bus,PERSONAL_EVENTS:EVENTS};