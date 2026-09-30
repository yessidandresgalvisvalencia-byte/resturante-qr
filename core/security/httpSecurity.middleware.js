"use strict";
const crypto=require("crypto");
function securityHeaders(req,res,next){res.setHeader("X-Content-Type-Options","nosniff");res.setHeader("X-Frame-Options","DENY");res.setHeader("Referrer-Policy","no-referrer");res.setHeader("Permissions-Policy","camera=(), microphone=(), geolocation=()");res.setHeader("Cross-Origin-Resource-Policy","same-origin");res.setHeader("X-Request-Id",req.headers["x-request-id"]||crypto.randomUUID());next();}
function noStore(req,res,next){res.setHeader("Cache-Control","no-store, max-age=0");res.setHeader("Pragma","no-cache");next();}
module.exports={securityHeaders,noStore};