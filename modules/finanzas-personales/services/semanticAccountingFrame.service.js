"use strict";

function normalizar(texto){
 return String(texto||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9$.,\s]/g," ").replace(/\s+/g," ").trim();
}
function tiene(t,re){return re.test(t)}
function construirFrame(texto,{montoMinor=null}={}){
 const t=normalizar(texto),evidencia=[],faltantes=[];
 const pregunta=/^(?:cuanto|cuando|como|que|cual|donde|puedo|debo\s+(?:pagar|ahorrar|separar))\b/.test(t)||/\?$/.test(String(texto||"").trim());
 if(pregunta)return{acto:"CONSULTAR",naturaleza:"NO_CLASIFICADO",entidad:"NO_IDENTIFICADA",temporalidad:"ACTUAL",montoMinor,evidencia:["PREGUNTA"],faltantes:[]};

 const posesion=tiene(t,/\b(?:tengo|tenia|tenemos|cuento con|contaba con|dispongo de|disponia de|hay|me quedan?|me quedaron|mantengo|conservo)\b/);
 const preexistente=tiene(t,/\b(?:ya tenia|ya estaba|desde antes|de antes|existente|no habia registrado|sin registrar|no estaba registrado|se me olvido registrar|se me habia olvidado|no lo habia metido|no lo habia anotado|no te habia dicho|se me paso decir|me falto registrar|saldo)\b/);
 const ahorro=tiene(t,/\b(?:ahorro|ahorros|ahorrad[oa]s?|guardad[oa]s?|guardadit[oa]s?|plata aparte|platica aparte|dinero aparte|colchon)\b/);
 const efectivo=tiene(t,/\b(?:efectivo|billetera|cartera)\b/);
 const deuda=tiene(t,/\b(?:deuda|credito|prestamo|cuota|financiad[oa]|debo)\b/);
 const cobrar=tiene(t,/\b(?:me debe|me deben|por cobrar|me quedo debiendo|me quedaron debiendo)\b/);
 const pago=tiene(t,/\b(?:pague|pago|abone|abono|cancele)\b/);
 const consumo=tiene(t,/\b(?:gaste|compre|pague|costo|egreso)\b/);
 const ingreso=tiene(t,/\b(?:gane|recibi|me pagaron|me consignaron|ingreso|vendi)\b/);
 const transferencia=tiene(t,/\b(?:pase|transferi|movi|mande)\b/)&&tiene(t,/\b(?:nequi|daviplata|bancolombia|cuenta|ahorro|ahorros)\b/);
 const aporteAhorro=tiene(t,/\b(?:ahorre|guarde|meti|deposite|consigne)\b/)&&tiene(t,/\b(?:ahorro|ahorros|fondo|inversion|cuenta)\b/);

 let acto="NO_IDENTIFICADO",naturaleza="NO_CLASIFICADO",entidad="NO_IDENTIFICADA",temporalidad=preexistente?"PREEXISTENTE":"ACTUAL";
 if((posesion||preexistente)&&(ahorro||efectivo)){acto="DECLARAR_SALDO";naturaleza="PATRIMONIO";entidad=ahorro?"AHORRO":"EFECTIVO";evidencia.push("POSESION_O_SALDO");}
 else if(cobrar){acto="DECLARAR_CUENTA_POR_COBRAR";naturaleza="PATRIMONIO";entidad="CUENTA_POR_COBRAR";evidencia.push("DERECHO_DE_COBRO");}
 else if(transferencia){acto="TRANSFERIR";naturaleza="TRASPASO";entidad="CUENTA_PROPIA";evidencia.push("MOVIMIENTO_ENTRE_CUENTAS");}
 else if(aporteAhorro){acto="APORTAR_AHORRO";naturaleza="TRASPASO";entidad="AHORRO";evidencia.push("APORTE_A_ACTIVO");}
 else if(deuda&&pago){acto="PAGAR_OBLIGACION";naturaleza="PASIVO";entidad="DEUDA";evidencia.push("PAGO_DE_PASIVO");}
 else if(deuda){acto="DECLARAR_OBLIGACION";naturaleza="PASIVO";entidad="DEUDA";evidencia.push("OBLIGACION");}
 else if(ingreso){acto="RECIBIR";naturaleza="FLUJO";entidad="DINERO";evidencia.push("ENTRADA_REAL");}
 else if(consumo){acto="CONSUMIR";naturaleza="FLUJO";entidad="DINERO";evidencia.push("SALIDA_POR_CONSUMO");}

 if(!Number.isSafeInteger(montoMinor)||montoMinor<=0)faltantes.push("MONTO");
 if(naturaleza==="NO_CLASIFICADO")faltantes.push("NATURALEZA");
 return{acto,naturaleza,entidad,temporalidad,montoMinor,evidencia,faltantes:[...new Set(faltantes)]};
}
module.exports={normalizar,construirFrame};
