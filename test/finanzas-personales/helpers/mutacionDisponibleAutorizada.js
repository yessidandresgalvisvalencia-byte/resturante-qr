"use strict";
const assert=require("node:assert/strict"),crypto=require("node:crypto"),mongoose=require("mongoose");
const {crearControlMutacionesPersonales}=require("../../../public/finanzas-personales-control-mutaciones");
const patrimonio=require("../../../modules/finanzas-personales/services/patrimonioPersonal.service"),home=require("../../../modules/finanzas-personales/services/homePersonal.service");
const P=require("../../../modules/finanzas-personales/models/prestamoPersonal.model"),E=require("../../../modules/finanzas-personales/models/correccionPrestamoPersonal.model"),C=require("../../../modules/finanzas-personales/models/cuentaFinanciera.model"),T=require("../../../modules/finanzas-personales/models/TransaccionPersonal");
async function probarMutacionDisponibleAutorizada(){
 const usuarioId=new mongoose.Types.ObjectId(),uid=String(usuarioId),fecha=new Date(Date.now()-3600000),datos=new Map();
 const cuenta=await C.create({usuarioId,nombre:"Caja ficticia",tipo:"EFECTIVO",saldoMinor:5000,saldoAnclaMinor:5000,saldoAnclaEn:fecha,saldoVerificadoEn:fecha,requiereReconciliacion:false});
 const prestamo=await P.create({usuarioId,direccion:"POR_PAGAR",contraparte:"Ensayo",concepto:"Préstamo ficticio",principalMinor:1000,saldoMinor:1000,cuotaMinor:200,numeroCuotas:5,fechaInicio:fecha});
 const crear=()=>crearControlMutacionesPersonales({almacenamiento:{getItem:k=>datos.get(k)??null,setItem:(k,v)=>datos.set(k,v)},digerir:async s=>crypto.createHash("sha256").update(s).digest("hex"),usuarioDeToken:t=>t});
 const control=crear(),cambios={principalMinor:1200},key=crypto.randomUUID(),o={method:"PATCH",headers:{"Idempotency-Key":key},body:JSON.stringify({...cambios,confirmacion:true})};
 const op=await control.iniciar(uid,"/prestamos/"+prestamo._id,o);
 await patrimonio.corregirPrestamo(usuarioId,prestamo._id,cambios,{confirmacion:true,solicitudId:op.opciones.headers["Idempotency-Key"]});
 op.finalizar("INCIERTA");assert.equal((await P.findById(prestamo._id)).principalMinor,1200);assert.equal(control.estado(uid).bloqueada,true);
 // Leer el home real después del commit no constituye confirmación del envío perdido.
 const observado=await home.obtener(usuarioId);assert.ok(observado);assert.equal(control.estado(uid).bloqueada,true);
 const recarga=crear(),retry=await recarga.iniciar(uid,"/prestamos/"+prestamo._id,{...o,headers:{"Idempotency-Key":crypto.randomUUID()}});assert.equal(retry.opciones.headers["Idempotency-Key"],key);
 const recibo=await patrimonio.corregirPrestamo(usuarioId,prestamo._id,cambios,{confirmacion:true,solicitudId:retry.opciones.headers["Idempotency-Key"]});assert.equal(recibo.correccion.duplicado,true);retry.finalizar("CONFIRMADA");
 assert.equal(recarga.estado(uid).bloqueada,false);assert.equal(await E.countDocuments({usuarioId}),1);assert.equal(await T.countDocuments({usuarioId}),0);assert.equal((await C.findById(cuenta._id)).saldoMinor,5000);assert.equal((await P.findById(prestamo._id)).saldoMinor,1200);
}
module.exports={probarMutacionDisponibleAutorizada};
