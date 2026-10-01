"use strict";
const jwt=require("jsonwebtoken");const Identidad=require("../models/identidadPersonal.model");
const AUDIENCE="gruk-finanzas-personales",ISSUER="gruk";
function secret(){const value=process.env.PERSONAL_JWT_SECRET;if(!value)throw new Error("PERSONAL_JWT_SECRET requerido");return value;}
async function verifyPersonalToken(raw){const p=jwt.verify(raw,secret(),{algorithms:["HS256"],audience:AUDIENCE,issuer:ISSUER});if(!p.sub||p.scope!=="finanzas:personal")throw new Error("Token personal inválido");const id=await Identidad.findById(p.sub).select("estado tokenVersion").lean();if(!id||id.estado!=="ACTIVA"||Number(id.tokenVersion)!==Number(p.tokenVersion))throw new Error("Sesión revocada");return p;}
module.exports={verifyPersonalToken,AUDIENCE,ISSUER,secret};