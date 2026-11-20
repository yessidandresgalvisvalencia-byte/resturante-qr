"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const finance = require("../../core/finance/enterpriseSalesMath");

const source = fs.readFileSync(path.join(__dirname, "../../services/ventas.service.js"), "utf8");
function fixture(clientFound) {
  const queries = [];
  const creates = [];
  const clientModel = {
    findOne(filter) {
      queries.push(filter);
      return { select() { return this; }, session() { return this; }, lean: async () => clientFound ? {_id:"client_A"} : null };
    }
  };
  const mocks = {
    mongoose: {Types:{ObjectId:{isValid:(value)=>value!=="not-an-object-id"}}},
    "../models/Venta": {create:async (records)=>{creates.push(records[0]);return [{...records[0],_id:"venta_A"}];}},
    "../models/ProductoServicio": {findOne:()=>({select(){return this;},session(){return this;},lean:async()=>({_id:"product_A",costoUnitario:10})})},
    "../models/Cliente": clientModel,
    "../core/eventos/eventBus": {emit(){}},
    "../core/finance/enterpriseSalesMath": finance
  };
  const module = {exports:{}};
  vm.runInNewContext(source,{module,exports:module.exports,require:(name)=>{
    if(Object.prototype.hasOwnProperty.call(mocks,name))return mocks[name];
    throw new Error("Unexpected dependency: "+name);
  },Error,Number,String});
  return {service:module.exports,queries,creates};
}
const pedido = {_id:"order_A",empresaId:"tenant_A",sedeId:"site_A",clienteId:"client_A",productoServicioId:"product_A",cantidad:1,precioUnitario:100,precio:100,producto:"Producto"};
test("P0-04: cliente se consulta con empresa, sede y exclusión de eliminados",async()=>{
  const {service,queries,creates}=fixture(true);
  await service.registrarVentaDesdePedido({pedido,empresaId:"tenant_A",sedeId:"site_A",emitirEvento:false});
  assert.equal(queries.length,1);
  assert.equal(queries[0]._id,"client_A");
  assert.equal(queries[0].empresaId,"tenant_A");
  assert.equal(queries[0].sedeId,"site_A");
  assert.equal(queries[0].deletedAt,null);
  assert.equal(creates.length,1);
  assert.equal(creates[0].clienteId,"client_A");
});
test("P0-04: cliente no visible en el ámbito autorizado bloquea persistencia",async()=>{
  const {service,queries,creates}=fixture(false);
  await assert.rejects(
    service.registrarVentaDesdePedido({pedido,empresaId:"tenant_A",sedeId:"site_A",emitirEvento:false}),
    /Cliente no pertenece a la empresa o sede/
  );
  assert.equal(queries.length,1);
  assert.equal(queries[0].empresaId,"tenant_A");
  assert.equal(queries[0].sedeId,"site_A");
  assert.equal(creates.length,0);
});

test("P0-04: venta sin sede no puede consultar clientes de otras sedes",async()=>{
  const {service,queries,creates}=fixture(false);
  const withoutSite={...pedido,sedeId:null};
  await assert.rejects(service.registrarVentaDesdePedido({pedido:withoutSite,empresaId:"tenant_A",sedeId:null,emitirEvento:false}),/Cliente no pertenece a la empresa o sede/);
  assert.equal(queries.length,1);
  assert.equal(queries[0].empresaId,"tenant_A");
  assert.equal(queries[0].sedeId,null);
  assert.equal(queries[0].deletedAt,null);
  assert.equal(creates.length,0);
});

test("P0-04: cliente sin sede solo es aceptado con filtro de sede nula",async()=>{
  const {service,queries,creates}=fixture(true);
  const withoutSite={...pedido,sedeId:null};
  const result=await service.registrarVentaDesdePedido({pedido:withoutSite,empresaId:"tenant_A",sedeId:null,emitirEvento:false});
  assert.equal(result.creada,true);
  assert.equal(queries.length,1);
  assert.equal(queries[0].empresaId,"tenant_A");
  assert.equal(queries[0].sedeId,null);
  assert.equal(creates.length,1);
  assert.equal(creates[0].sedeId,null);
});

test("P0-04: identificador de cliente inválido se rechaza sin consultar ni persistir",async()=>{
  const {service,queries,creates}=fixture(true);
  const invalid={...pedido,clienteId:"not-an-object-id"};
  await assert.rejects(
    service.registrarVentaDesdePedido({pedido:invalid,empresaId:"tenant_A",sedeId:"site_A",emitirEvento:false}),
    /clienteId invalido/
  );
  assert.equal(queries.length,0);
  assert.equal(creates.length,0);
});
