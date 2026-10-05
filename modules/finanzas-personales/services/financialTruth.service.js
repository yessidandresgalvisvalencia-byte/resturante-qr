"use strict";
const TIPOS=Object.freeze(["HECHO","INFERENCIA","PROYECCION","DECISION"]);
const CONFIANZAS=Object.freeze(["VERIFICADO","ALTA","MEDIA","BAJA","NO_VERIFICADO"]);
function assertMinor(n){if(!Number.isSafeInteger(n))throw new TypeError("El valor monetario debe ser entero seguro");return n;}
function crear({tipo,montoMinor,fuente,corte=new Date(),confianza="NO_VERIFICADO",requiereReconciliacion=false,evidencia=[]}){
 if(!TIPOS.includes(tipo))throw new TypeError("Tipo de verdad financiera inválido");
 assertMinor(montoMinor);
 if(typeof fuente!=="string"||!fuente.trim())throw new TypeError("La fuente financiera es obligatoria");
 const fecha=new Date(corte);if(Number.isNaN(fecha.getTime()))throw new TypeError("Fecha de corte inválida");
 if(!CONFIANZAS.includes(confianza))throw new TypeError("Confianza financiera inválida");
 if(!Array.isArray(evidencia))throw new TypeError("La evidencia debe ser una lista");
 return Object.freeze({tipo,montoMinor,fuente:fuente.trim(),corte:fecha,confianza,requiereReconciliacion:Boolean(requiereReconciliacion),evidencia:[...evidencia]});
}
function hecho(x){return crear({...x,tipo:"HECHO"});}
function inferencia(x){return crear({...x,tipo:"INFERENCIA",requiereReconciliacion:x.requiereReconciliacion!==false});}
function proyeccion(x){return crear({...x,tipo:"PROYECCION"});}
function decision(x){return crear({...x,tipo:"DECISION"});}
module.exports={TIPOS,CONFIANZAS,crear,hecho,inferencia,proyeccion,decision};
