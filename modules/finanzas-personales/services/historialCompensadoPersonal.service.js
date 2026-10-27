"use strict";
const {consultarPeriodo}=require("./consultaCompensadaPersonal.service");
const CAMPOS=["_id","tipo","montoMinor","concepto","categoria","contraparte","fecha","estado","prestamoId"];
function filtrar(rows,f){
 const texto=String(f.q||"").toLowerCase();
 const tipos=new Set(["INGRESO","GASTO","COBRO_PRESTAMO"]);
 return rows.filter(t=>
  (f.estado==="ANULADA"?t.estado==="ANULADA":t.estado!=="ANULADA")&&
  (!tipos.has(f.tipo)||t.tipo===f.tipo)&&
  (f.monto===undefined||t.montoMinor===f.monto)&&
  (!texto||[t.concepto,t.categoria,t.contraparte,t.descripcion].some(s=>String(s||"").toLowerCase().includes(texto))))
  .sort((a,b)=>+new Date(b.fecha)-+new Date(a.fecha)||String(b._id).localeCompare(String(a._id)))
  .slice((f.pagina-1)*20,(f.pagina-1)*20+21)
  .map(t=>Object.fromEntries(CAMPOS.filter(k=>Object.hasOwn(t,k)).map(k=>[k,t[k]])));
}
async function buscar(usuarioId,f){
 if(!Number.isSafeInteger(f.pagina)||f.pagina<1||f.pagina>1000)throw new TypeError("Página inválida");
 const fin=f.hasta?new Date(f.hasta):new Date("9999-12-31T23:59:59.998Z");
 if(f.hasta)fin.setUTCHours(23,59,59,999);
 const rows=await consultarPeriodo({usuarioId,
  desde:f.desde?new Date(f.desde).toISOString():"0001-01-01T00:00:00.000Z",
  hasta:new Date(+fin+1).toISOString(),incluirAnuladas:true});
 return filtrar(rows,f);
}
module.exports={buscar,filtrar};
