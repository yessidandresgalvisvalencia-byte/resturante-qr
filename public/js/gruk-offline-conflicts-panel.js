/* GRUK admin audit UI: this page never posts inventory, money or sales. */
(function(root){
"use strict";
const ACTIONS=["ACUSAR_RECIBO","SOLICITAR_REABASTECIMIENTO","ESCALAR_AUDITORIA"];
const ULID_CHARS="0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function createDecisionId(cryptoSource=root.crypto,now=Date.now()){
 if(typeof cryptoSource?.getRandomValues!=="function"||
  !Number.isSafeInteger(now)||now<0||now>281474976710655)
  throw Error("OFFLINE_REVIEW_CRYPTO_REQUIRED");
 let time=BigInt(now),prefix="";
 for(let i=0;i<10;i++){prefix=ULID_CHARS[Number(time%32n)]+prefix;time/=32n;}
 const bytes=new Uint8Array(16);cryptoSource.getRandomValues(bytes);
 return prefix+Array.from(bytes,b=>ULID_CHARS[b%32]).join("");
}
function tokenFrom(storage){
 const token=storage?.getItem("grukAuthToken");
 if(typeof token!=="string"||!token.trim())throw Error("OFFLINE_REVIEW_AUTH_REQUIRED");
 return token;
}
async function list({token,fetchFn}){
 const res=await fetchFn("/api/sync/stock-conflicts",{method:"GET",
  headers:{Authorization:"Bearer "+token},cache:"no-store",credentials:"same-origin"});
 if(res.status!==200)throw Error("OFFLINE_REVIEW_LIST_UNAVAILABLE");
 const data=await res.json();
 if(data?.ok!==true||data.readOnly!==true||!Array.isArray(data.conflicts)||data.conflicts.length>50)
  throw Error("OFFLINE_REVIEW_INVALID_LIST");
 return data.conflicts;
}
async function review({token,fetchFn,conflictId,action,note,decisionId}){
 if(!/^offline-stock-[a-f0-9]{64}$/.test(conflictId||"")||
  !/^[0-9A-HJKMNP-TV-Z]{26}$/.test(decisionId||"")||
  !ACTIONS.includes(action)||typeof note!=="string"||note.trim().length<10||note.trim().length>500)
  throw Error("OFFLINE_REVIEW_INVALID_DECISION");
 const response=await fetchFn("/api/sync/stock-conflicts/review",{
  method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
  cache:"no-store",credentials:"same-origin",
  body:JSON.stringify({conflictId,decisionId,action,note:note.trim()})
 });
 if(response.status!==201)throw Error("OFFLINE_REVIEW_SAVE_UNAVAILABLE");
 const data=await response.json();
 if(data?.ok!==true||data.decisionId!==decisionId||data.conflictId!==conflictId||
  data.applied!==false||data.cobrado!==false)
  throw Error("OFFLINE_REVIEW_INVALID_RESPONSE");
 return data;
}
async function preflight({token,fetchFn,conflictId}){
 if(typeof token!=="string"||!token.trim())throw Error("OFFLINE_REVIEW_AUTH_REQUIRED");
 if(!/^offline-stock-[a-f0-9]{64}$/.test(conflictId||""))
  throw Error("OFFLINE_REVIEW_INVALID_CONFLICT");
 const response=await fetchFn("/api/sync/stock-conflicts/preflight?conflictId="+encodeURIComponent(conflictId),{
  method:"GET",headers:{Authorization:"Bearer "+token},cache:"no-store",credentials:"same-origin"
 });
 if(response.status!==200)throw Error("OFFLINE_REVIEW_PREFLIGHT_UNAVAILABLE");
 const result=await response.json();
 if(result?.ok!==true||result.readOnly!==true||result.conflictId!==conflictId||
   typeof result.ready!=="boolean"||result.applied!==false||result.cobrado!==false||
   result.inventoryChanges!==false||!Array.isArray(result.products))
  throw Error("OFFLINE_REVIEW_INVALID_PREFLIGHT");
 return result;
}
function start({document,storage,fetchFn,cryptoSource}){
 const box=document.getElementById("conflicts"),notice=document.getElementById("notice"),
  button=document.getElementById("loadConflicts");
 async function refresh(){
  button.disabled=true;box.replaceChildren();notice.textContent="Consultando incidencias…";
  try{
   const token=tokenFrom(storage),records=await list({token,fetchFn});
   if(!records.length)notice.textContent="No hay incidencias abiertas en esta empresa y sede.";
   else notice.textContent=records.length+" incidencias encontradas. Solo revisión administrativa.";
   for(const item of records){
    if(!/^offline-stock-[a-f0-9]{64}$/.test(item?.conflictId||"")||!Array.isArray(item.issues))continue;
    const article=document.createElement("article");
    const heading=document.createElement("h3");heading.textContent="Incidencia "+item.conflictId.slice(-10);
    article.appendChild(heading);
    const summary=document.createElement("p");
    summary.textContent=item.issues.map(x=>"Producto "+x.productoId+" · Disponible "+x.disponible+
      " · Solicitado "+x.solicitado+" · Faltante "+x.faltante).join(" | ");
    article.appendChild(summary);
    const check=document.createElement("button");check.type="button";
    check.textContent="Verificar stock actual (sin cambios)";
    const outcome=document.createElement("p");outcome.textContent="Stock actual sin verificar";
    check.addEventListener("click",async()=>{
     check.disabled=true;
     try{
      const status=await preflight({token,fetchFn,conflictId:item.conflictId});
      outcome.textContent=status.ready?
       "Ahora hay stock suficiente para nueva revisión. NO se ha procesado el pedido ni modificado inventario.":
       "El faltante sigue pendiente o los eventos requieren revisión. No se modificó inventario.";
     }catch(error){outcome.textContent="No se pudo verificar: "+(error.message||"error");}
     finally{check.disabled=false;}
    });
    article.appendChild(check);article.appendChild(outcome);
    const select=document.createElement("select");
    for(const action of ACTIONS){const option=document.createElement("option");
      option.value=action;option.textContent=action.replace(/_/g," ");select.appendChild(option);}
    article.appendChild(select);
    const note=document.createElement("textarea");note.placeholder="Motivo de revisión (10 a 500 caracteres)";
    article.appendChild(note);
    const save=document.createElement("button");save.type="button";save.textContent="Registrar decisión";
    save.addEventListener("click",async()=>{
     save.disabled=true;
     try{
      const result=await review({token,fetchFn,conflictId:item.conflictId,
       decisionId:createDecisionId(cryptoSource),action:select.value,note:note.value});
      notice.textContent="Decisión registrada: "+result.decisionId+". Sin movimiento de inventario ni caja.";
     }catch(error){notice.textContent="No se registró la decisión: "+(error.message||"error");}
     finally{save.disabled=false;}
    });article.appendChild(save);box.appendChild(article);
   }
  }catch(error){notice.textContent="No se pudo consultar: "+(error.message||"error");}
  finally{button.disabled=false;}
 }
 button.addEventListener("click",refresh);
 return {refresh};
}
const api=Object.freeze({createDecisionId,tokenFrom,list,review,preflight,start});
if(typeof module==="object"&&module.exports)module.exports=api;
else{root.GRUKOfflineConflictsPanel=api;
 if(root.document){const run=()=>start({document:root.document,storage:root.localStorage,
  fetchFn:root.fetch.bind(root),cryptoSource:root.crypto}).refresh();
 if(root.document.readyState==="loading")root.document.addEventListener("DOMContentLoaded",run);
 else run();}
}
})(typeof globalThis!=="undefined"?globalThis:this);
