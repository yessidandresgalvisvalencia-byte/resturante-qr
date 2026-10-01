"use strict";
const jwt=require("jsonwebtoken");const Identidad=require("../models/identidadPersonal.model");
const AUDIENCE="gruk-finanzas-personales",ISSUER="gruk";
async function verifyPersonalToken(raw){if(!process.env.JWT_SECRET)throw new Error("JWT_SECRET requerido");const p=jwt.verify(raw,process.env.JWT_SECRET,{algorithms:["HS256"],audience:AUDIENCE,issuer:ISSUER});if(!p.sub||p.scope!=="finanzas:personal")throw new Error("Token personal inválido");const id=await Identidad.findById(p.sub).select("estado tokenVersion").lean();if(!id||id.estado!=="ACTIVA"||Number(id.tokenVersion)!==Number(p.tokenVersion))throw new Error("Sesión revocada");return p;}
module.exports={verifyPersonalToken,AUDIENCE,ISSUER};