"use strict";
const { validarObjetivosEmpresa } = require("./validators/objetivosEmpresa.validator");
const { obtenerConfiguracionInteligencia, actualizarConfiguracionInteligencia } = require("./configuracionInteligencia.service");
const { recomendarMargenObjetivo } = require("./recomendacionObjetivos.service");
function responderError(res,error,fallback){return res.status(error.statusCode||500).json({ok:false,error:error.message||fallback});}
async function obtener(req,res){try{return res.json({ok:true,configuracion:await obtenerConfiguracionInteligencia(req.auth.empresaId)});}catch(e){return responderError(res,e,"Error consultando configuración de inteligencia");}}
async function actualizar(req,res){try{const {error,value}=validarObjetivosEmpresa(req.body);if(error)return res.status(400).json({ok:false,error:"Configuración empresarial inválida",detalles:error.details.map(x=>x.message)});return res.json({ok:true,configuracion:await actualizarConfiguracionInteligencia({empresaId:req.auth.empresaId,valores:value,updatedBy:req.auth.usuarioId})});}catch(e){return responderError(res,e,"Error actualizando configuración de inteligencia");}}
async function recomendar(req,res){try{return res.json({ok:true,recomendacion:await recomendarMargenObjetivo(req.auth.empresaId)});}catch(e){return responderError(res,e,"Error construyendo recomendación empresarial");}}
module.exports={obtener,actualizar,recomendar};