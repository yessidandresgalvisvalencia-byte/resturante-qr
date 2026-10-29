"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const Tx=require("../../modules/finanzas-personales/models/TransaccionPersonal");
const id="507f1f77bcf86cd799439011";
const bloqueado=e=>e.code==="TRANSACCION_PERSONAL_APPEND_ONLY"&&e.statusCode===409;
test("modelo rechaza modificaciones y borrados sin conexión a MongoDB",async()=>{
 for(const operacion of [
  ()=>Tx.updateOne({_id:id},{$set:{montoMinor:1}}),()=>Tx.updateMany({},{$set:{estado:"ANULADA"}}),
  ()=>Tx.replaceOne({_id:id},{montoMinor:1}),()=>Tx.findOneAndUpdate({_id:id},{$set:{concepto:"Otro"}}),
  ()=>Tx.findOneAndReplace({_id:id},{montoMinor:1}),()=>Tx.deleteOne({_id:id}),()=>Tx.deleteMany({}),
  ()=>Tx.findByIdAndDelete(id),()=>Tx.bulkWrite([{deleteOne:{filter:{_id:id}}}])
 ])await assert.rejects(operacion(),bloqueado);
});
test("documentos existentes no se guardan ni borran, pero nuevos documentos validan",async()=>{
 const doc=new Tx({usuarioId:id,tipo:"INGRESO",montoMinor:100,concepto:"Prueba",categoria:"OTROS",fecha:new Date()});
 await doc.validate();assert.equal(doc.isNew,true);
 doc.isNew=false;
 await assert.rejects(doc.save(),bloqueado);await assert.rejects(doc.deleteOne(),bloqueado);
});
