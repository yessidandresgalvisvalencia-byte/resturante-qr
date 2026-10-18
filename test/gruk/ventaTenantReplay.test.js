"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../../services/ventas.service.js"), "utf8");
function makeService(existing) {
  const seen = [];
  const collision = Object.assign(new Error("duplicate"), {code:11000});
  const producto = {_id:"producto_1", costoUnitario:100};
  const mocked = {
    mongoose:{Types:{ObjectId:{isValid:()=>true}}},
    "../models/Venta":{
      create:async()=>{throw collision;},
      findOne(filter){seen.push(filter);return {session:async()=>existing};}
    },
    "../models/ProductoServicio":{
      findOne(){return {select(){return this},session(){return this},lean:async()=>producto};}
    },
    "../models/Cliente":{},
    "../core/eventos/eventBus":{emit(){}}
  };
  const module = {exports:{}};
  vm.runInNewContext(source, {require:(name)=>{
    if (name==="mongoose") return mocked.mongoose;
    if (Object.prototype.hasOwnProperty.call(mocked,name))return mocked[name];
    throw new Error("Unexpected dependency "+name);
  },module,exports:module.exports,Error,Number,String});
  return {service:module.exports,seen,collision};
}
const pedido={
  _id:"pedido_1",productoServicioId:"producto_1",
  cantidad:1,precioUnitario:1000,precio:1000,
  producto:"producto",restaurantId:"rest1",mesa:1
};
test("venta: reintento duplicado consulta exclusivamente empresa y sede correctas",async()=>{
  const fake={_id:"venta_1",cantidad:1,precioUnitario:1000,total:1000,productoServicioId:"producto_1",estado:"pagada"};
  const {service,seen}=makeService(fake);
  const result=await service.registrarVentaDesdePedido({
    pedido,empresaId:"empresa_A",sedeId:"sede_A",emitirEvento:false
  });
  assert.equal(result.creada,false);
  assert.equal(result.venta,fake);
  assert.equal(seen.length,1);
  assert.equal(seen[0].empresaId,"empresa_A");
  assert.equal(seen[0].sedeId,"sede_A");
  assert.equal(seen[0].origen,"restaurante");
  assert.equal(seen[0].origenId,"pedido_1");
});
test("venta: no reportar éxito si el duplicado pertenece a otro tenant",async()=>{
  const {service,collision}=makeService(null);
  await assert.rejects(
    service.registrarVentaDesdePedido({pedido,empresaId:"empresa_B",sedeId:"sede_B",emitirEvento:false}),
    err=>err===collision
  );
});

test("venta: reintento con importe diferente se rechaza como conflicto",async()=>{
  const existing={_id:"venta_1",cantidad:1,precioUnitario:1000,total:950,productoServicioId:"producto_1"};
  const {service}=makeService(existing);
  await assert.rejects(
    service.registrarVentaDesdePedido({
      pedido,empresaId:"empresa_A",sedeId:"sede_A",emitirEvento:false
    }),
    err=>err.code==="GRUK_VENTA_REPLAY_CONFLICT"
  );
});

test("venta: una venta anulada no acredita reintento de pedido pagado",async()=>{
  const cancelled={_id:"venta_anulada",cantidad:1,precioUnitario:1000,total:1000,productoServicioId:"producto_1",estado:"anulada"};
  const {service}=makeService(cancelled);
  await assert.rejects(
    service.registrarVentaDesdePedido({pedido,empresaId:"empresa_A",sedeId:"sede_A",emitirEvento:false}),
    err=>err.code==="GRUK_VENTA_REPLAY_STATE_CONFLICT"
  );
});
