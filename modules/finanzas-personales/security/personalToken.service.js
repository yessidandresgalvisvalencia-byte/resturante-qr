"use strict";
const jwt=require("jsonwebtoken");
const AUDIENCE="gruk-finanzas-personales",ISSUER="gruk";
function verifyPersonalToken(raw){if(!process.env.JWT_SECRET)throw new Error("JWT_SECRET requerido");const p=jwt.verify(raw,process.env.JWT_SECRET,{algorithms:["HS256"],audience:AUDIENCE,issuer:ISSUER});if(!p.sub||p.scope!=="finanzas:personal")throw new Error("Token personal inválido");return p;}
module.exports={verifyPersonalToken,AUDIENCE,ISSUER};