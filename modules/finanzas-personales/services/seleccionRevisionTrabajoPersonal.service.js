"use strict";
const mongoose=require("mongoose"),crypto=require("node:crypto");
function canonSeleccion(v){
 if(v instanceof Date)return v.toISOString();
 if(v instanceof mongoose.Types.ObjectId)return String(v);
 if(v===null||typeof v!=="object")return v;
 if(Array.isArray(v))return v.map(canonSeleccion);
 return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonSeleccion(v[k])]));
}
function versionSeleccion(usuarioId,cuentas){
 return crypto.createHash("sha256").update(JSON.stringify(canonSeleccion({contrato:"REVISION_TRABAJO_V1",usuarioId:String(usuarioId),cuentas}))).digest("hex");
}
module.exports={canonSeleccion,versionSeleccion};
