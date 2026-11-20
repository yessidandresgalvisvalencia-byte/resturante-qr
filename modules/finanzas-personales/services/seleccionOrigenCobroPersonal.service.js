"use strict";
const crypto=require("node:crypto"),{canonSeleccion}=require("./seleccionRevisionTrabajoPersonal.service");
function versionOrigen(usuarioId,p,eventos,movimientos){
 if(!p||String(p.usuarioId)!==String(usuarioId)||p.direccion!=="POR_COBRAR"||!Array.isArray(eventos)||!Array.isArray(movimientos))throw Object.assign(new Error("Selección de origen inválida"),{statusCode:409});
 const vinculados=movimientos.filter(m=>String(m.prestamoId)===String(p._id)).sort((a,b)=>String(a._id).localeCompare(String(b._id)));
 return crypto.createHash("sha256").update(JSON.stringify(canonSeleccion({contrato:"FP_ORIGEN_COBRO_SELECCION_V1",usuarioId:String(usuarioId),original:p,correcciones:eventos.map(e=>e.hashActual),movimientos:vinculados}))).digest("hex");
}
async function enSesion(usuarioId,p,eventos,session){
 const movimientos=await require("./consultaCompensadaPersonal.service").consultarPeriodo({usuarioId,desde:"0001-01-01T00:00:00.000Z",hasta:"9999-12-31T23:59:59.999Z"},{session});
 return versionOrigen(usuarioId,p,eventos,movimientos);
}
module.exports={versionOrigen,enSesion};
