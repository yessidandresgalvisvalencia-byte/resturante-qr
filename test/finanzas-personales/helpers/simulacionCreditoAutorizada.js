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
