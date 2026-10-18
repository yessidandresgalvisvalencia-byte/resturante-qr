"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {validateOfflineOrderForPosting:validate}=require("../../core/offline/offlineOrderPosting.contract");
const id="01ARZ3NDEKTSV4RRFFQ69G5FA0";
const event={eventId:id,tipo:"PEDIDO_REGISTRADO",payload:{
  localOrderId:id,items:[{productoId:"prod_1",cantidad:"2",precioUnitarioCop:"1500",totalCop:"3000"}],totalCop:"3000"
}};
test("pedido offline: reconcilia total exacto en enteros COP",()=>{
  assert.equal(validate(event).totalCop,"3000");
});
test("pedido offline: rechaza diferencia de un peso",()=>{
  assert.throws(()=>validate({...event,payload:{...event.payload,totalCop:"2999"}}),e=>e.code==="OFFLINE_ORDER_NOT_POSTABLE");
});
test("pedido offline: rechaza números float, cantidades inválidas e identificador ausente",()=>{
  for(const precio of [1500,1.5,"1.50","-1","01"]){
    assert.throws(()=>validate({...event,payload:{...event.payload,items:[{productoId:"prod_1",cantidad:"2",precioUnitarioCop:precio,totalCop:"3000"}]}}));
  }
  assert.throws(()=>validate({...event,payload:{...event.payload,localOrderId:null}}));
});
test("pedido offline: evita pérdida de precisión por enteros fuera de rango",()=>{
  assert.throws(()=>validate({...event,payload:{...event.payload,items:[{productoId:"prod_1",cantidad:"2",precioUnitarioCop:"9007199254740992",totalCop:"18014398509481984"}],totalCop:"18014398509481984"}}));
});

test("pedido offline: suma varios productos exactamente en COP",()=>{
  const multi={...event,payload:{...event.payload,items:[
    {productoId:"prod_1",cantidad:"2",precioUnitarioCop:"1500",totalCop:"3000"},
    {productoId:"prod_2",cantidad:"3",precioUnitarioCop:"1250",totalCop:"3750"}
  ],totalCop:"6750"}};
  const normalized=validate(multi);
  assert.equal(normalized.items.length,2);
  assert.equal(normalized.totalCop,"6750");
  assert.throws(()=>validate({...multi,payload:{...multi.payload,totalCop:"6751"}}),
    err=>err.code==="OFFLINE_ORDER_NOT_POSTABLE");
});
test("pedido offline: falla si un renglón no reconcilia incluso cuando el total coincide",()=>{
  const invalid={...event,payload:{...event.payload,items:[
    {productoId:"prod_1",cantidad:"2",precioUnitarioCop:"1500",totalCop:"2999"},
    {productoId:"prod_2",cantidad:"1",precioUnitarioCop:"1",totalCop:"1"}
  ]}};
  assert.throws(()=>validate(invalid),err=>err.code==="OFFLINE_ORDER_NOT_POSTABLE");
});
