"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { calculateLegacySale, canonicalLegacyMoney } = require("../../core/finance/enterpriseSalesMath");

const source = fs.readFileSync(path.join(__dirname, "../../services/ventas.service.js"), "utf8");
function makeService(existing, {successfulCreate = false} = {}) {
  const seen = [];
  const created = [];
  const productQueries = [];
  const collision = Object.assign(new Error("duplicate"), {code:11000});
  const producto = {_id:"producto_1", costoUnitario:100};
  const mocked = {
    mongoose:{Types:{ObjectId:{isValid:()=>true}}},
    "../models/Venta":{
      create:async(records)=>{if (!successfulCreate) throw collision; created.push(records[0]); return [{...records[0],_id:"venta_nueva"}];},
      findOne(filter){seen.push(filter);return {session:async()=>existing};}
    },
    "../models/ProductoServicio":{
      findOne(filter){productQueries.push(filter);return {select(){return this},session(){return this},lean:async()=>producto};}
    },
    "../models/Cliente":{},
    "../core/eventos/eventBus":{emit(){}},
    "../core/finance/enterpriseSalesMath":{calculateLegacySale,canonicalLegacyMoney}
  };
  const module = {exports:{}};
  vm.runInNewContext(source, {require:(name)=>{
    if (name==="mongoose") return mocked.mongoose;
    if (Object.prototype.hasOwnProperty.call(mocked,name))return mocked[name];
    throw new Error("Unexpected dependency "+name);
  },module,exports:module.exports,Error,Number,String});
  return {service:module.exports,seen,created,collision,productQueries};
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
  const existing={_id:"venta_1",cantidad:1,precioUnitario:1000,total:950,productoServicioId:"producto_1",estado:"pagada"};
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

test("venta: método de pago diferente no puede reutilizar una venta anterior",async()=>{
  const existing={_id:"venta_1",cantidad:1,precioUnitario:1000,total:1000,
    productoServicioId:"producto_1",estado:"pagada",metodoPago:"efectivo"};
  const {service}=makeService(existing);
  await assert.rejects(
    service.registrarVentaDesdePedido({pedido:{...pedido,metodoPago:"tarjeta"},
      empresaId:"empresa_A",sedeId:"sede_A",emitirEvento:false}),
    err=>err.code==="GRUK_VENTA_REPLAY_CONFLICT"
  );
});

test("venta: reintento de pedido asignado a otro cliente rechaza duplicado",async()=>{
  const existing={_id:"venta_1",cantidad:1,precioUnitario:1000,total:1000,
    productoServicioId:"producto_1",estado:"pagada",clienteId:"cliente_original"};
  const {service}=makeService(existing);
  await assert.rejects(
    service.registrarVentaDesdePedido({
      pedido,empresaId:"empresa_A",sedeId:"sede_A",emitirEvento:false
    }),
    err=>err.code==="GRUK_VENTA_REPLAY_CONFLICT"
  );
});

test("venta: rechaza importes subcentavo antes de intentar persistir",async()=>{
  const {service,seen}=makeService(null);
  await assert.rejects(
    service.registrarVentaDesdePedido({
      pedido:{...pedido,precio:999.999},
      empresaId:"empresa_A",sedeId:"sede_A",emitirEvento:false
    }),
    /cent|decimal|precision|money|amount|invalid|legacy/i
  );
  assert.equal(seen.length,0);
});

test("venta: rechaza cantidades fraccionarias antes de intentar persistir",async()=>{
  const {service,seen}=makeService(null);
  await assert.rejects(
    service.registrarVentaDesdePedido({
      pedido:{...pedido,cantidad:1.5},
      empresaId:"empresa_A",sedeId:"sede_A",emitirEvento:false
    })
  );
  assert.equal(seen.length,0);
});


test("venta: reintento con importes históricos subcentavo no acredita duplicado",async()=>{
  const existing={_id:"venta_1",cantidad:1,precioUnitario:1000,total:1000.001,
    productoServicioId:"producto_1",estado:"pagada"};
  const {service}=makeService(existing);
  await assert.rejects(
    service.registrarVentaDesdePedido({pedido,empresaId:"empresa_A",sedeId:"sede_A",emitirEvento:false}),
    err=>err.code==="GRUK_VENTA_REPLAY_CONFLICT"
  );
});

test("venta: reintento no acepta cantidades históricas fraccionarias",async()=>{
  const existing={_id:"venta_1",cantidad:1.0001,precioUnitario:1000,total:1000,
    productoServicioId:"producto_1",estado:"pagada"};
  const {service}=makeService(existing);
  await assert.rejects(
    service.registrarVentaDesdePedido({pedido,empresaId:"empresa_A",sedeId:"sede_A",emitirEvento:false}),
    err=>err.code==="GRUK_VENTA_REPLAY_CONFLICT"
  );
});

test("venta: rechaza cantidad fuera del límite financiero antes de persistir",async()=>{
  const {service,seen}=makeService(null);
  await assert.rejects(
    service.registrarVentaDesdePedido({
      pedido:{...pedido,cantidad:1000000000,precioUnitario:1000,precio:1000},
      empresaId:"empresa_A",sedeId:"sede_A",emitirEvento:false
    }),
    /quantity|cantidad|integer|canonical/i
  );
  assert.equal(seen.length,0);
});


test("venta: persiste evidencia de cálculo exacto en centavos sin sustituir el esquema histórico",async()=>{
  const {service,created}=makeService(null,{successfulCreate:true});
  const result=await service.registrarVentaDesdePedido({
    pedido:{...pedido,cantidad:2,precioUnitario:10.25,precio:20.5},
    empresaId:"empresa_A",sedeId:"sede_A",emitirEvento:false
  });
  assert.equal(result.creada,true);
  assert.equal(created.length,1);
  assert.deepEqual(JSON.parse(JSON.stringify(created[0].metadata.calculoExactoV1)),{
    ingresoCentavos:"2050",brutoCentavos:"2050",descuentoCentavos:"0",
    costoCentavos:"20000",utilidadCentavos:"-17950",margenPuntosBase:"-87560"
  });
});


test("venta: pedido de otra empresa se rechaza antes de consultar o persistir",async()=>{
  const {service,seen,created,productQueries}=makeService(null,{successfulCreate:true});
  await assert.rejects(service.registrarVentaDesdePedido({
    pedido:{...pedido,empresaId:"empresa_B"},empresaId:"empresa_A",sedeId:"sede_A",emitirEvento:false
  }),/GRUK_VENTA_PEDIDO_TENANT_CONFLICT/);
  assert.equal(seen.length,0);
  assert.equal(created.length,0);
  assert.equal(productQueries.length,0);
});

test("venta: pedido de otra sede se rechaza antes de persistir",async()=>{
  const {service,created}=makeService(null,{successfulCreate:true});
  await assert.rejects(service.registrarVentaDesdePedido({
    pedido:{...pedido,empresaId:"empresa_A",sedeId:"sede_B"},
    empresaId:"empresa_A",sedeId:"sede_A",emitirEvento:false
  }),/GRUK_VENTA_PEDIDO_SEDE_CONFLICT/);
  assert.equal(created.length,0);
});

test("venta: pedido con sede explícita no puede registrarse como venta sin sede",async()=>{
  const {service,created}=makeService(null,{successfulCreate:true});
  await assert.rejects(service.registrarVentaDesdePedido({
    pedido:{...pedido,sedeId:"sede_A"},empresaId:"empresa_A",emitirEvento:false
  }),/GRUK_VENTA_PEDIDO_SEDE_CONFLICT/);
  assert.equal(created.length,0);
});

test("venta: pedido con empresa y sede coincidentes permite persistir",async()=>{
  const {service,created}=makeService(null,{successfulCreate:true});
  const result=await service.registrarVentaDesdePedido({
    pedido:{...pedido,empresaId:"empresa_A",sedeId:"sede_A"},
    empresaId:"empresa_A",sedeId:"sede_A",emitirEvento:false
  });
  assert.equal(result.creada,true);
  assert.equal(created.length,1);
  assert.equal(created[0].empresaId,"empresa_A");
  assert.equal(created[0].sedeId,"sede_A");
});

test("venta: pedido de otra sede falla antes de consultar producto",async()=>{
  const {service,seen,created}=makeService(null,{successfulCreate:true});
  await assert.rejects(service.registrarVentaDesdePedido({
    pedido:{...pedido,sedeId:"sede_B"},empresaId:"empresa_A",sedeId:"sede_A",emitirEvento:false
  }),/GRUK_VENTA_PEDIDO_SEDE_CONFLICT/);
  assert.equal(seen.length,0);
  assert.equal(created.length,0);
});


test("venta: producto se consulta siempre con filtro de empresa autorizada",async()=>{
  const {service,productQueries}=makeService(null,{successfulCreate:true});
  await service.registrarVentaDesdePedido({
    pedido:{...pedido,empresaId:"empresa_A",sedeId:"sede_A"},
    empresaId:"empresa_A",sedeId:"sede_A",emitirEvento:false
  });
  assert.equal(productQueries.length,1);
  assert.equal(productQueries[0].empresaId,"empresa_A");
  assert.equal(productQueries[0]._id,"producto_1");
});
