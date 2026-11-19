"use strict";
(function(raiz){
 function montarHistorialRevisionTrabajo({documento,api,tokenActual,usuarioDeToken,alVerificar=async()=>false}){
  const el=id=>documento.getElementById(id),lista=el("revisionHistorialLista"),mensaje=el("revisionHistorialEstado"),abrir=el("revisionHistorialConsultar"),anterior=el("revisionHistorialAnterior"),proximo=el("revisionHistorialSiguiente");
  let generacion=0,operacion=null,cursor=null,siguiente=null,pila=[];
  const vigente=(t,g)=>generacion===g&&tokenActual()===t&&!!usuarioDeToken(t)&&!el("app").hidden;
  function botones(){abrir.disabled=!!operacion;anterior.disabled=!!operacion||!pila.length;proximo.disabled=!!operacion||!siguiente;}
  function limpiar(){generacion++;operacion=null;cursor=null;siguiente=null;pila=[];lista.replaceChildren();mensaje.textContent="Consulta tus recibos históricos con conexión. No registra pagos ni modifica caja.";botones();}
  const valido=r=>r&&typeof r.solicitudId==="string"&&/^[A-Za-z0-9_-]{8,100}$/.test(r.solicitudId)&&typeof r.fecha==="string"&&Number.isFinite(Date.parse(r.fecha))&&new Date(r.fecha).toISOString()===r.fecha&&/^[a-f0-9]{64}$/.test(r.hash||"")&&Number.isSafeInteger(r.corregidos)&&r.corregidos>=0&&["CORREGIDO","SIN_CAMBIOS","REQUIERE_REVISION","NO_APLICADA"].includes(r.estado)&&r.verificacionFuentesPendiente===true&&(r.estado==="NO_APLICADA"?r.corregidos===0&&r.requierenRevisionManual===null:Number.isSafeInteger(r.requierenRevisionManual)&&r.requierenRevisionManual>=0);
  async function verificar(fila){if(operacion)return;const t=tokenActual(),g=generacion;if(!vigente(t,g))return;const op={};operacion=op;botones();mensaje.textContent="Verificando recibo, fuentes originales y cadena…";
   try{const r=await api("/reconciliar-ingresos-trabajo/recibos/"+encodeURIComponent(fila.solicitudId));if(!vigente(t,g))return;
    if(r.recibo?.confirmado!==true||r.recibo.usuarioId!==usuarioDeToken(t)||r.recibo.solicitudId!==fila.solicitudId||r.recibo.hash!==fila.hash||r.recibo.certificaEstadoActual!==false||r.recibo.afectaCaja!==false||r.corregidos!==fila.corregidos||r.requierenRevisionManual!==fila.requierenRevisionManual||r.estado!==fila.estado||r.recibo.noAplicada!==(fila.estado==="NO_APLICADA"))throw Error("El recibo no coincide con el resumen; conserva la incertidumbre.");
    const cerrado=await alVerificar(r,()=>vigente(t,g));if(!vigente(t,g))return;
    mensaje.textContent="Recibo histórico verificado: "+fila.estado+" · "+r.corregidos+" reclasificación(es). "+(cerrado?"Pendiente local correspondiente confirmado. ":"")+"No se repitió la revisión; no acredita saldo actual ni banco.";
   }catch(e){if(vigente(t,g))mensaje.textContent="No se pudo verificar el recibo: "+e.message+". No confirma pagos ni resuelve pendientes.";}finally{if(operacion===op){operacion=null;botones();}}
  }
  function render(filas){lista.replaceChildren();for(const fila of filas){const row=documento.createElement("div"),texto=documento.createElement("p"),b=documento.createElement("button");row.className="draft";texto.textContent=new Intl.DateTimeFormat("es-CO",{timeZone:"America/Bogota",dateStyle:"medium",timeStyle:"short"}).format(new Date(fila.fecha))+" · "+fila.estado+" · "+fila.corregidos+" reclasificación(es) · Solicitud "+fila.solicitudId+" · Hash "+fila.hash+". Resumen: verifica las fuentes en la consulta individual.";b.type="button";b.className="secondary";b.textContent="Verificar recibo";b.onclick=()=>verificar(fila);row.append(texto,b);lista.append(row);}}
  async function consultar(modo="INICIO"){if(operacion)return;const t=tokenActual(),g=generacion;if(!vigente(t,g))return;if(modo==="SIGUIENTE"&&!siguiente||modo==="ANTERIOR"&&!pila.length)return;
   const destino=modo==="SIGUIENTE"?siguiente:modo==="ANTERIOR"?pila.at(-1):null,op={};operacion=op;botones();mensaje.textContent="Consultando historial propio de solo lectura…";
   try{const r=await api("/reconciliar-ingresos-trabajo/recibos"+(destino?"?cursor="+encodeURIComponent(destino):""));if(!vigente(t,g))return;
    if(r.soloLectura!==true||r.certificaEstadoActual!==false||!Array.isArray(r.recibos)||r.recibos.length>20||r.recibos.some(f=>!valido(f))||new Set(r.recibos.map(f=>f.solicitudId)).size!==r.recibos.length||r.siguiente!==null&&(typeof r.siguiente!=="string"||!/^[a-f0-9]{24}$/.test(r.siguiente)||r.recibos.length!==20||r.siguiente===destino))throw Error("Página de recibos incompleta o no verificable.");
    if(modo==="SIGUIENTE")pila.push(cursor);else if(modo==="ANTERIOR")pila.pop();else pila=[];cursor=destino;siguiente=r.siguiente;render(r.recibos);mensaje.textContent=r.recibos.length?"Resúmenes históricos consultados. Usa Verificar recibo para comprobar sus fuentes; esta lista no confirma operaciones pendientes.":"No hay recibos en esta página. No demuestra que una solicitud sin respuesta nunca se haya ejecutado.";
   }catch(e){if(vigente(t,g)){lista.replaceChildren();cursor=null;siguiente=null;pila=[];mensaje.textContent="No se pudo consultar el historial: "+e.message+". Conserva tus solicitudes originales.";}}finally{if(operacion===op){operacion=null;botones();}}
  }
  abrir.onclick=()=>consultar();anterior.onclick=()=>consultar("ANTERIOR");proximo.onclick=()=>consultar("SIGUIENTE");limpiar();return{consultar,limpiar};
 }
 if(typeof module!=="undefined"&&module.exports)module.exports={montarHistorialRevisionTrabajo};else raiz.montarHistorialRevisionTrabajo=montarHistorialRevisionTrabajo;
})(typeof window!=="undefined"?window:globalThis);
