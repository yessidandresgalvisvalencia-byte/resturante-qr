"use strict";
(function(raiz){
 function crearControlMutacionesPersonales({almacenamiento,digerir,usuarioDeToken,invalidar=()=>{},validarConstancia=async()=>false}){
  const estados=new Map(),MAX=100,PREFIJO="gruk.fp.operacionesPendientes.v81:";
  const falla=m=>Object.assign(new Error(m),{code:"OPERACION_PERSONAL_NO_CONFIRMADA"});
  const canon=v=>v&&typeof v==="object"?(Array.isArray(v)?v.map(canon):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])]))):v;
  function cargar(token){
   const usuario=usuarioDeToken(token);if(!usuario)throw falla("No se pudo identificar la sesión para conservar la operación");
   if(!estados.has(usuario)){
    const s={usuario,revision:0,pendientes:new Map(),activas:new Set(),error:false};
    try{const texto=almacenamiento.getItem(PREFIJO+usuario),filas=texto===null?[]:JSON.parse(texto);
     if(!Array.isArray(filas)||filas.length>MAX)throw Error();
     for(const p of filas){if(!p||Object.keys(p).length!==3||typeof p.id!=="string"||!p.id||p.id.length>200||!/^[a-f0-9]{64}$/.test(p.huella)||!["header","externalId","solicitudId","sin_clave"].includes(p.tipo)||s.pendientes.has(p.id))throw Error();s.pendientes.set(p.id,p);}
    }catch{s.error=true;}
    estados.set(usuario,s);
   }return estados.get(usuario);
  }
  function guardar(s){try{almacenamiento.setItem(PREFIJO+s.usuario,JSON.stringify([...s.pendientes.values()]));}catch{s.error=true;throw falla("No se pudo conservar la confirmación pendiente. No se enviará otra operación");}}
  function cambio(s){s.revision++;invalidar(s.usuario);}
  function estado(token){try{const s=cargar(token);return{usuario:s.usuario,revision:s.revision,bloqueada:s.error||s.pendientes.size>0||s.activas.size>0,pendientes:s.pendientes.size,motivo:s.error?"No se pudo verificar el registro local de operaciones pendientes":"Hay operaciones pendientes de confirmar. Reintenta con los mismos datos; actualizar el panel no confirma su resultado"};}catch{return{usuario:null,revision:0,bloqueada:true,motivo:"No se pudo verificar la sesión y sus operaciones pendientes"};}}
  function esMutacion(path,o,token){return !!token&&!/^(GET|HEAD)$/i.test(o.method||"GET")&&!/^\/auth\//.test(path)&&!(["/consulta","/copilot"].includes(path)&&/^POST$/i.test(o.method||"GET"))&&!["/gastos/evaluar","/creditos/simular","/creditos/evaluar","/transacciones/confirmar-intento","/transacciones/constancia-intento"].includes(path);}
  function datos(path,o){
   let cuerpo={};if(o.body!==undefined){try{cuerpo=JSON.parse(o.body);if(!cuerpo||typeof cuerpo!=="object"||Array.isArray(cuerpo))throw Error();}catch{throw falla("La operación requiere un cuerpo JSON verificable");}}
   const headers={...(o.headers||{})},nombre=Object.keys(headers).find(k=>k.toLowerCase()==="idempotency-key");
   if([!!nombre,typeof cuerpo.externalId==="string",typeof cuerpo.solicitudId==="string"].filter(Boolean).length>1)throw falla("Mecanismo de reintento ambiguo; requiere revisión");
   const tipo=nombre?"header":typeof cuerpo.externalId==="string"?"externalId":typeof cuerpo.solicitudId==="string"?"solicitudId":"sin_clave";
   const id=nombre?headers[nombre]:tipo==="sin_clave"?null:cuerpo[tipo];
   const contenido={...cuerpo};delete contenido.externalId;delete contenido.solicitudId;
   return{cuerpo,headers,nombre,tipo,id,contenido:JSON.stringify(canon({metodo:(o.method||"GET").toUpperCase(),path,cuerpo:contenido}))};
  }
  async function iniciar(token,path,o){
   const s=cargar(token);if(s.error)throw falla("No se pudo verificar el registro local de operaciones; requiere revisión");
   const d=datos(path,o),huella=await digerir(d.contenido);
   if(!/^[a-f0-9]{64}$/.test(huella))throw falla("No se pudo identificar la operación");
   let previa=[...s.pendientes.values()].find(p=>p.huella===huella);
   if(!previa&&[...s.pendientes.values()].some(p=>p.tipo==="sin_clave"&&!s.activas.has(p.id)))throw falla("Hay una operación incierta sin reintento seguro. Requiere revisión antes de registrar otra");
   if((["/prestamos","/creditos","/cuentas","/activos","/inversiones"].includes(path)||/^\/(cuentas|activos|inversiones)\/[a-f0-9]{24}\/(conciliar|retirar|restaurar-retiro)$/.test(path))&&!previa&&[...s.pendientes.values()].some(p=>p.tipo==="header"&&/^(prestamo_|credito_|cuenta_|activo_|inversion_|conciliacion_|ciclo_cuenta_|ciclo_activo_|ciclo_inversion_)/.test(p.id)))throw falla("Hay una operación patrimonial sin confirmar. Consulta su recibo o reintenta con los mismos datos originales");
   if(previa&&s.activas.has(previa.id))throw falla("Esta operación ya está en curso");
   if(previa&&previa.tipo==="sin_clave")throw falla("Esta operación quedó sin confirmar y no tiene reintento seguro. Requiere revisión del historial; no la registres de nuevo");
   if(previa&&previa.tipo!==d.tipo)throw falla("El mecanismo de reintento cambió; requiere revisión");
   if(d.tipo!=="sin_clave"&&(typeof d.id!=="string"||!d.id||d.id.length>200))throw falla("Identificador de operación inválido");
   const incierta=!!previa,id=previa?.id||d.id||("sin_clave_"+huella);
   if(typeof id!=="string"||!id||id.length>200)throw falla("Identificador de operación inválido");
   if(!previa&&s.pendientes.has(id))throw falla("La clave pendiente pertenece a otros datos; conserva la operación anterior");
   if(!previa&&s.pendientes.size>=MAX)throw falla("Demasiadas operaciones pendientes; requiere revisión");
   const p=previa||{id,huella,tipo:d.tipo};s.pendientes.set(id,p);guardar(s);s.activas.add(id);cambio(s);
   if(d.tipo==="header")d.headers[d.nombre]=id;else if(d.tipo!=="sin_clave")d.cuerpo[d.tipo]=id;
   let terminada=false;
   return{opciones:{...o,headers:d.headers,...(o.body!==undefined?{body:JSON.stringify(d.cuerpo)}:{})},finalizar(resultado){
    if(terminada)return;terminada=true;s.activas.delete(id);
    // Una respuesta perdida nunca se resuelve solo por leer saldos después.
    if(resultado==="CONFIRMADA"||resultado==="NO_ENVIADA"&&!incierta||resultado==="RECHAZADA"&&!incierta){
     s.pendientes.delete(id);try{guardar(s);}catch(e){s.pendientes.set(id,p);cambio(s);throw e;}
    }cambio(s);
   }};
  }
  async function confirmarRegistro(token,cuerpo){
   const s=cargar(token);if(s.error)return;
   const d=datos("/transacciones",{method:"POST",body:JSON.stringify(cuerpo)}),huella=await digerir(d.contenido);
   const p=s.pendientes.get(cuerpo.externalId);if(p?.tipo==="externalId"&&p.huella===huella){s.pendientes.delete(p.id);try{guardar(s);}catch(e){s.pendientes.set(p.id,p);cambio(s);throw e;}cambio(s);}
  }
  async function confirmarConstancia(token,r,cuerpo,vigente=()=>true){if(!vigente()||!await validarConstancia(r,{usuarioId:usuarioDeToken(token),cuerpo})||!vigente())return false;if(!["ANULADA","CORREGIDA"].includes(r.estado))return false;const d=datos("/transacciones",{method:"POST",body:JSON.stringify(cuerpo)}),huella=await digerir(d.contenido);if(!vigente())return false;const s=cargar(token),p=s.pendientes.get(cuerpo.externalId);if(s.error)return false;if(!p)return true;if(p.tipo!=="externalId"||p.huella!==huella||s.activas.has(p.id))return false;s.pendientes.delete(p.id);try{guardar(s);}catch(e){s.pendientes.set(p.id,p);cambio(s);throw e;}cambio(s);return true;}
  function pendientes(token){const s=cargar(token);if(s.error)throw falla("El registro local requiere revisión");return [...s.pendientes.values()].filter(p=>!s.activas.has(p.id)).map(p=>({...p}));}
  async function confirmarAprobacion(token,recibo){
   if(typeof recibo?.versionBorrador!=="string"||!/^[a-f0-9]{64}$/.test(recibo.versionBorrador)||recibo.confirmado!==true||recibo.certificaEstadoActual!==false||!/^[a-f0-9]{64}$/.test(recibo.hash||"")||recibo.metodo!=="POST"||typeof recibo.solicitudId!=="string"||!/^aprobacion_[A-Za-z0-9_-]+$/.test(recibo.solicitudId)||!/^\/captura\/[a-f0-9]{24}(?:\/items\/[a-f0-9]{24})?\/aprobar$/.test(recibo.ruta||""))return false;
   const s=cargar(token);if(s.error)return false;const p=s.pendientes.get(recibo.solicitudId);if(!p||p.tipo!=="header"||s.activas.has(p.id))return false;
   const d=datos(recibo.ruta,{method:"POST",body:JSON.stringify({confirmacion:true,versionBorrador:recibo.versionBorrador})}),huella=await digerir(d.contenido);if(p.huella!==huella)return false;
   s.pendientes.delete(p.id);try{guardar(s);}catch(e){s.pendientes.set(p.id,p);cambio(s);throw e;}cambio(s);return true;
  }
  function reciboPrestamoValido(token,recibo){
   if(recibo?.confirmado!==true||recibo.certificaEstadoActual!==false||!["/prestamos","/creditos"].includes(recibo.ruta)||recibo.metodo!=="POST"||!(recibo.ruta==="/creditos"?/^credito_[A-Za-z0-9_-]{8,80}$/:/^prestamo_[A-Za-z0-9_-]{8,80}$/).test(recibo.solicitudId||"")||!/^[a-f0-9]{24}$/.test(recibo.prestamoId||"")||!/^[a-f0-9]{64}$/.test(recibo.hash||"")||!/^[a-f0-9]{64}$/.test(recibo.solicitudHuella||""))return false;
   const s=cargar(token),p=s.pendientes.get(recibo.solicitudId);return !s.error&&p?.tipo==="header"&&p.huella===recibo.solicitudHuella;
  }
  function confirmarCreacionPrestamo(token,recibo){
   if(!reciboPrestamoValido(token,recibo))return false;const s=cargar(token),p=s.pendientes.get(recibo.solicitudId);if(s.activas.has(p.id))return false;
   s.pendientes.delete(p.id);try{guardar(s);}catch(e){s.pendientes.set(p.id,p);cambio(s);throw e;}cambio(s);return true;
  }
  function reciboCuentaValido(token,r){
   if(r?.confirmado!==true||r.certificaEstadoActual!==false||r.ruta!=="/cuentas"||r.metodo!=="POST"||!/^cuenta_[A-Za-z0-9_-]{8,80}$/.test(r.solicitudId||"")||!/^[a-f0-9]{24}$/.test(r.cuentaId||"")||!/^[a-f0-9]{64}$/.test(r.hash||"")||!/^[a-f0-9]{64}$/.test(r.solicitudHuella||""))return false;
   const s=cargar(token),p=s.pendientes.get(r.solicitudId);return !s.error&&p?.tipo==="header"&&p.huella===r.solicitudHuella;
  }
  function confirmarCreacionCuenta(token,r){
   if(!reciboCuentaValido(token,r))return false;const s=cargar(token),p=s.pendientes.get(r.solicitudId);if(s.activas.has(p.id))return false;
   s.pendientes.delete(p.id);try{guardar(s);}catch(e){s.pendientes.set(p.id,p);cambio(s);throw e;}cambio(s);return true;
  }
  function reciboActivoValido(token,r){
   if(r?.confirmado!==true||r.certificaEstadoActual!==false||r.ruta!=="/activos"||r.metodo!=="POST"||!/^activo_[A-Za-z0-9_-]{8,80}$/.test(r.solicitudId||"")||!/^[a-f0-9]{24}$/.test(r.activoId||"")||!/^[a-f0-9]{64}$/.test(r.hash||"")||!/^[a-f0-9]{64}$/.test(r.solicitudHuella||""))return false;
   const s=cargar(token),p=s.pendientes.get(r.solicitudId);return !s.error&&p?.tipo==="header"&&p.huella===r.solicitudHuella;
  }
  function confirmarCreacionActivo(token,r){
   if(!reciboActivoValido(token,r))return false;const s=cargar(token),p=s.pendientes.get(r.solicitudId);if(s.activas.has(p.id))return false;
   s.pendientes.delete(p.id);try{guardar(s);}catch(e){s.pendientes.set(p.id,p);cambio(s);throw e;}cambio(s);return true;
  }
  function reciboInversionValido(token,r){
   if(r?.confirmado!==true||r.certificaEstadoActual!==false||r.ruta!=="/inversiones"||r.metodo!=="POST"||!/^inversion_[A-Za-z0-9_-]{8,80}$/.test(r.solicitudId||"")||!/^[a-f0-9]{24}$/.test(r.inversionId||"")||!/^[a-f0-9]{64}$/.test(r.hash||"")||!/^[a-f0-9]{64}$/.test(r.solicitudHuella||""))return false;
   const s=cargar(token),p=s.pendientes.get(r.solicitudId);return !s.error&&p?.tipo==="header"&&p.huella===r.solicitudHuella;
  }
  function confirmarCreacionInversion(token,r){
   if(!reciboInversionValido(token,r))return false;const s=cargar(token),p=s.pendientes.get(r.solicitudId);if(s.activas.has(p.id))return false;
   s.pendientes.delete(p.id);try{guardar(s);}catch(e){s.pendientes.set(p.id,p);cambio(s);throw e;}cambio(s);return true;
  }
  function reciboConciliacionValido(token,r){
   if(r?.confirmado!==true||r.certificaEstadoActual!==false||r.metodo!=="POST"||!/^conciliacion_[A-Za-z0-9_-]{8,80}$/.test(r.solicitudId||"")||!/^[a-f0-9]{24}$/.test(r.cuentaId||"")||r.ruta!=="/cuentas/"+r.cuentaId+"/conciliar"||!/^[a-f0-9]{64}$/.test(r.hash||"")||!/^[a-f0-9]{64}$/.test(r.solicitudHuella||""))return false;
   const s=cargar(token),p=s.pendientes.get(r.solicitudId);return !s.error&&p?.tipo==="header"&&p.huella===r.solicitudHuella;
  }
  function confirmarConciliacionCuenta(token,r){
   if(!reciboConciliacionValido(token,r))return false;const s=cargar(token),p=s.pendientes.get(r.solicitudId);if(s.activas.has(p.id))return false;
   s.pendientes.delete(p.id);try{guardar(s);}catch(e){s.pendientes.set(p.id,p);cambio(s);throw e;}cambio(s);return true;
  }
  function reciboCicloCuentaValido(token,r){
   const accion=r?.tipo==="RETIRO"?"retirar":r?.tipo==="RESTAURACION"?"restaurar-retiro":null;
   if(!accion||r.confirmado!==true||r.certificaEstadoActual!==false||r.metodo!=="POST"||!/^ciclo_cuenta_[A-Za-z0-9_-]{8,80}$/.test(r.solicitudId||"")||!/^[a-f0-9]{24}$/.test(r.cuentaId||"")||r.ruta!=="/cuentas/"+r.cuentaId+"/"+accion||!/^[a-f0-9]{64}$/.test(r.hash||"")||!/^[a-f0-9]{64}$/.test(r.solicitudHuella||""))return false;
   const s=cargar(token),p=s.pendientes.get(r.solicitudId);return !s.error&&p?.tipo==="header"&&p.huella===r.solicitudHuella;
  }
  function confirmarCicloCuenta(token,r){if(!reciboCicloCuentaValido(token,r))return false;const s=cargar(token),p=s.pendientes.get(r.solicitudId);if(s.activas.has(p.id))return false;s.pendientes.delete(p.id);try{guardar(s);}catch(e){s.pendientes.set(p.id,p);cambio(s);throw e;}cambio(s);return true;}
  function reciboCicloActivoValido(token,r){
   const accion=r?.tipo==="RETIRO"?"retirar":r?.tipo==="RESTAURACION"?"restaurar-retiro":null;
   if(!accion||r.confirmado!==true||r.certificaEstadoActual!==false||r.metodo!=="POST"||!/^ciclo_activo_[A-Za-z0-9_-]{8,80}$/.test(r.solicitudId||"")||!/^[a-f0-9]{24}$/.test(r.activoId||"")||r.ruta!=="/activos/"+r.activoId+"/"+accion||!/^[a-f0-9]{64}$/.test(r.hash||"")||!/^[a-f0-9]{64}$/.test(r.solicitudHuella||""))return false;
   const s=cargar(token),p=s.pendientes.get(r.solicitudId);return !s.error&&p?.tipo==="header"&&p.huella===r.solicitudHuella;
  }
  function confirmarCicloActivo(token,r){if(!reciboCicloActivoValido(token,r))return false;const s=cargar(token),p=s.pendientes.get(r.solicitudId);if(s.activas.has(p.id))return false;s.pendientes.delete(p.id);try{guardar(s);}catch(e){s.pendientes.set(p.id,p);cambio(s);throw e;}cambio(s);return true;}
  function reciboCicloInversionValido(token,r){
   const accion=r?.tipo==="RETIRO"?"retirar":r?.tipo==="RESTAURACION"?"restaurar-retiro":null;
   if(!accion||r.confirmado!==true||r.certificaEstadoActual!==false||r.metodo!=="POST"||!/^ciclo_inversion_[A-Za-z0-9_-]{8,80}$/.test(r.solicitudId||"")||!/^[a-f0-9]{24}$/.test(r.inversionId||"")||r.ruta!=="/inversiones/"+r.inversionId+"/"+accion||!/^[a-f0-9]{64}$/.test(r.hash||"")||!/^[a-f0-9]{64}$/.test(r.solicitudHuella||""))return false;
   const s=cargar(token),p=s.pendientes.get(r.solicitudId);return !s.error&&p?.tipo==="header"&&p.huella===r.solicitudHuella;
  }
  function confirmarCicloInversion(token,r){if(!reciboCicloInversionValido(token,r))return false;const s=cargar(token),p=s.pendientes.get(r.solicitudId);if(s.activas.has(p.id))return false;s.pendientes.delete(p.id);try{guardar(s);}catch(e){s.pendientes.set(p.id,p);cambio(s);throw e;}cambio(s);return true;}
  async function reciboCalendarioValido(token,r,path,cuerpo,esRechazo=false){
   if(!r||r.confirmado!==true||r.certificaEstadoActual!==false||r.afectaCaja!==(!esRechazo&&cuerpo?.solicitud?.accion==="REGISTRAR_RECEPCION")||!/^cal_ingreso_[A-Za-z0-9_-]{8,80}$/.test(r.solicitudId||"")||r.solicitudId!==cuerpo?.solicitudId||!/^\/calendario-ingresos(?:\/[a-f0-9]{24}\/eventos)?$/.test(path)||! /^[a-f0-9]{24}$/.test(r.calendarioId||"")||! /^[a-f0-9]{64}$/.test(r.hash||"")||! /^[a-f0-9]{64}$/.test(r.solicitudHuella||"")||r.accion!==cuerpo.solicitud?.accion||!Number.isSafeInteger(cuerpo.solicitud?.versionEsperada)||r.version!==cuerpo.solicitud.versionEsperada+1)return false;
   const usuario=usuarioDeToken(token);if(!usuario)return false;
   const id=path==="/calendario-ingresos"?(await digerir(JSON.stringify(canon({usuarioId:usuario,solicitudId:r.solicitudId,producto:"CALENDARIO_INGRESO_V1"})))).slice(0,24):path.split("/")[2];
   if(!esRechazo&&cuerpo.solicitud.accion==="REGISTRAR_RECEPCION"&&r.movimientoId!==(await digerir(JSON.stringify({usuarioId:usuario,solicitudId:r.solicitudId,producto:"INGRESO_RECEPCION_V1"}))).slice(0,24))return false;
   return r.calendarioId===id&&r.solicitudHuella===await digerir(JSON.stringify(canon({usuarioId:usuario,calendarioId:id,solicitud:cuerpo.solicitud})));
  }
  async function rechazoCalendarioValido(token,r,path,cuerpo){
   if(!["VERSION_SUPERADA","RECEPCION_NO_APLICADA"].includes(r?.codigo)||r.noAplicada!==true||r.afectaCaja!==false||r.versionEsperada!==cuerpo?.solicitud?.versionEsperada||!Number.isSafeInteger(r.versionActual)||r.versionActual<=r.versionEsperada||! /^[a-f0-9]{64}$/.test(r.hashVigente||""))return false;
   if(r.codigo==="RECEPCION_NO_APLICADA"&&(!["VINCULAR_RECEPCION","FINALIZAR_RECEPCION"].includes(cuerpo?.solicitud?.accion)||r.decisionPersistida!==true||r.certificaEstadoActual!==false||r.versionActual!==r.versionEsperada+1||!["INGRESO_OCUPADO","FUENTE_NO_COINCIDE","CUENTA_NO_DISPONIBLE"].includes(r.motivo)))return false;
   return reciboCalendarioValido(token,{...r,confirmado:true,certificaEstadoActual:false,accion:cuerpo.solicitud.accion,version:r.versionEsperada+1,hash:r.hashVigente},path,cuerpo,true);
  }
  async function confirmarRechazoCalendario(token,r,path,cuerpo,vigente=()=>true){
   if(!vigente()||!await rechazoCalendarioValido(token,r,path,cuerpo)||!vigente())return false;
   return resolverCalendario(token,r.solicitudId,path,cuerpo,vigente);
  }
  async function confirmarCalendario(token,r,path,cuerpo,vigente=()=>true){
   if(!vigente()||!await reciboCalendarioValido(token,r,path,cuerpo)||!vigente())return false;
   return resolverCalendario(token,r.solicitudId,path,cuerpo,vigente);
  }
  async function resolverCalendario(token,solicitudId,path,cuerpo,vigente){
   const d=datos(path,{method:"POST",body:JSON.stringify(cuerpo)}),huella=await digerir(d.contenido);if(!vigente())return false;
   const s=cargar(token);if(s.error)return false;const p=s.pendientes.get(solicitudId);if(!p)return true;if(p.tipo!=="solicitudId"||p.huella!==huella||s.activas.has(p.id))return false;
   s.pendientes.delete(p.id);try{guardar(s);}catch(e){s.pendientes.set(p.id,p);cambio(s);throw e;}cambio(s);return true;
  }
  async function reciboImputacionValido(token,r,path,cuerpo){
   if(!/^\/prestamos\/[a-f0-9]{24}\/imputaciones$/.test(path)||r?.confirmado!==true||r.certificaEstadoActual!==false||r.afectaCaja!==false||r.usuarioId!==usuarioDeToken(token)||r.prestamoId!==path.split("/")[2]||r.ruta!==path||r.metodo!=="POST"||!/^imputacion_[A-Za-z0-9_-]{8,80}$/.test(r.solicitudId||"")||! /^[a-f0-9]{64}$/.test(r.hash||"")||typeof r.noAplicada!=="boolean"||(r.noAplicada?!["CONTEXTO_CAMBIO","DECISION_NO_VIGENTE"].includes(r.motivoNoAplicada):r.motivoNoAplicada!==null))return false;
   const d=datos(path,{method:"POST",body:JSON.stringify(cuerpo)}),huella=await digerir(d.contenido);if(r.solicitudHuella!==huella)return false;const s=cargar(token),p=s.pendientes.get(r.solicitudId);return !s.error&&(!p||p.tipo==="header"&&p.huella===huella);
  }
  async function confirmarImputacion(token,r,path,cuerpo,vigente=()=>true){
   if(!vigente()||!await reciboImputacionValido(token,r,path,cuerpo)||!vigente())return false;const s=cargar(token),p=s.pendientes.get(r.solicitudId);if(!p)return true;if(s.activas.has(p.id))return false;s.pendientes.delete(p.id);try{guardar(s);}catch(e){s.pendientes.set(p.id,p);cambio(s);throw e;}cambio(s);return true;
  }
  async function reciboRestauracionCicloValido(token,r,path,cuerpo){
   if(!/^\/prestamos\/[a-f0-9]{24}\/cuotas\/restaurar-con-ciclo$/.test(path)||r?.confirmado!==true||r.certificaEstadoActual!==false||r.autorizaGasto!==false||typeof r.afectaCaja!=="boolean"||r.usuarioId!==usuarioDeToken(token)||r.prestamoId!==path.split("/")[2]||r.movimientoId!==cuerpo?.movimientoId||r.anulacionHash!==cuerpo?.anulacionHash||r.ruta!==path||r.metodo!=="POST"||! /^[A-Za-z0-9_-]{8,128}$/.test(r.solicitudId||"")||![r.imputacionHash,r.anulacionHash].every(x=>typeof x==="string"&&/^[a-f0-9]{64}$/.test(x)))return false;
   if(r.noAplicada===true){if(!["CONTEXTO_CAMBIO","ANULACION_SUPERADA","CALENDARIO_NO_VIGENTE"].includes(r.motivoNoAplicada)||r.afectaCaja!==false||r.compensacionHash!==null)return false;}
   else if(r.noAplicada!==undefined||r.motivoNoAplicada!==undefined||! /^[a-f0-9]{64}$/.test(r.compensacionHash||""))return false;
   const d=datos(path,{method:"POST",body:JSON.stringify(cuerpo)}),huella=await digerir(d.contenido);if(r.solicitudHuella!==huella)return false;const s=cargar(token),p=s.pendientes.get(r.solicitudId);return !s.error&&(!p||p.tipo==="header"&&p.huella===huella);
  }
  async function confirmarRestauracionCiclo(token,r,path,cuerpo,vigente=()=>true){
   if(!vigente()||!await reciboRestauracionCicloValido(token,r,path,cuerpo)||!vigente())return false;const s=cargar(token),p=s.pendientes.get(r.solicitudId);if(!p)return true;if(s.activas.has(p.id))return false;s.pendientes.delete(p.id);try{guardar(s);}catch(e){s.pendientes.set(p.id,p);cambio(s);throw e;}cambio(s);return true;
  }
  return{confirmarConstancia,reciboRestauracionCicloValido,confirmarRestauracionCiclo,reciboImputacionValido,confirmarImputacion,confirmarRechazoCalendario,rechazoCalendarioValido,reciboCalendarioValido,confirmarCalendario,estado,esMutacion,iniciar,confirmarRegistro,pendientes,confirmarAprobacion,reciboPrestamoValido,confirmarCreacionPrestamo,reciboCuentaValido,confirmarCreacionCuenta,reciboActivoValido,confirmarCreacionActivo,reciboInversionValido,confirmarCreacionInversion,reciboConciliacionValido,confirmarConciliacionCuenta,reciboCicloCuentaValido,confirmarCicloCuenta,reciboCicloActivoValido,confirmarCicloActivo,reciboCicloInversionValido,confirmarCicloInversion};
 }
 if(typeof module!=="undefined"&&module.exports)module.exports={crearControlMutacionesPersonales};
 else raiz.crearControlMutacionesPersonales=crearControlMutacionesPersonales;
})(typeof window!=="undefined"?window:globalThis);
