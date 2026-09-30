"use strict";
const s=require("./fiscalEmpresa.service");
function fail(res,e){return res.status(e.statusCode||500).json({ok:false,error:e.statusCode?e.message:"Error interno configurando facturación"});}
async function obtener(req,res){try{return res.json({ok:true,...await s.obtener(req.auth.empresaId)});}catch(e){return fail(res,e);}}
async function guardar(req,res){try{return res.json({ok:true,...await s.guardar({empresaId:req.auth.empresaId,body:req.body,usuarioId:req.auth.usuarioId})});}catch(e){return fail(res,e);}}
module.exports={obtener,guardar};