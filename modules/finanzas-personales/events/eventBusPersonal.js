"use strict";
const {EventEmitter}=require("events");
const EVENTS=Object.freeze({GASTO_REGISTRADO:"GASTO_REGISTRADO",INGRESO_DETECTADO:"INGRESO_DETECTADO",PAGO_DEUDA:"PAGO_DEUDA",MOVIMIENTO_PATRIMONIAL:"MOVIMIENTO_PATRIMONIAL"});
class PersonalEventBus extends EventEmitter{
 emitFinancial(eventName,event){if(!Object.values(EVENTS).includes(eventName))throw new TypeError("Evento financiero personal no permitido");if(!event?.eventId||!event?.usuarioId)throw new TypeError("Evento sin identidad o aislamiento de usuario");return super.emit(eventName,Object.freeze({...event,eventName,occurredAt:event.occurredAt||new Date()}));}
}
const bus=new PersonalEventBus();bus.setMaxListeners(50);module.exports={personalEventBus:bus,PERSONAL_EVENTS:EVENTS};