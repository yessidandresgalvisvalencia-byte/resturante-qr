
// Explicación determinística por cifras y fecha: evita mensajes repetidos sin inventar movimientos.
function explicarBalancePersonal(ingresos,gastos,porcentaje){
 const money=n=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n);
 const opciones={
  sinDatos:["Todavía no hay movimientos suficientes para saber cómo va tu dinero.","Cuando registres ingresos y gastos, aquí verás qué está pasando con tu dinero."],
  sinIngresos:["Registraste gastos, pero aún no aparecen ingresos en este período. Revisa si falta registrar alguno.","Por ahora hay salidas de dinero sin entradas registradas. Eso no significa necesariamente que no tengas dinero disponible."],
  positivo:["Vas por buen camino: de cada $100 que ingresaron, te quedaron aproximadamente $"+Math.round(porcentaje)+" después de los gastos registrados.","Tus ingresos superan los gastos. Entraron "+money(ingresos)+" y salieron "+money(gastos)+", así que la diferencia es "+money(ingresos-gastos)+".","Gastaste cerca del "+Math.round(100-porcentaje)+"% de lo que ingresó. El resto, "+money(ingresos-gastos)+", es tu balance positivo del período."],
  negativo:["Atención: gastaste "+money(gastos-ingresos)+" más de lo que ingresó durante este período.","Tus gastos fueron "+money(gastos)+" frente a "+money(ingresos)+" de ingresos. Conviene revisar qué gastos puedes reducir."],
  equilibrio:["Ingresó prácticamente lo mismo que gastaste. No quedó margen en este período.","Tus entradas y salidas están equilibradas; ahorrar será más fácil si logras reducir algún gasto."]
 };
 const tipo=porcentaje===null?"sinDatos":ingresos===0&&gastos>0?"sinIngresos":porcentaje>0?"positivo":porcentaje<0?"negativo":"equilibrio";
 const textos=opciones[tipo];
 const periodo=new Date(),mes=periodo.getFullYear()*12+periodo.getMonth();
 const indice=(mes+Math.abs(ingresos%97)+Math.abs(gastos%89))%textos.length;
 return textos[indice];
}
"use strict";(()=>{let installPrompt=null;const standalone=()=>window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true;function refreshInstall(){const b=document.getElementById("installApp");if(!b)return;b.hidden=standalone();if(!b.hidden)b.textContent="Instalar GRUK"}if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js",{scope:"/"}).catch(()=>{}));window.addEventListener("DOMContentLoaded",refreshInstall);window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;refreshInstall()});window.addEventListener("appinstalled",()=>{installPrompt=null;refreshInstall()});let token=sessionStorage.getItem("grukPersonalToken")||localStorage.getItem("grukPersonalToken"),tipo="INGRESO",socket,manualExternalId=null;const persist=()=>document.getElementById("keepSession")?.checked===true;function storeToken(value){sessionStorage.removeItem("grukPersonalToken");localStorage.removeItem("grukPersonalToken");(persist()?localStorage:sessionStorage).setItem("grukPersonalToken",value)}function clearToken(){token=null;sessionStorage.removeItem("grukPersonalToken");localStorage.removeItem("grukPersonalToken");if(socket){socket.disconnect();socket=null;}if(typeof invalidarIndicadoresFinancieros==="function")invalidarIndicadoresFinancieros();}const $=id=>document.getElementById(id),money=n=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0,minimumFractionDigits:0}).format(Math.round(Number(n||0)));async function api(path,o={}){const tokenSolicitud=token;const h={"Content-Type":"application/json",...(o.headers||{})};if(tokenSolicitud)h.Authorization="Bearer "+tokenSolicitud;const r=await fetch("/api"+path,{...o,headers:h,cache:"no-store"}),ct=r.headers.get("content-type")||"";const j=ct.includes("application/json")?await r.json():{error:"Respuesta inválida del servidor"};if(tokenSolicitud!==token){const err=new Error("La sesión cambió durante la solicitud");err.code="SESION_CAMBIADA";throw err;}if(!r.ok){const err=new Error(j.error||"Solicitud rechazada");err.statusCode=r.status;throw err;}return j}function body(x){return{method:"POST",body:JSON.stringify(x)}}function msg(id,t,ok=true){$(id).textContent=t;$(id).className="msg "+(ok?"ok":"err")}function enter(j){$("productChooser").hidden=true;if(j?.token){token=j.token;storeToken(token)}$("auth").hidden=true;$("app").hidden=false;$("logout").hidden=false;connect();load()}function connect(){if(socket)socket.disconnect();const tokenConexion=token;const conexion=io("/finanzas-personales",{auth:{token:tokenConexion},transports:["websocket"]});socket=conexion;const vigente=()=>Boolean(tokenConexion&&token===tokenConexion&&socket===conexion&&!$("app").hidden);conexion.on("connect",()=>{if(vigente())$("live").textContent="Protección activa · datos privados conectados"});conexion.on("finanzas:evento",e=>{if(!vigente())return;if(e?.eventName==="RECORDATORIO_COBRO"){const p=e.payload||{};$("live").textContent=(p.estado==="VENCIDA"?"Cobro vencido: ":"Cobro pendiente: ")+(p.mensaje||"Tienes dinero pendiente por cobrar.");$("live").dataset.alert="true";}load()});conexion.on("connect_error",()=>{if(vigente())$("live").textContent="Canal privado no disponible"})}async function cargarCompromisosCuotas(){
 const tokenConsulta=token;
 const {compromisos}=await api("/compromisos-cuotas");
 if(!tokenConsulta||token!==tokenConsulta||$("app").hidden)return;
 const render=x=>{
  const progreso=Math.round(x.cuotasPagadas*100/x.numeroCuotas);
  const proxima=x.cuotas.find(c=>c.estado==="PENDIENTE");
  const ultima=x.cuotas.filter(c=>c.estado==="PAGADA").at(-1);
  return '<article class="debtItem"><div class="debtTop"><div><b>'+esc(x.concepto)+'</b><p class="debtKind">'+esc(x.categoria)+'</p></div><strong>'+money(x.saldoMinor)+'</strong></div>'+
   '<div class="debtNumbers"><span>Cuotas '+x.cuotasPagadas+' / '+x.numeroCuotas+'</span><span>'+progreso+'%</span></div>'+
   '<progress value="'+x.cuotasPagadas+'" max="'+x.numeroCuotas+'" style="width:100%"></progress>'+
   '<div class="debtActions">'+(proxima?'<button class="mini" onclick="window.pagarCuotaCompromiso(\''+esc(String(x._id))+'\','+proxima.numero+')">Pagar cuota #'+proxima.numero+' · '+money(proxima.montoMinor)+'</button>':'')+
   (ultima?'<button class="secondary mini" onclick="window.deshacerCuotaCompromiso(\''+esc(String(x._id))+'\','+ultima.numero+')">Deshacer cuota #'+ultima.numero+'</button>':'')+'</div>'+
   '<div class="debtKind">'+x.cuotas.map(c=>'<span style="display:inline-block;margin:4px">'+(c.estado==="PAGADA"?"✓ ":"○ ")+c.numero+': '+esc(c.estado)+'</span>').join("")+'</div></article>';
 };
 $("compromisosActivos").innerHTML=compromisos.filter(x=>x.estado==="ACTIVA").map(render).join("")||'<p class="hint">No tienes compras a cuotas activas.</p>';
 $("compromisosArchivados").innerHTML=compromisos.filter(x=>x.estado==="FINALIZADA").map(render).join("")||'<p class="hint">Todavía no hay compras finalizadas.</p>';
}
window.pagarCuotaCompromiso=async(id,numero)=>{try{
 const {compromisos}=await api("/compromisos-cuotas");
 const x=compromisos.find(v=>String(v._id)===id),cuota=x?.cuotas.find(c=>c.numero===numero);
 if(!cuota||cuota.estado!=="PENDIENTE")throw Error("La cuota no está pendiente");
 const pat=await api("/patrimonio-financiero");
 const cuentas=(pat.snapshot?.cuentas||[]).filter(c=>c.activa!==false);
 const lista=cuentas.map((c,i)=>(i+1)+". "+c.nombre+" · "+money(c.saldoMinor)).join("\n");
 const opcion=prompt("¿Cómo pagaste esta cuota? 0 = Pago pasado sin cuenta conciliada.\n"+lista,"0");if(opcion===null)return;
 const historico=opcion.trim()==="0",idx=Number(opcion)-1,cuenta=historico?null:cuentas[idx];
 if(!historico&&(!cuenta||cuenta.saldoMinor<cuota.montoMinor))throw Error("La cuenta no existe o tiene saldo insuficiente. No marques como pagada una cuota que aún no pagaste.");
 if(!confirm("¿Confirmas que YA PAGASTE la cuota "+numero+" por "+money(cuota.montoMinor)+"? "+(historico?"Quedará pendiente de conciliar su cuenta de origen y no afectará la caja actual.":"Se descontará de "+cuenta.nombre+".")+" No se realizará ninguna transferencia bancaria."))return;
 const externalId=crypto.randomUUID();
 await api("/compromisos-cuotas/"+encodeURIComponent(id)+"/pagar",{method:"POST",body:JSON.stringify({numero,cuentaId:cuenta?String(cuenta._id):null,modo:historico?"HISTORICO":"CUENTA",externalId})});
 await cargarCompromisosCuotas();await load();
 alert("Cuota #"+numero+" marcada como pagada. Se registró la salida por compra financiada sin duplicar gasto de consumo.");
 }catch(e){alert("No se pudo registrar el pago: "+e.message)}
};
window.deshacerCuotaCompromiso=async(id,numero)=>{try{
 if(!confirm("¿Deshacer el pago de la cuota #"+numero+"? Se anulará el movimiento asociado y se restaurará el saldo de la obligación."))return;
 await api("/compromisos-cuotas/"+encodeURIComponent(id)+"/cuotas/"+numero+"/deshacer",{method:"POST"});
 await cargarCompromisosCuotas();await load();alert("Pago revertido y movimiento anulado.");
 }catch(e){alert("No se pudo deshacer la cuota: "+e.message)}
};
function invalidarIndicadoresFinancieros(){for(const id of ["hDisponible","hComprometido","hFlujo","hPatrimonio"]){const el=$(id);if(el)el.textContent="No actualizado";}const explicacion=$("metricExplanation");if(explicacion)explicacion.hidden=true;window.grukExplain=()=>{};}
let cargaPanelEnCurso=null;
let tokenCargaPanel=null;
async function load(){
 if(cargaPanelEnCurso&&tokenCargaPanel===token)return cargaPanelEnCurso;
 const tokenAlInicio=token;
 const ejecucion=(async()=>{invalidarIndicadoresFinancieros();try{
 const verificacion=await api("/diagnostico-integridad");
 const integridad=verificacion.diagnostico;
 if(!integridad?.identidadExistente)throw Error("No se pudo verificar tu identidad. El tablero no se actualizará.");
 if(integridad.movimientos===0&&integridad.deudas===0&&integridad.cuentas===0&&integridad.fechaCreacionCuenta&&Date.now()-new Date(integridad.fechaCreacionCuenta).getTime()>86400000){
  const live=$("live");if(live){live.textContent="ALERTA DE INTEGRIDAD: el servidor no encuentra movimientos, deudas ni cuentas para esta identidad. No vuelvas a registrar nada; requiere recuperación y revisión del historial.";live.dataset.alert="true";}
  const status=$("captureMsg");if(status){status.textContent="GRUK detectó registros financieros ausentes. No se actualizarán los indicadores a cero hasta revisar la base de datos.";status.className="msg err";}
  return;
 }
 cargarCompromisosCuotas().catch(e=>{console.error('[COMPROMISOS_CARGA]',e);const activo=$('compromisosActivos');if(activo)activo.textContent='No se pudieron cargar las compras a cuotas. Vuelve a actualizar.';});const [r,d,p,lp,h,nf,creditosAnteriores]=await Promise.all([api("/resumen"),api("/diario?limit=500"),api("/patrimonio"),api("/prestamos"),api("/home"),api("/notificaciones"),api("/creditos")]);if(token!==tokenAlInicio||!tokenAlInicio||$("app").hidden)return;
 const home=h.home;if(Number.isSafeInteger(Number(r.resumen.ingresos))&&Number.isSafeInteger(Number(home.mes?.ingresosMinor))&&Number(r.resumen.ingresos)!==Number(home.mes.ingresosMinor)){msg("captureMsg","Atención: los ingresos del resumen y del estado financiero no coinciden. GRUK no modificó ningún movimiento. Revisa el historial antes de registrar otro cobro.",false);}if(nf.notificaciones?.length){const n=nf.notificaciones[0];$("live").textContent=n.titulo+": "+n.mensaje;}window.grukExplain=key=>{const x=home.explicaciones?.[key],el=$("metricExplanation");if(!x||!el)return;el.hidden=false;el.innerHTML="<b>"+esc(x.titulo)+"</b><h3>¿De dónde sale este valor?</h3><p>"+esc(x.calculo)+"</p><h3>¿Qué significa para mí?</h3><p>"+esc(x.significado)+"</p><h3>¿Qué puedo hacer?</h3><p>"+esc(x.accion)+"</p>"};[["hDisponible","disponible"],["hComprometido","comprometido"],["hFlujo","flujoRealizado"],["hPatrimonio","patrimonio"],["rDeuda","deuda"]].forEach(([id,key])=>{const el=$(id);if(el){el.style.cursor="pointer";el.title="¿De dónde sale este valor?";el.onclick=()=>window.grukExplain(key)}});$("hDisponible").textContent=home.caja?.liquidezConciliada===true&&Number.isSafeInteger(home.caja?.disponibleDespuesCompromisosMinor)?money(home.caja.disponibleDespuesCompromisosMinor):"Pendiente de conciliación";$("hComprometido").textContent=money(home.caja.comprometidoMinor);$("hFlujo").textContent=money(home.mes.flujoRealizadoMinor);$("hPatrimonio").textContent=money(home.patrimonio.netoMinor);const conc=home.mes.conciliacionBalanceFlujo,concEl=$("flujoConciliacion");
if(concEl&&conc){
 const diferencia=conc.diferenciaBalanceFlujoMinor;
 concEl.innerHTML="<strong>¿Por qué Balance y Flujo son diferentes?</strong><p>Balance del período: "+money(conc.balancePeriodoMinor)+" · Flujo realizado: "+money(conc.flujoRealizadoMinor)+"</p><p>Conciliación: "+money(conc.balancePeriodoMinor)+" + gastos sin salida de caja "+money(conc.gastosSinSalidaCajaMinor)+" − pagos de deuda desde cuentas "+money(conc.pagosDeudaRegistradosMinor)+" + cobros de préstamos recibidos "+money(conc.cobrosRecibidosMinor)+" = "+money(conc.flujoRealizadoMinor)+"</p><p>Diferencia explicada: "+money(diferencia)+". Un ingreso normal de $10.000 ya forma parte de ingresos; no se presume que sea un cobro de préstamo.</p>";
}
const ingresosMes=Number(home.mes.ingresosMinor),gastosMes=Number(home.mes.gastosConsumoMinor),bubble=$("healthBubble");if(bubble){const valido=Number.isSafeInteger(ingresosMes)&&Number.isSafeInteger(gastosMes)&&ingresosMes>=0&&gastosMes>=0;const porcentaje=valido?(ingresosMes===0?(gastosMes>0?-100:null):Math.round((ingresosMes-gastosMes)/ingresosMes*1000)/10):null;bubble.className="healthBubble "+(porcentaje===null?"neutral":porcentaje>0?"positive":porcentaje<0?"negative":"neutral");$("healthArrow").textContent=porcentaje===null||porcentaje===0?"→":porcentaje>0?"↗":"↘";$("healthPercent").textContent=porcentaje===null?"Sin datos suficientes":(porcentaje>0?"+":"")+porcentaje.toLocaleString("es-CO",{maximumFractionDigits:1})+"%";$("healthLabel").textContent=explicarBalancePersonal(ingresosMes,gastosMes,porcentaje);bubble.title="Balance del período: (ingresos − gastos) ÷ ingresos × 100 cuando hay ingresos. Si no hay ingresos y sí gastos, se muestra −100% como señal de alerta convencional, no como porcentaje matemático de variación. Sin movimientos, estado neutral.";}api("/progreso-economico").then(x=>{if(!tokenAlInicio||token!==tokenAlInicio||$("app").hidden)return;const o=x.progreso?.ordenes?.[0];if(o&&$("homeGreeting"))$("homeGreeting").textContent=o.palanca==="INGRESOS"?"Tu próxima acción para mejorar caja":"Esto requiere tu atención";}).catch(()=>{});$("homeDecisions").innerHTML=home.decisiones.length?home.decisiones.map(x=>'<div class="decisionCard"><div><small>'+esc(x.prioridad)+' · '+esc(x.tipo)+'</small><b>'+esc(x.titulo)+'</b><p>'+esc(x.detalle)+'</p></div>'+(x.montoMinor?'<strong>'+money(x.montoMinor)+'</strong>':"")+'</div>').join(""):'<div class="decisionCard"><div><b>Sin decisiones críticas pendientes</b><p>GRUK no detecta compromisos inmediatos con los datos registrados.</p></div></div>';$("rIngresos").textContent=money(r.resumen.ingresos);$("rGastos").textContent=money(r.resumen.gastos);$("rFlujo").textContent=money(home.mes.flujoRealizadoMinor);$("rDeuda").textContent=money(r.resumen.deudaTotal);$("homeDecisions").querySelectorAll(".decisionCard").forEach(card=>{const t=card.textContent||"";card.style.cursor="pointer";card.onclick=()=>window.grukExplain(t.includes("FLUJO")?"flujoProyectado":t.includes("CAJA")?"disponible":t.includes("OBLIGACION")?"comprometido":"flujoRealizado")});$("pActivos").textContent=money(p.patrimonio.activosBase);$("pInversiones").textContent=money(p.patrimonio.valorInversiones);$("pDeudas").textContent=money(p.patrimonio.deudas);$("pNeto").textContent=money(p.patrimonio.patrimonioNeto);const pagados=lp.prestamos.filter(x=>x.estado==="PAGADO");const porCobrar=lp.prestamos.filter(x=>x.direccion==="POR_COBRAR"&&x.estado!=="PAGADO"&&x.saldoMinor>0),porPagar=lp.prestamos.filter(x=>x.direccion==="POR_PAGAR"&&!["PAGADO","CANCELADO"].includes(x.estado)&&x.saldoMinor>0);const detalleCuotas=new Map();
await Promise.all([...porPagar,...pagados.filter(x=>x.direccion==="POR_PAGAR")].map(async x=>{try{
 const r=await api("/prestamos/"+encodeURIComponent(String(x._id))+"/cuotas");
 detalleCuotas.set(String(x._id),r);
 }catch(e){detalleCuotas.set(String(x._id),{error:true});}
}));
const renderPrestamo=x=>{
 const propia=x.direccion==="POR_PAGAR",detalle=detalleCuotas.get(String(x._id));
 const valido=Number.isSafeInteger(x.principalMinor)&&x.principalMinor>0&&Number.isSafeInteger(x.saldoMinor)&&x.saldoMinor>=0;
 const progreso=valido?Math.max(0,Math.min(100,Math.round((1-x.saldoMinor/x.principalMinor)*100))):0;
 const pagadas=detalle&&!detalle.error&&Array.isArray(detalle.cuotasPagadas)?detalle.cuotasPagadas.length:null;
 const totalEstimado=x.cuotaMinor>0&&x.tasaMensualPct===0?Math.ceil(x.principalMinor/x.cuotaMinor):null;
 const siguiente=detalle&&!detalle.error&&Number.isInteger(detalle.proximaCuota)?detalle.proximaCuota:null;
 const nombre=propia?(x.concepto||x.contraparte||"Deuda sin concepto"):(x.contraparte||"Persona sin identificar");
 let html='<article class="debtItem"><div class="debtTop"><div><b>'+esc(nombre)+'</b><p class="debtKind">'+esc(propia?"Crédito o deuda propia":(x.origenCuentaPorCobrar==="TRABAJO"?"Trabajo pendiente":"Cuenta por cobrar"))+'</p></div><strong>'+money(x.saldoMinor)+'</strong></div>';
 html+='<div class="debtNumbers"><div><small>Valor original</small><strong>'+money(x.principalMinor)+'</strong></div><div><small>Saldo por pagar</small><strong>'+money(x.saldoMinor)+'</strong></div></div>';
 if(propia){
  html+='<div class="debtNumbers"><span>Avance del saldo</span><strong>'+progreso+' %</strong></div><progress value="'+progreso+'" max="100" style="width:100%;height:14px"></progress>';
  const n=Number.isInteger(x.numeroCuotas)?x.numeroCuotas:null;
  html+='<p class="debtKind">'+(n!==null?'Cuotas '+(pagadas??0)+' / '+n:'Cuotas por confirmar')+'</p>';
  if(n!==null){
   html+='<div class="debtKind" style="display:flex;flex-wrap:wrap;gap:8px;margin:12px 0">';
   for(let i=1;i<=n;i++){
    const pago=detalle&&!detalle.error?detalle.cuotasPagadas?.find(t=>t.descripcion?.startsWith('Cuota '+i+' ')):null;
    const estado=pago?'✓ Pagada · '+money(pago.montoPagadoRealMinor||pago.montoMinor):i===(siguiente||1)?'● Siguiente':'○ Pendiente';
    html+='<span style="padding:7px 9px;border:1px solid #354456;border-radius:12px">Cuota #'+i+' · '+estado+'</span>';
   }
   html+='</div>';
   if(detalle&&!detalle.error&&detalle.totalPagadoRealMinor>0)html+='<p class="debtKind">Total realmente pagado: '+money(detalle.totalPagadoRealMinor)+'</p>';
   if(detalle&&!detalle.error&&x.estado==='PAGADO')html+='<p class="debtKind"><b>Pagaste en total '+money(detalle.totalPagadoRealMinor)+'</b> · Valor inicial registrado '+money(x.principalMinor)+' · Diferencia '+money(detalle.totalPagadoRealMinor-x.principalMinor)+'. Esta diferencia no equivale necesariamente al interés ni al precio de contado.</p>';
  }else if(totalEstimado!==null)html+='<p class="hint">El sistema calcula '+totalEstimado+' cuotas aproximadas. Confirma las cuotas pactadas para visualizarlas y pagarlas aquí.</p>';

  if(!x.periodicidadConfirmada)html+='<p class="hint">Confirma una sola vez las cuotas pendientes. No necesitas indicar fechas.</p>';
 }
 if(propia&&detalle&&!detalle.error&&detalle.proximoVencimiento){
  const [yyyy,mm,dd]=detalle.proximoVencimiento.split("-");
  html+='<div class="debtDate">'+(detalle.frecuenciaSinConfirmar?'Próximo vencimiento estimado (si las cuotas son mensuales): ':'Próximo vencimiento: ')+dd+'/'+mm+'/'+yyyy+'</div>';
 }else if(x.fechaVencimiento&&!propia){
  html+='<div class="debtDate">Vencimiento informado: '+new Date(x.fechaVencimiento).toLocaleDateString("es-CO")+'</div>';
 }else if(propia&&x.fechaVencimiento&&x.saldoMinor>0){
  html+='<div class="debtDate">Fecha registrada: '+new Date(x.fechaVencimiento).toLocaleDateString("es-CO")+' · Confirma la frecuencia para calcular el siguiente vencimiento.</div>';
 }
 html+='<div class="debtActions">';
 if(propia&&!["PAGADO","CANCELADO"].includes(x.estado)&&x.saldoMinor>0){
  if(detalle?.frecuenciaSinConfirmar)html+='<button class="secondary mini" onclick="window.confirmarFrecuenciaMensual(\''+esc(String(x._id))+'\')">Confirmar cuotas mensuales</button>';
  html+='<button class="mini" onclick="window.registrarCuota(\''+esc(String(x._id))+'\')">'+(x.periodicidadConfirmada&&siguiente?'Pagar cuota #'+siguiente:'Registrar pago cuota #1')+'</button>';
  if(pagadas>0)html+='<button class="secondary mini" onclick="window.deshacerUltimaCuota(\''+esc(String(x._id))+'\')">Deshacer cuota #'+pagadas+'</button>';
  html+='<button class="secondary mini" onclick="window.configurarPeriodicidad(\''+esc(String(x._id))+'\')">Editar cuotas</button>';
  html+='<button class="secondary mini" onclick="window.retirarCredito(\''+esc(String(x._id))+'\')">Eliminar</button>';
 }else if(propia&&x.estado==="PAGADO"&&pagadas>0){
  html+='<button class="secondary mini" onclick="window.deshacerUltimaCuota(\''+esc(String(x._id))+'\')">Deshacer cuota #'+pagadas+'</button>';
 }else if(!propia&&x.estado==="PAGADO"){
  html+='<button class="secondary mini" onclick="window.corregirOrigenCobro(\''+esc(String(x._id))+'\')">Corregir</button>';
 }else if(!propia&&x.estado!=="PAGADO"){
  html+='<button class="secondary mini" onclick="window.corregirOrigenCobro(\''+esc(String(x._id))+'\')">Corregir</button>';
  html+='<button class="mini" onclick="window.registrarCobro(\''+esc(String(x._id))+'\','+Number(x.saldoMinor)+')">Registrar pago recibido</button>';
 }
 html+='</div></article>';
 return html;
}
$("listaPorCobrar").innerHTML='<div class="debtHeading"><h3>Me deben</h3><strong>'+money(porCobrar.reduce((a,x)=>a+x.saldoMinor,0))+'</strong></div>'+(porCobrar.length?porCobrar.map(renderPrestamo).join(""):'<p class="hint">No hay préstamos por cobrar registrados.</p>');
$("listaPorPagar").innerHTML='<div class="debtHeading"><h3>Mis deudas</h3><strong>'+money(porPagar.reduce((a,x)=>a+x.saldoMinor,0))+'</strong></div>'+(porPagar.length?porPagar.map(renderPrestamo).join(""):'<p class="hint">No hay préstamos por pagar en este registro.</p>');
const anteriores=creditosAnteriores.creditos||[];
if(anteriores.length){
 $("listaPorPagar").insertAdjacentHTML("beforeend",'<div class="debtHeading"><h3>Créditos registrados anteriormente</h3><strong>'+money(anteriores.reduce((a,x)=>a+x.saldo,0))+'</strong></div><p class="hint">Estos créditos antiguos aún no están conciliados. Puedes incorporarlos con confirmación para administrar sus cuotas sin crear un duplicado.</p>'+anteriores.map(x=>'<article class="debtItem"><div class="debtTop"><div><strong>'+esc(x.nombre)+'</strong><p class="debtKind">Crédito anterior · pendiente de conciliación</p></div><strong>'+money(x.saldo)+'</strong></div><div class="debtNumbers"><span>Cuotas informadas restantes: '+esc(String(x.mesesRestantes))+'</span><span>Pagos anteriores sin verificar</span></div><progress value="0" max="100" style="width:100%;height:14px"></progress><div class="debtNumbers"><div>Saldo guardado<strong>'+money(x.saldo)+'</strong></div><div>Cuota mensual<strong>'+money(x.cuotaMensual)+'</strong></div></div><small>Tasa mensual: '+esc(String(x.tasaMensualPct))+' % · Meses restantes: '+esc(String(x.mesesRestantes))+'</small><div class="debtActions"><button class="mini" onclick="window.incorporarCreditoAnterior(\''+esc(String(x._id))+'\')">Incorporar y gestionar cuotas</button><button class="secondary mini" onclick="window.retirarCredito(\''+esc(String(x._id))+'\',true)">Eliminar</button></div></article>').join(""));
}
$("listaPrestamosPagados").innerHTML='<div class="debtHeading"><h3>Préstamos pagados</h3><strong>'+pagados.length+'</strong></div>'+(pagados.length?pagados.map(renderPrestamo).join(""):'<p class="hint">Sin préstamos pagados.</p>');$("diario").innerHTML=d.dias.length?d.dias.map(x=>'<div class="day"><b>'+x.fecha+'</b><span>'+money(x.balance)+'</span>'+x.movimientos.map(m=>'<div class="row"><span>'+m.tipo+' · '+esc(m.concepto)+' · '+esc(m.categoria)+(m.contraparte?' · '+esc(m.contraparte):'')+'</span><span class="movementActions"><strong>'+money(m.monto)+'</strong><button class="secondary mini" onclick="window.editMovement(\''+m._id+'\',\''+m.tipo+'\','+m.monto+')">Corregir</button><button class="dangerMini" onclick="window.deleteMovement(\''+m._id+'\')">Eliminar</button></span></div>').join("")+'</div>').join(""):"Sin movimientos todavía."}catch(e){if(e.code==="SESION_CAMBIADA"||token!==tokenAlInicio)return;if(e.statusCode===401){clearToken();$("app").hidden=true;$("logout").hidden=true;$("auth").hidden=false;msg("authMsg","La sesión expiró. Ingresa nuevamente.",false);return}const live=$("live");if(live)live.textContent="No pude actualizar tus datos: "+e.message;}})();
 cargaPanelEnCurso=ejecucion;
 tokenCargaPanel=tokenAlInicio;
 try{return await ejecucion;}finally{if(cargaPanelEnCurso===ejecucion){cargaPanelEnCurso=null;tokenCargaPanel=null;}}
}window.deshacerUltimaCuota=async id=>{try{
 const info=await api("/prestamos/"+encodeURIComponent(id)+"/cuotas");
 const pagos=info.cuotasPagadas||[];
 if(!pagos.length)throw Error("No hay una cuota registrada para deshacer");
 const n=pagos.length,ultimo=pagos[pagos.length-1];
 if(!confirm("¿Deshacer el pago de la cuota #"+n+" por "+money(ultimo.montoMinor)+"? Se anulará el movimiento y se restaurará el saldo pendiente y la cuenta utilizada."))return;
 await api("/prestamos/"+encodeURIComponent(id)+"/cuotas/deshacer",{method:"POST"});
 await load();alert("Cuota #"+n+" revertida correctamente.");
 }catch(e){alert("No se pudo deshacer la cuota: "+e.message)}
};
window.corregirOrigenCobro=async id=>{try{
 const datos=await api("/prestamos");
 const p=(datos.prestamos||[]).find(x=>String(x._id)===String(id));
 if(!p||p.direccion!=="POR_COBRAR")throw Error("Cuenta por cobrar no encontrada");
 const actual=p.origenCuentaPorCobrar||"PRESTAMO";
 const nuevo=prompt("¿Qué era esta cuenta por cobrar? Escribe TRABAJO, PRESTAMO u OTRO.",actual);
 if(nuevo===null)return;
 const origenCuentaPorCobrar=nuevo.trim().toUpperCase();
 if(!["TRABAJO","PRESTAMO","OTRO"].includes(origenCuentaPorCobrar))throw Error("Elige TRABAJO, PRESTAMO u OTRO");
 if(actual===origenCuentaPorCobrar)return;
 if(!confirm("¿Corregir el origen a "+origenCuentaPorCobrar+"? GRUK reclasificará únicamente los cobros relacionados ya existentes. NO recibirá ni registrará dinero otra vez."))return;
 await api("/prestamos/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify({origenCuentaPorCobrar})});
 await load();
 alert("Origen corregido. Se revisaron los movimientos vinculados sin crear ingresos ni cobros nuevos. Si falta un ingreso, consulta el historial antes de registrarlo.");
 }catch(e){alert("No se pudo corregir: "+e.message)}
};
window.registrarCuota=async id=>{try{
 const info=await api("/prestamos/"+encodeURIComponent(id)+"/cuotas");
 const n=info.proximaCuota,m=info.importeProximaMinor;
 if(!info.periodicidadConfirmada){const aprobado=await window.configurarPeriodicidad(id);if(!aprobado)return;return window.registrarCuota(id);}
 if(!Number.isSafeInteger(m)||m<1)throw Error("No hay un valor de cuota pendiente válido.");
 const valor=prompt("¿Cuánto pagaste realmente por la cuota #"+n+"? Escribe pesos enteros, sin puntos.",String(m));if(valor===null)return;
 if(!/^[1-9][0-9]*$/.test(valor.trim()))throw Error("Escribe el monto exacto sin puntos ni comas");
 const montoPagadoRealMinor=Number(valor.trim());if(!Number.isSafeInteger(montoPagadoRealMinor))throw Error("Monto fuera de rango");
 if(!confirm("¿Confirmar pago de "+money(montoPagadoRealMinor)+" de la cuota #"+n+"? Queda pendiente conciliar la cuenta de origen; GRUK no descontará dinero nuevamente."))return;
 const externalId=crypto.randomUUID();
 await api("/prestamos/"+encodeURIComponent(id)+"/cuotas/pagar",{method:"POST",body:JSON.stringify({numeroCuota:n,montoPagadoRealMinor,modo:"HISTORICO",cuentaId:null,externalId})});
 await load();alert("Cuota #"+n+" registrada. Puedes deshacer el último pago desde esta misma tarjeta.");
 }catch(e){alert("No se pudo registrar la cuota: "+e.message)}
};
window.confirmarFrecuenciaMensual=async id=>{try{
 if(!confirm("¿Confirmas que esta deuda vence cada mes, el mismo día? No se registrará ningún pago ni se cambiará el saldo."))return;
 await api("/prestamos/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify({periodicidad:"MENSUAL"})});
 await load();
 }catch(e){alert("No se pudo confirmar la periodicidad: "+e.message)}
};
window.configurarPeriodicidad=async id=>{try{
 const datos=await api("/prestamos"),p=(datos.prestamos||[]).find(x=>String(x._id)===String(id));
 if(!p||p.direccion!=="POR_PAGAR"||p.saldoMinor<=0)throw Error("Deuda activa no encontrada");
 let cuotaMinor=p.cuotaMinor,numeroCuotas=p.numeroCuotas;
 if(!Number.isSafeInteger(cuotaMinor)||cuotaMinor<1){const v=prompt("¿Cuánto vale cada cuota en COP?",String(p.saldoMinor));if(v===null)return;cuotaMinor=Number(v);}
 if(!Number.isInteger(numeroCuotas)||numeroCuotas<1){const v=prompt("¿Cuántas cuotas pendientes tiene esta deuda?",String(Math.ceil(p.saldoMinor/cuotaMinor)||1));if(v===null)return;numeroCuotas=Number(v);}
 if(!Number.isSafeInteger(cuotaMinor)||cuotaMinor<1||!Number.isInteger(numeroCuotas)||numeroCuotas<1||numeroCuotas>360)throw Error("Revisa el importe y la cantidad de cuotas");
 if(!confirm("¿Confirmar "+numeroCuotas+" cuotas de "+money(cuotaMinor)+" para "+p.concepto+"? No se registra ningún pago ahora."))return;
 await api("/prestamos/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify({cuotaMinor,numeroCuotas,periodicidadConfirmada:true})});
 await load();return true;
 }catch(e){alert("No se pudieron confirmar las cuotas: "+e.message)}
};
window.incorporarCreditoAnterior=async id=>{try{
 if(!confirm("¿Incorporar este crédito anterior a Mis deudas para gestionar sus cuotas? Revisa antes que no exista ya una deuda equivalente. No registra pagos ni gastos."))return;
 const r=await api("/creditos/"+encodeURIComponent(id)+"/incorporar-a-deudas",{method:"POST"});
 await load();
 alert("Crédito incorporado sin crear pagos. Confirma ahora su calendario de cuotas.");
 if(r.resultado?.id)await window.configurarPeriodicidad(r.resultado.id);
 }catch(e){alert("No se pudo incorporar el crédito: "+e.message)}
};
window.retirarCredito=async(id,anterior=false)=>{try{
 if(!confirm("¿Eliminar este registro de la lista? No significa que la deuda esté pagada. Se conserva para auditoría."))return;
 await api((anterior?"/creditos/":"/prestamos/")+encodeURIComponent(id),{method:"DELETE"});
 await load();alert("Registro retirado de la lista. No se registró ningún pago.");
 }catch(e){alert("No se pudo retirar: "+e.message)}
};
window.corregirPrestamo=async id=>{try{
 const data=await api("/prestamos");const p=(data.prestamos||[]).find(x=>String(x._id)===String(id));
 if(!p)throw Error("Préstamo no encontrado");
 const persona=prompt("Persona o contraparte:",p.contraparte||"");if(persona===null)return;
 const concepto=prompt("Concepto:",p.concepto||"Préstamo");if(concepto===null)return;
 const importe=prompt("Valor original en pesos (los cobros ya registrados se conservarán):",String(p.principalMinor));if(importe===null)return;
 const monto=Number(importe);
 const origenActual=p.origenCuentaPorCobrar||"PRESTAMO";
 const origen=prompt("¿Por qué te debían este dinero? Escribe 1 para préstamo personal, 2 para trabajo realizado o 3 para otro cobro.",origenActual==="TRABAJO"?"2":origenActual==="OTRO"?"3":"1");if(origen===null)return;
 const clasificacion=({"1":"PRESTAMO","2":"TRABAJO","3":"OTRO"})[origen.trim()];
 if(!clasificacion)throw Error("Selecciona 1, 2 o 3 para clasificar el cobro.");

 if(!persona.trim()||!concepto.trim()||!Number.isSafeInteger(monto)||monto<=0)throw Error("Nombre, concepto o valor inválidos");
 if(!confirm("¿Confirmas la corrección? No se registrará ningún cobro nuevo."))return;
 await api("/prestamos/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify({contraparte:persona.trim(),concepto:concepto.trim(),principalMinor:monto,origenCuentaPorCobrar:clasificacion})});
 await load();alert("Cuenta por cobrar corregida. Los cobros existentes se conservaron.");
 }catch(e){alert("No se pudo corregir el préstamo: "+e.message)}};
let histPagina=1,histCargando=false;
async function buscarHistorial(reset=true){
 if(histCargando)return;
 if(reset){histPagina=1;$("histResultados").replaceChildren();}
 const filtros=new URLSearchParams({pagina:String(histPagina),tipo:$("histTipo").value,estado:$("histEstado").value,q:$("histQ").value.trim()});
 for(const [id,key] of [["histMonto","monto"],["histDesde","desde"],["histHasta","hasta"]]){const valor=$(id).value.trim();if(valor)filtros.set(key,valor);}
 histCargando=true;$("histMensaje").textContent="Buscando en el historial…";$("histMas").hidden=true;
 try{
  const r=await api("/historial/buscar?"+filtros.toString());
  for(const item of r.items||[]){
   const el=document.createElement("article");el.className="historyItem";
   const nombre=item.clase==="MOVIMIENTO"?(item.contraparte||item.concepto):(item.contraparte||"Persona sin identificar");
   const tipo=item.clase==="MOVIMIENTO"?item.tipo:(item.origenCuentaPorCobrar==="TRABAJO"?"Trabajo pendiente":item.origenCuentaPorCobrar==="PRESTAMO"?"Préstamo":"Otro cobro");
   const fecha=item.fecha||item.fechaInicio;
   const monto=item.clase==="MOVIMIENTO"?item.montoMinor:item.principalMinor;
   el.innerHTML='<div><strong>'+esc(nombre)+'</strong><div class="debtKind">'+esc(tipo+" · "+(item.concepto||""))+'</div><small>'+esc(fecha?new Date(fecha).toLocaleDateString("es-CO"):"Sin fecha")+' · '+esc(item.estado||"")+'</small></div><strong>'+money(monto)+'</strong>';
   $("histResultados").append(el);
  }
  $("histMensaje").textContent=(r.items||[]).length?"Resultados encontrados. Solo lectura.":"No se encontraron movimientos con estos filtros.";
  $("histMas").hidden=!r.hayMas;
  if(r.hayMas)histPagina+=1;
 }catch(e){$("histMensaje").textContent="No fue posible buscar: "+e.message;}
 finally{histCargando=false;}
}
$("historicalSearch").addEventListener("submit",e=>{e.preventDefault();buscarHistorial(true)});
$("histMas").onclick=()=>buscarHistorial(false);
$("histLimpiar").onclick=()=>{$("historicalSearch").reset();$("histResultados").replaceChildren();$("histMensaje").textContent="";$("histMas").hidden=true;histPagina=1;};
window.rastrearCobro52000=async()=>{try{const r=await api("/rastrear-cobro?montoMinor=52000");const deudas=r.cuentasPorCobrar||[],mov=r.movimientos||[];const ingresos=mov.filter(x=>x.tipo==="INGRESO"&&x.estado!=="ANULADA");const cobros=mov.filter(x=>x.tipo==="COBRO_PRESTAMO"&&x.estado!=="ANULADA");const lineas=["Rastreo de $52.000 (solo lectura):",deudas.length+" cuenta(s) por cobrar con valor original de $52.000.",ingresos.length+" ingreso(s) registrado(s) por $52.000.",cobros.length+" cobro(s) clasificado(s) como recuperación de préstamo.",...deudas.map(x=>"Cuenta: "+x.origenCuentaPorCobrar+" / "+x.estado+" / pendiente "+money(x.saldoMinor)),...mov.slice(0,10).map(x=>"Movimiento: "+x.tipo+" / "+x.estado+" / "+new Date(x.fecha).toLocaleDateString("es-CO")+" / "+(x.prestamoId?"vinculado":"sin vínculo")),"Este rastreo no registra dinero ni corrige saldos."];window.alert(lineas.join("\n"));}catch(e){window.alert("No se pudo rastrear el cobro: "+e.message);}};window.reconciliarIngresosTrabajo=async()=>{if(!window.confirm("GRUK revisará cobros de trabajos ya pagados y solo corregirá clasificaciones verificables. No registrará nuevos pagos ni cambiará saldos. ¿Continuar?"))return;try{const r=await api("/reconciliar-ingresos-trabajo",{method:"POST"});await load();window.alert(r.estado==="CORREGIDO"?"Se corrigieron "+r.corregidos+" movimiento(s) existente(s). Revisa el historial y el ingreso del mes.":r.estado==="REQUIERE_REVISION"?"Se detectaron "+r.requierenRevisionManual+" caso(s) que requieren auditoría individual. No se duplicaron cobros.":"No se corrigió ningún ingreso. La revisión automática no encontró movimientos reclasificables; esto NO significa que tu cobro faltante esté solucionado. No vuelvas a registrar el pago.");}catch(e){window.alert("No se pudo completar la revisión: "+e.message);}};window.grukCobrosEnCurso=window.grukCobrosEnCurso||new Set();window.registrarCobro=async(id,saldo)=>{if(window.grukCobrosEnCurso.has(id))return;const valor=window.prompt("¿Cuánto te pagaron? Saldo pendiente: "+money(saldo),String(saldo));if(valor===null)return;const monto=Number(valor.trim().replace(/\./g,""));if(!Number.isSafeInteger(monto)||monto<=0||monto>saldo){window.alert("Ingresa un monto válido, sin superar el saldo pendiente.");return;}const key=id+":"+monto;window.grukCobrosPendientes=window.grukCobrosPendientes||{};const externalId=window.grukCobrosPendientes[key]||(window.grukCobrosPendientes[key]=crypto.randomUUID());window.grukCobrosEnCurso.add(id);try{const cobro=await api("/prestamos/"+encodeURIComponent(id)+"/cobros",body({montoMinor:monto,externalId}));await load();delete window.grukCobrosPendientes[key];const tipo=cobro.transaccion?.tipo;window.alert(tipo==="INGRESO"?"Pago recibido registrado como ingreso por trabajo.":tipo==="COBRO_PRESTAMO"?"Pago recibido registrado como recuperación de cuenta por cobrar; no se sumó a ingresos. Si era un trabajo, solicita corregir la clasificación, sin registrar el cobro otra vez.":"Cobro registrado. Verifica su clasificación en los movimientos.");}catch(e){window.alert("No se pudo confirmar el pago. Puedes reintentar sin duplicarlo: "+e.message);}finally{window.grukCobrosEnCurso.delete(id);}};async function loadDrafts(){try{const j=await api("/captura/pendientes");$("drafts").innerHTML=j.borradores.map(b=>'<div class="draft"><small>'+esc(b.canal)+'</small>'+b.items.map(x=>'<div class="row"><span>'+esc(x.tipo)+' · '+money(x.montoMinor)+' · '+esc(x.categoria)+'</span><strong>'+esc(x.estado)+(x.confianza?' '+x.confianza+'%':'')+'</strong></div>').join("")+'<div class="actions"><button onclick="window.approveDraft(\''+b._id+'\')">Aprobar</button><button class="secondary" onclick="window.discardDraft(\''+b._id+'\')">Descartar</button></div></div>').join("")}catch(e){msg("captureMsg",e.message,false)}}window.editMovement=async(id,tipoActual,montoActual)=>{const tipoNuevo=prompt("Tipo: INGRESO o GASTO",tipoActual);if(!tipoNuevo)return;const tipo=tipoNuevo.trim().toUpperCase();if(!["INGRESO","GASTO"].includes(tipo))return alert("Tipo inválido");const montoTexto=prompt("Monto real en pesos COP, sin puntos ni comas. Ejemplo: 10000",String(Math.round(montoActual)));if(!montoTexto)return;const montoMinor=Number(String(montoTexto).replace(/[^0-9]/g,""));if(!Number.isSafeInteger(montoMinor)||montoMinor<1)return alert("Monto inválido");try{await api("/transacciones/"+id,{method:"PATCH",body:JSON.stringify({tipo,montoMinor})});await load()}catch(e){alert(e.message)}};window.deleteMovement=async id=>{if(!confirm("¿Eliminar este movimiento? Dejará de contar en tus totales, pero GRUK conservará la auditoría."))return;try{await api("/transacciones/"+id,{method:"DELETE"});await load()}catch(e){alert(e.message)}};window.approveDraft=async id=>{try{await api("/captura/"+id+"/aprobar",{method:"POST"});msg("captureMsg","Operaciones aprobadas y contabilizadas.");await Promise.all([loadDrafts(),load()])}catch(e){msg("captureMsg",e.message,false)}};window.discardDraft=async id=>{try{await api("/captura/"+id+"/descartar",{method:"POST"});await loadDrafts()}catch(e){msg("captureMsg",e.message,false)}};function esc(s){return String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}$("installApp").onclick=async()=>{if(standalone())return refreshInstall();if(installPrompt){installPrompt.prompt();const choice=await installPrompt.userChoice;if(choice?.outcome==="accepted")installPrompt=null;return refreshInstall()}const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);alert(ios?"Para instalar GRUK: abre esta página en Safari, toca Compartir y luego «Añadir a pantalla de inicio».":"Para instalar GRUK: abre el menú del navegador (⋮) y toca «Instalar aplicación» o «Añadir a pantalla de inicio».")};$("choosePersonal").onclick=()=>{$("productChooser").hidden=true;$("auth").hidden=false};$("chooseBusiness").onclick=()=>{$("businessOptions").hidden=!$("businessOptions").hidden};$("businessLogin").onclick=()=>location.assign("https://resturante-qr-1.onrender.com/login.html");$("businessSignup").onclick=()=>location.assign("https://resturante-qr-1.onrender.com/registro-empresa.html");document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-tab],.panel").forEach(x=>x.classList.remove("active"));b.classList.add("active");$(b.dataset.tab).classList.add("active")});document.querySelectorAll(".tipo").forEach(b=>b.onclick=()=>{tipo=b.dataset.tipo;document.querySelectorAll(".tipo").forEach(x=>x.classList.toggle("active",x===b))});$("mFecha").value=new Date().toISOString().slice(0,10);$("login").onclick=async()=>{try{msg("authMsg","Verificando…");enter(await api("/auth/login",body({email:$("email").value,password:$("password").value,mantenerSesion:$("keepSession").checked})))}catch(e){msg("authMsg",e.message,false)}};$("register").onclick=async()=>{try{msg("authMsg","Creando prueba gratuita…");enter(await api("/auth/registro",body({nombre:$("nombre").value,email:$("email").value,password:$("password").value})))}catch(e){msg("authMsg",e.message,false)}};$("logout").onclick=()=>{clearToken();location.reload()};$("refresh").onclick=load;$("saveMovimiento").onclick=async()=>{try{manualExternalId=manualExternalId||(crypto.randomUUID?crypto.randomUUID():("manual-"+Date.now()+"-"+Math.random().toString(16).slice(2)));if(tipo==="GASTO"&&$("mMedio").value==="CREDITO")throw new Error("Para una compra a crédito, cuéntasela a GRUK para crear el gasto y la deuda juntos; no la registraré como si hubiera salido efectivo.");await api("/transacciones",body({externalId:manualExternalId,tipo,montoMinor:Math.round(Number($("mMonto").value)),moneda:"COP",concepto:$("mConcepto").value,categoria:$("mCategoria").value,subcategoria:$("mSubcategoria").value,cuenta:$("mCuenta").value,medioPago:$("mMedio").value,contraparte:$("mContraparte").value,descripcion:$("mDescripcion").value,fecha:$("mFecha").value,recurrente:$("mRecurrente").checked,frecuencia:$("mRecurrente").checked?"MENSUAL":"NINGUNA",origen:"MANUAL"}));manualExternalId=null;msg("movMsg","Movimiento guardado.");$("mMonto").value="";$("mConcepto").value="";await load()}catch(e){msg("movMsg",e.message,false)}};$("savePrestamo").onclick=async()=>{const boton=$("savePrestamo");if(boton.disabled)return;try{const contraparte=$("pContraparte").value.trim(),saldo=Number($("pSaldo").value),concepto=$("pConcepto").value.trim()||"Préstamo personal";if(!contraparte||!Number.isSafeInteger(saldo)||saldo<=0)throw Error("Indica la persona y un saldo válido en pesos.");boton.disabled=true;await api("/prestamos",body({direccion:"POR_COBRAR",origenCuentaPorCobrar:($("pOrigen")?.value||"TRABAJO"),contraparte,concepto,principalMinor:saldo,fechaInicio:new Date().toISOString(),fechaVencimiento:null}));$("pContraparte").value="";$("pSaldo").value="";$("pConcepto").value="";await load();msg("prestamoMsg","Dinero por cobrar guardado y actualizado.");}catch(e){msg("prestamoMsg",e.message,false)}finally{boton.disabled=false}};$("saveCredito").onclick=async()=>{try{await api("/creditos",body({nombre:$("cNombre").value,saldo:Number($("cSaldo").value),tasaMensualPct:Number($("cTasa").value),cuotaMensual:Number($("cCuota").value),mesesRestantes:Number($("cMeses").value)}));await load();msg("credMsg","Crédito guardado y visible en Mis deudas.")}catch(e){msg("credMsg",e.message,false)}};$("saveActivo").onclick=async()=>{try{await api("/activos",body({nombre:$("aNombre").value,tipo:$("aTipo").value,valorActual:Number($("aValor").value),liquido:["EFECTIVO","CUENTA"].includes($("aTipo").value),institucion:$("aInstitucion").value}));msg("actMsg","Activo guardado.");await load()}catch(e){msg("actMsg",e.message,false)}};$("saveInversion").onclick=async()=>{try{await api("/inversiones",body({nombre:$("iNombre").value,clase:$("iClase").value,capitalAportado:Number($("iCapital").value),valorActual:Number($("iValor").value),moneda:"COP",riesgoDeclarado:"NO_CLASIFICADO",institucion:""}));msg("invMsg","Inversión guardada.");await load()}catch(e){msg("invMsg",e.message,false)}};$("saveMeta").onclick=async()=>{try{await api("/metas",body({nombre:$("gNombre").value,objetivo:Number($("gObjetivo").value),acumulado:Number($("gAcumulado").value||0),fechaObjetivo:$("gFecha").value||null}));msg("metaMsg","Meta guardada.")}catch(e){msg("metaMsg",e.message,false)}};$("ask").onsubmit=async e=>{e.preventDefault();const q=$("question").value.trim();if(!q)return;$("answer").textContent="Analizando tus datos…";try{const j=await api("/consulta",body({pregunta:q}));$("answer").textContent=j.resultado.respuesta}catch(x){$("answer").textContent=x.message}};function chatBubble(who,text){const box=document.createElement("div");box.className="draft";box.style.alignSelf=who==="Tú"?"flex-end":"flex-start";box.style.maxWidth="90%";box.style.whiteSpace="pre-wrap";const name=document.createElement("strong");name.textContent=who;box.append(name,document.createElement("br"),document.createTextNode(text));$("chatHistory").appendChild(box);$("chatHistory").scrollTop=$("chatHistory").scrollHeight;}
async function cargarHistorialChat(){try{const j=await api("/copilot/historial");const turnos=Array.isArray(j.turnos)?j.turnos:[];if(!turnos.length)return;const area=$("chatHistory");area.replaceChildren();for(const turno of turnos){chatBubble("Tú",turno.mensaje);chatBubble("GRUK",turno.respuesta);}}catch(e){msg("captureMsg","No pude recuperar el historial: "+e.message,false);}}
$("captureText").addEventListener("keydown",event=>{if(event.key==="Enter"&&!event.shiftKey&&!event.isComposing){event.preventDefault();$("interpret").click();}});
let chatSending=false;$("interpret").onclick=async()=>{const texto=$("captureText").value.trim();if(!texto||chatSending)return;chatSending=true;$("interpret").disabled=true;chatBubble("Tú",texto);$("captureText").value="";try{const j=await api("/copilot",body({texto,canal:"TEXTO"})),r=j.resultado;chatBubble("GRUK",r.mensaje||"No pude interpretar la respuesta.");if(r.requiereAprobacion||r.borrador){await loadDrafts();msg("captureMsg","Revisa la propuesta y aprueba solo si deseas registrarla.");}else msg("captureMsg","Conversación sin movimientos registrados.");}catch(e){chatBubble("GRUK","No pude procesar tu mensaje: "+e.message);msg("captureMsg",e.message,false);}finally{chatSending=false;$("interpret").disabled=false;}};
$("iiAnalizar").onclick=async()=>{try{msg("iiMsg","GRUK está evaluando datos de mercado verificados…");const perfil=$("iiRiesgo").value;const payload={capitalMinor:Math.round(Number($("iiCapital").value)),horizonteMeses:Number($("iiHorizonte").value),drawdownMaxPct:Number($("iiDrawdown").value),liquidezMaxDias:Number($("iiLiquidez").value)};if(perfil)payload.perfilRiesgo=perfil;const j=await api("/inversiones/inteligencia",body(payload)),r=j.recomendacion,star=r.recomendacion_estrella;$("iiResultado").innerHTML='<div class="draft"><b>'+(star?'Alternativa cuantitativa: '+esc(star.activo_seleccionado):'Ninguna alternativa cumple tus restricciones')+'</b><p>'+esc(r.metodologia)+'</p>'+r.opciones_evaluadas.map(x=>'<div class="row"><span>'+esc(x.activo)+' · '+esc(x.categoria)+(x.elegible?' · ELEGIBLE':' · FUERA DE RESTRICCIONES')+'</span><strong>Real '+x.metricas.retorno_real_estimado_anual_pct+'% · Sharpe '+(x.metricas.sharpe_estimado??"N/D")+' · P(>0) '+(x.metricas.probabilidad_retorno_nominal_positivo_pct??"N/D")+'%</strong></div>').join("")+'</div>';msg("iiMsg","Análisis calculado con fecha de mercado "+new Date(r.datos_corte).toLocaleString("es-CO")+".")}catch(e){$("iiResultado").innerHTML="";msg("iiMsg",e.message,false)}};const SR=window.SpeechRecognition||window.webkitSpeechRecognition;let listening=false;$("voice").onclick=async()=>{if(listening)return;try{if(!navigator.mediaDevices?.getUserMedia)throw new Error("MIC_NO_DISPONIBLE");const stream=await navigator.mediaDevices.getUserMedia({audio:true});stream.getTracks().forEach(t=>t.stop());if(!SR)throw new Error("STT_NO_DISPONIBLE");const r=new SR();r.lang="es-CO";r.interimResults=false;r.continuous=false;listening=true;$("voice").textContent="🎙 Escuchando…";msg("captureMsg","Habla normalmente. GRUK está escuchando.");r.onresult=e=>{const t=Array.from(e.results).map(x=>x[0]?.transcript||"").join(" ").trim();if(t){$("captureText").value+=( $("captureText").value?" ":"")+t;msg("captureMsg","Audio transcrito. Revisa el texto y pulsa Interpretar.")}};r.onerror=e=>{const code=String(e.error||"");const m=code==="not-allowed"||code==="service-not-allowed"?"Activa el permiso de micrófono para GRUK en tu teléfono y vuelve a tocar Dictar.":code==="no-speech"?"No detecté voz. Toca Dictar y habla cerca del micrófono.":code==="network"?"El servicio de dictado del dispositivo no respondió. Revisa tu conexión e inténtalo de nuevo.":"No pude transcribir este audio ("+code+"). Inténtalo otra vez.";msg("captureMsg",m,false)};r.onend=()=>{listening=false;$("voice").textContent="🎙 Dictar"};r.start()}catch(e){listening=false;$("voice").textContent="🎙 Dictar";msg("captureMsg",e.message==="MIC_NO_DISPONIBLE"?"Este dispositivo no expone el micrófono a la app.":e.name==="NotAllowedError"?"GRUK necesita permiso de micrófono. Habilítalo en los permisos de la app y vuelve a intentar.":"No fue posible iniciar el micrófono.",false)}};if(token){enter({});loadDrafts();cargarHistorialChat();/* No ejecutar reparaciones financieras al iniciar sesión. */}})();