"use strict";
const assert=require("node:assert/strict"),S=require("../../../modules/finanzas-personales/services/finanzasPersonales.service");
async function probarSimulacionSinEscrituras(db){
 const nombres=["fin_cuentas_financieras","fin_prestamos_personales","fin_transacciones","fin_creditos","fin_outbox_personal"];
 // El inventario completo usa el administrador del fixture, no credenciales de producción.
 const lista=(await db.listCollections().toArray()).map(x=>x.name).sort();
 const foto=async()=>{const out={};for(const name of lista)out[name]=await db.collection(name).find({}).sort({_id:1}).toArray();return out;};
 assert.ok(lista.length>=nombres.length);const antes=await foto();
 const d={capital:1000000,tasaMensualPct:"1.9",meses:12,cargosIniciales:0,fechaDesembolso:"2026-01-31",fechaPrimerPago:"2026-02-28"};
 const respuestas=await Promise.all(Array.from({length:8},()=>Promise.resolve().then(()=>S.simularCredito(d))));
 for(const r of respuestas){assert.deepEqual(r,respuestas[0]);assert.equal(r.costoTotal,"1127757.91");assert.equal(r.ultimaCuotaCop,"93979.78");assert.equal(r.creaDeuda,false);assert.equal(r.autorizaCredito,false);}
 for(const cambio of [{capital:0.1},{cargosIniciales:undefined},{fechaPrimerPago:"2026-02-30"},{tasaMensualPct:"1e-2"}])assert.throws(()=>S.simularCredito({...d,...cambio}),e=>e.statusCode===422);
 assert.deepEqual(await foto(),antes);
}
module.exports={probarSimulacionSinEscrituras};
async function probarSimulacionConversacional(db){
 const mongoose=require("mongoose"),P=require("../../../modules/finanzas-personales/services/conversacionPersonal.service"),C=require("../../../modules/finanzas-personales/models/contextoConversacionalPersonal.model"),u=new mongoose.Types.ObjectId(),otro=new mongoose.Types.ObjectId();
 const texto="Quiero comprar zapatos que valen 280 mil en 2 cuotas al 4% una sola vez sobre cada cuota base sin cargos";
 await C.create({usuarioId:u,ultimaCompraPlanificada:{concepto:"zapatos",descripcion:texto,creadoEn:new Date()},asOf:new Date()});
 const lista=(await db.listCollections().toArray()).map(x=>x.name).sort(),foto=async()=>{const out={};for(const name of lista)out[name]=await db.collection(name).find({}).sort({_id:1}).toArray();return out;},antes=await foto();
 for(const owner of [u,otro]){for(let i=0;i<3;i++){const r=await P.procesar(owner,{texto});assert.equal(r.analisis.simulacion.total,"291200.00");assert.equal(r.analisis.simulacion.cubrePrimeraCuota,null);assert.equal(r.requiereAprobacion,false);assert.equal(r.mensaje.split("\n").length,6);}
 for(const t of [texto.replace("sin cargos",""),texto.replace("una sola vez sobre cada cuota base",""),texto.replace("280 mil","1.000,50")]){const r=await P.procesar(owner,{texto:t});assert.equal(r.analisis.simulacion,null);assert.equal(r.analisis.autorizaCredito,false);}}
 const mensual=await P.procesar(u,{texto:"simula precio 1000000 en 12 cuotas al 1,9% mensual sobre saldo sin cargos desembolso 2026-01-31 primer pago 2026-02-28"});assert.equal(mensual.analisis.simulacion.total,"1127757.91");assert.equal(mensual.analisis.simulacion.cuotas.at(-1),"93979.78");
 const aislado=await P.procesar(u,{texto:"valen 280 mil"});assert.equal(aislado.analisis.simulacion,null);assert.equal(aislado.analisis.autorizaCredito,false);
 assert.deepEqual(await foto(),antes);
}
module.exports.probarSimulacionConversacional=probarSimulacionConversacional;
