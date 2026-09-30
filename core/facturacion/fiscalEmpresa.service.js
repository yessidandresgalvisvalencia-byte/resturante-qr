"use strict";
const mongoose=require("mongoose");
const Empresa=require("../../models/Empresa");
function oid(v){if(!mongoose.Types.ObjectId.isValid(v))throw Object.assign(new Error("empresaId inválido"),{statusCode:400});return new mongoose.Types.ObjectId(String(v));}
function limpio(v){const x=String(v??"").trim();return x||null;}
function normalizar(body={}){
 const nit=limpio(body.nit)?.replace(/[^0-9]/g,"")||null,dv=limpio(body.dv)?.replace(/[^0-9]/g,"")||null;
 if(nit&&!/^\d{6,15}$/.test(nit))throw Object.assign(new Error("NIT inválido"),{statusCode:400});
 if(dv&&!/^\d$/.test(dv))throw Object.assign(new Error("Dígito de verificación inválido"),{statusCode:400});
 return {nit,dv,razonSocial:limpio(body.razonSocial),nombreComercial:limpio(body.nombreComercial),tipoDocumento:"NIT",responsabilidadFiscal:limpio(body.responsabilidadFiscal),tributo:limpio(body.tributo)||"01",direccion:limpio(body.direccion),municipioCodigo:limpio(body.municipioCodigo),telefono:limpio(body.telefono),facturacionElectronica:{habilitada:Boolean(body.facturacionElectronica?.habilitada),proveedor:"FACTUS",numberingRangeId:limpio(body.facturacionElectronica?.numberingRangeId)}};
}
function estadoFiscal(fiscal={}){
 const req=[["nit","NIT"],["razonSocial","RAZON_SOCIAL"],["responsabilidadFiscal","RESPONSABILIDAD_FISCAL"],["direccion","DIRECCION"],["municipioCodigo","MUNICIPIO"],["facturacionElectronica.numberingRangeId","RANGO_NUMERACION"]];
 const faltantes=req.filter(([p])=>p.split(".").reduce((o,k)=>o?.[k],fiscal)==null).map(([,n])=>n);
 if(!fiscal.facturacionElectronica?.habilitada)faltantes.push("FACTURACION_NO_HABILITADA");
 return {completo:faltantes.length===0,faltantes};
}
async function obtener(empresaId){const e=await Empresa.findById(oid(empresaId)).select("nombre correo fiscal").lean();if(!e)throw Object.assign(new Error("Empresa no encontrada"),{statusCode:404});return {empresa:{nombre:e.nombre,correo:e.correo},fiscal:e.fiscal||{},estado:estadoFiscal(e.fiscal||{})};}
async function guardar({empresaId,body,usuarioId}){const fiscal=normalizar(body);fiscal.facturacionElectronica.actualizadoAt=new Date();fiscal.facturacionElectronica.actualizadoBy=mongoose.Types.ObjectId.isValid(usuarioId)?new mongoose.Types.ObjectId(String(usuarioId)):null;const e=await Empresa.findByIdAndUpdate(oid(empresaId),{$set:{fiscal,"modulos.facturacion":true}},{new:true,runValidators:true}).select("nombre correo fiscal").lean();if(!e)throw Object.assign(new Error("Empresa no encontrada"),{statusCode:404});return {empresa:{nombre:e.nombre,correo:e.correo},fiscal:e.fiscal,estado:estadoFiscal(e.fiscal)};}
module.exports={obtener,guardar,estadoFiscal};