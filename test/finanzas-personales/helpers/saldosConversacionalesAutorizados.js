"use strict";
const assert=require("node:assert/strict"),mongoose=require("mongoose");
const Borrador=require("../../../modules/finanzas-personales/models/borradorFinanciero.model");
const Cuenta=require("../../../modules/finanzas-personales/models/cuentaFinanciera.model");
const Tx=require("../../../modules/finanzas-personales/models/TransaccionPersonal");
const Outbox=require("../../../modules/finanzas-personales/models/outboxPersonal.model");
const {aprobar}=require("../../../modules/finanzas-personales/services/aprobacionConversacional.service");
const {crearAplicador}=require("../../../modules/finanzas-personales/services/compensarMovimientoPersonal.service");
async function probarSaldosConversacionalesAutorizados(){
 const ahora=Date.now(),fecha=new Date(ahora-60000);
 const item=(tipo="AJUSTE_SALDO",momento=fecha)=>({tipo,montoMinor:1000,concepto:"Saldo declarado",
  categoria:"Saldo inicial",fecha:momento,confianza:100,estado:"LISTO"});
 const draft=(usuarioId,items)=>Borrador.create({usuarioId,canal:"TEXTO",textoOriginal:"Saldo local",items});
 const estado=async usuarioId=>({cuentas:await Cuenta.find({usuarioId}).sort({_id:1}).lean(),
  tx:await Tx.find({usuarioId}).sort({_id:1}).lean(),outbox:await Outbox.find({usuarioId}).sort({_id:1}).lean(),
  borradores:await Borrador.find({usuarioId}).sort({_id:1}).lean()});
 for(const tipo of ["AJUSTE_SALDO","AJUSTE_SALDO_AHORRO"]){
  const usuarioId=new mongoose.Types.ObjectId(),b=await draft(usuarioId,[item(tipo)]);
  await aprobar(usuarioId,b._id);
  const cuenta=await Cuenta.findOne({usuarioId}).lean();
  assert.equal(cuenta.saldoMinor,1000);assert.equal(cuenta.saldoAnclaMinor,1000);
  assert.equal(+cuenta.saldoAnclaEn,+fecha);assert.equal(cuenta.origenSaldo,"USUARIO");
  const fuentes=await Tx.find({usuarioId}).lean();
  if(tipo==="AJUSTE_SALDO"){
   assert.equal(fuentes.length,1);assert.equal(fuentes[0].impactoCaja,false);
   assert.equal(String(fuentes[0].cuentaId),String(cuenta._id));
  }else assert.equal(fuentes.length,0);
  assert.equal((await Outbox.findOne({usuarioId}).lean()).eventName,"SALDO_CUENTA_RECONCILIADO");
  // Otra declaración con el mismo instante no puede sustituir el ancla confirmada.
  const viejo=await draft(usuarioId,[item(tipo)]),antes=await estado(usuarioId);
  await assert.rejects(aprobar(usuarioId,viejo._id),e=>e.statusCode===409);
  assert.deepEqual(await estado(usuarioId),antes);
 }
 for(const caso of ["movimiento","transferencia","compensacion","futuro","outbox","lote"]){
  const usuarioId=new mongoose.Types.ObjectId();
  const cuenta=await Cuenta.create({usuarioId,nombre:"EFECTIVO",tipo:"EFECTIVO",saldoMinor:500});
  if(caso==="movimiento")await Tx.create({usuarioId,cuentaId:cuenta._id,tipo:"INGRESO",montoMinor:100,
   concepto:"Ingreso posterior",categoria:"OTROS",fecha:new Date(ahora-30000)});
  if(caso==="transferencia")await Outbox.create({usuarioId,eventId:new mongoose.Types.ObjectId().toString(),
   eventName:"MOVIMIENTO_PATRIMONIAL",aggregateType:"TRANSFERENCIA_PROPIA",aggregateId:cuenta._id,
   payload:{origenId:String(cuenta._id),destinoId:new mongoose.Types.ObjectId().toString(),montoMinor:100}});
  if(caso==="compensacion"){
   const tx=await Tx.create({usuarioId,cuentaId:cuenta._id,tipo:"GASTO",montoMinor:100,
    concepto:"Gasto anterior",categoria:"OTROS",fecha:new Date(ahora-120000)});
   await crearAplicador()({usuarioId,movimientoId:String(tx._id),tipo:"CORRECCION",cambios:{montoMinor:50},idempotencyKey:"saldo-compensado"});
  }
  const items=[item("AJUSTE_SALDO",caso==="futuro"?new Date(Date.now()+86400000):fecha)];
  if(caso==="lote")items.push({...item("GASTO"),montoMinor:2000});
  const b=await draft(usuarioId,items),antes=await estado(usuarioId),crear=Outbox.create;
  if(caso==="outbox")Outbox.create=async()=>{throw Error("OUTBOX_SALDO_FALLIDO");};
  try{await assert.rejects(aprobar(usuarioId,b._id),e=>caso==="outbox"?e.message==="OUTBOX_SALDO_FALLIDO":[400,409].includes(e.statusCode));}
  finally{Outbox.create=crear;}
  assert.deepEqual(await estado(usuarioId),antes);
 }
}
module.exports={probarSaldosConversacionalesAutorizados};
