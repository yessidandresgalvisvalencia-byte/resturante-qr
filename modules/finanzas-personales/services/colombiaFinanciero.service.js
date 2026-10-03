"use strict";
const TZ="America/Bogota";
const HORMIGA=["rappi","didi food","uber eats","juan valdez","pergamino","oxxo","cafe","cafecito","tinto","antojo","mecato","gaseosa","trago","cerveza","pola","cigarrillo","domicilio"];
const FIJOS=["arriendo","alquiler","administracion","luz","energia","agua","gas domiciliario","internet","netflix","servicios","cuota","soat","tecnomecanica","colegio","guarderia","plan celular","eps","medicina prepagada"];
const VARIABLES=["mercado","salud","gasolina","transporte","bus","metro","taxi","uber","didi","parqueadero","peaje","farmacia","medicina","ropa"];
const INGRESOS=["salario","sueldo","nomina","quincena","prima","cesantias","freelance","camello","trabajo","venta","comision","propina","extra","rebusque","jornal","honorarios","arriendo recibido","dividendo"];
const DEUDAS=["tarjeta","credito","prestamo","deuda","gota a gota","pagadiario","paga diario","fiado","cuota","libranza","credito de moto","credito de carro","hipoteca"];
const BILLETERAS=["nequi","daviplata","dale","movii","bold","bancolombia a la mano"];
function normalizar(s){return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim();}
function contiene(t,lista){const n=normalizar(t);return lista.some(x=>n.includes(normalizar(x)));}
function clasificar(texto,tipo){if(tipo==="INGRESO"&&contiene(texto,INGRESOS))return"Salario";if(contiene(texto,HORMIGA))return"Gastos hormiga";if(contiene(texto,DEUDAS))return"Deuda";if(contiene(texto,FIJOS))return"Gastos fijos";if(contiene(texto,VARIABLES))return"Gastos variables";if(contiene(texto,INGRESOS))return"Salario";return tipo==="INGRESO"?"Otros ingresos":"Otros gastos";}
function contexto(texto){const n=normalizar(texto);return{billetera:BILLETERAS.find(x=>n.includes(x))?.toUpperCase()||null,esFiado:n.includes("fiado"),esGotaAGota:n.includes("gota a gota"),esQuincena:n.includes("quincena"),esPrima:n.includes("prima"),esCesantias:n.includes("cesantias"),esRebusque:n.includes("rebusque"),esPagadiario:n.includes("pagadiario")||n.includes("paga diario"),esPrestado:n.includes("prestado")||n.includes("me prestaron"),esVuelto:n.includes("vueltos")||n.includes("devuelta")};}
function fechaColombia(offsetDias=0){const p=new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const o=Object.fromEntries(p.map(x=>[x.type,x.value]));const base=new Date(Date.UTC(Number(o.year),Number(o.month)-1,Number(o.day)+offsetDias,17,0,0));return base;}
module.exports={TZ,HORMIGA,FIJOS,VARIABLES,INGRESOS,DEUDAS,BILLETERAS,normalizar,clasificar,contexto,fechaColombia};
