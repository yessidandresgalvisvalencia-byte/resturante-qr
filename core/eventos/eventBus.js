"use strict";

const { EventEmitter } = require("events");

class GrukEventBus extends EventEmitter {
  emit(eventName, payload) {
    if (!eventName || typeof eventName !== "string") {
      throw new TypeError(
        "GRUK EventBus: eventName debe ser un string válido"
      );
    }

    const event = {
      eventName,
      occurredAt: new Date(),
      payload
    };

    return super.emit(eventName, event);
  }
}

const eventBus = new GrukEventBus();

eventBus.setMaxListeners(50);

module.exports = eventBus;
