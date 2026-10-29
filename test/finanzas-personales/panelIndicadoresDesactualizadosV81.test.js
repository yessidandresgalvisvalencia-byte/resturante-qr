"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const codigo=fs.readFileSync(path.join(__dirname,"../../public/finanzas-personales.js"),"utf8");
function panelSimulado(api){
 const vm=require("node:vm"),elementos=new Map();
 const $=id=>{
  if(!elementos.has(id))elementos.set(id,{textContent:"Anterior",innerHTML:"Anterior",hidden:false,dataset:{},
   style:{},querySelectorAll:()=>[],value:"Borrador pendiente"});
  return elementos.get(id);
 };
 $("hDisponibleHoy").textContent="$500.000";$("hDisponible").textContent="$600.000";
 $("hPatrimonio").textContent="$800.000";$("homeDecisions").textContent="Puedes gastar";
 const contexto=vm.createContext({$,api,token:"sesion-uno",cargaPanelEnCurso:null,tokenCargaPanel:null,
  window:{grukExplain:()=>{$("metricExplanation").hidden=false;}},Date,Error,money:String,esc:String,
  explicarBalancePersonal:()=>"Balance de prueba",cargarCompromisosCuotas:async()=>{}});
 const inicio=codigo.indexOf("function invalidarAutorizacionDisponible()");
 const fin=codigo.indexOf("function invalidarIndicadoresFinancieros()",inicio);
 vm.runInContext(codigo.slice(inicio,fin),contexto);
 const inicioCarga=codigo.indexOf("async function load(){"),finCarga=codigo.indexOf("}window.deshacerUltimaCuota=",inicioCarga);
 assert.ok(inicio>0&&fin>inicio&&inicioCarga>0&&finCarga>inicioCarga);
 vm.runInContext(codigo.slice(inicioCarga,finCarga+1),contexto);
 return {$,contexto};
}
function respuestasPanelConCuota(cuota,avisar){
 return async ruta=>{
  if(ruta.startsWith("/prestamos/")&&ruta.endsWith("/cuotas")){avisar();return cuota;}
  const respuestas={
   "/diagnostico-integridad":{diagnostico:{identidadExistente:true,movimientos:1,deudas:1,cuentas:1}},
   "/resumen":{resumen:{ingresos:1000,gastos:100,deudaTotal:500}},
   "/diario?limit=500":{dias:[{fecha:"2026-10-29",balance:900,movimientos:[{_id:"movimiento-anterior",
    tipo:"GASTO",concepto:"Movimiento de cuenta anterior",categoria:"OTROS",monto:100}]}]},
   "/patrimonio":{patrimonio:{activosBase:1000,valorInversiones:0,deudas:500,patrimonioNeto:500}},
   "/prestamos":{prestamos:[{_id:"507f1f77bcf86cd799439012",direccion:"POR_PAGAR",estado:"ACTIVO",
    concepto:"Deuda de cuenta anterior",principalMinor:1000,saldoMinor:500,cuotaMinor:100,tasaMensualPct:0}]},
   "/home":{home:{caja:{comprometidoMinor:100},mes:{flujoRealizadoMinor:900,ingresosMinor:1000,gastosConsumoMinor:100},
    patrimonio:{netoMinor:500},decisiones:[]}},
   "/notificaciones":{notificaciones:[]},"/creditos":{creditos:[]},"/progreso-economico":{},
   "/gastos/hormiga/resumen":{}
  };
  assert.ok(Object.hasOwn(respuestas,ruta),"Ruta simulada inesperada: "+ruta);
  return respuestas[ruta];
 };
}
for(const cambio of ["usuario","logout","oculto","error-de-usuario","sin-cambio"]){
 test("cuotas tardías: "+cambio+" respeta la sesión antes de dibujar préstamos e historial",async()=>{
  let resolver,rechazar,avisar;
  const cuota=new Promise((resolve,reject)=>{resolver=resolve;rechazar=reject;});
  const solicitada=new Promise(resolve=>{avisar=resolve;});
  const {$,contexto}=panelSimulado(respuestasPanelConCuota(cuota,avisar)),carga=contexto.load();
  await Promise.race([solicitada,carga.then(()=>{throw Error("No alcanzó la consulta de cuotas: "+$("live").textContent);})]);
  const ids=["listaPorCobrar","listaPorPagar","listaPrestamosPagados","diario"];
  for(const id of ids)$(id).innerHTML="Contenido actual protegido";
  if(cambio==="usuario"||cambio==="error-de-usuario")contexto.token="sesion-dos";
  if(cambio==="logout")contexto.token=null;
  if(cambio==="oculto")$("app").hidden=true;
  if(cambio==="error-de-usuario")rechazar(Error("Fallo tardío de cuota"));
  else resolver({cuotasPagadas:[],proximaCuota:1});
  await carga;
  if(cambio==="sin-cambio"){
   assert.match($("listaPorPagar").innerHTML,/Deuda de cuenta anterior/);
   assert.match($("diario").innerHTML,/Movimiento de cuenta anterior/);
  }else for(const id of ids)assert.equal($(id).innerHTML,"Contenido actual protegido",id);
 });
}
test("una actualización pendiente retira el monto autorizado y un fallo no lo restaura",async()=>{
 let rechazar;const pendiente=new Promise((_,reject)=>{rechazar=reject;});
 const {$,contexto}=panelSimulado(()=>pendiente);
 const carga=contexto.load();
 assert.equal($("hDisponibleHoy").textContent,"No actualizado");
 assert.equal($("hDisponible").textContent,"No actualizado");
 assert.equal($("hPatrimonio").textContent,"$800.000");
 assert.equal($("captureText").value,"Borrador pendiente");
 contexto.window.grukExplain("disponibleHoy");assert.equal($("metricExplanation").hidden,true);
 rechazar(Object.assign(Error("Consulta incompleta"),{statusCode:422}));await carga;
 assert.equal($("hDisponibleHoy").textContent,"No actualizado");
 assert.match($("homeDecisions").textContent,/No hay una recomendación de gasto confirmada/);
 assert.match($("live").textContent,/Las cifras visibles pueden corresponder a una consulta anterior/);
 assert.equal($("live").dataset.alert,"true");
});
test("una alerta de registros ausentes tampoco conserva la autorización anterior",async()=>{
 const {$,contexto}=panelSimulado(async()=>({diagnostico:{identidadExistente:true,movimientos:0,deudas:0,cuentas:0,
  fechaCreacionCuenta:"2020-01-01T00:00:00.000Z"}}));
 await contexto.load();
 assert.equal($("hDisponibleHoy").textContent,"No actualizado");
 assert.match($("live").textContent,/ALERTA DE INTEGRIDAD/);
 assert.equal($("hPatrimonio").textContent,"$800.000");
});
test("un error tardío de otra sesión no invalida el disponible del usuario actual",async()=>{
 let rechazar;const pendiente=new Promise((_,reject)=>{rechazar=reject;});
 const {$,contexto}=panelSimulado(()=>pendiente),carga=contexto.load();
 contexto.token="sesion-dos";$("hDisponibleHoy").textContent="$250.000";
 $("homeDecisions").textContent="Datos del usuario actual";$("live").textContent="Sesión actual";
 rechazar(Error("Error de sesión anterior"));await carga;
 assert.equal($("hDisponibleHoy").textContent,"$250.000");
 assert.equal($("homeDecisions").textContent,"Datos del usuario actual");
 assert.equal($("live").textContent,"Sesión actual");
});
test("El panel conserva lectura de la misma cuenta y la invalida al cambiar de sesión",()=>{
 assert.match(codigo,/function invalidarIndicadoresFinancieros\(\)/);
 assert.match(codigo,/const ejecucion=\(async\(\)=>\{const liveAlCargar=/);
 assert.doesNotMatch(codigo,/const ejecucion=\(async\(\)=>\{invalidarIndicadoresFinancieros\(\);try\{/);
 assert.match(codigo,/if\(token!==j\.token\)\{cancelarSolicitudes\(\);limpiarIntentoManual\(\);invalidarIndicadoresFinancieros\(\)/);
 const invalidacion=codigo.slice(codigo.indexOf("function invalidarIndicadoresFinancieros()"),codigo.indexOf("let cargaPanelEnCurso="));
 for(const id of ["hDisponibleHoy","hDisponible","hComprometido","hFlujo","hPatrimonio","rIngresos","rGastos","rFlujo","rDeuda","pActivos","pInversiones","pDeudas","pNeto"])assert.ok(invalidacion.includes('"'+id+'"'),"No debe quedar en $0 el indicador "+id);
 for(const id of ["diario","listaPorCobrar","listaPorPagar","listaPrestamosPagados","homeDecisions","compromisosActivos","compromisosArchivados","flujoConciliacion"])assert.ok(invalidacion.includes('"'+id+'"'),"No debe mostrar datos de la sesión anterior: "+id);
 assert.match(codigo,/el\.textContent="No actualizado"/);
 assert.match(codigo,/catch\(e\)\{if\(e\.code==="SESION_CAMBIADA"[\s\S]*?const live=\$\("live"\)/);
 assert.match(codigo,/Las cifras visibles pueden corresponder a una consulta anterior/);
});

test("El panel rechaza indicadores ausentes antes de dibujar cifras financieras",()=>{
 const validacion=codigo.indexOf("const indicadoresObligatorios=");
 const render=codigo.indexOf('$("hComprometido").textContent=money(');
 assert.ok(validacion>0&&render>validacion,"validación monetaria debe anteceder renderizado");
 const fragmento=codigo.slice(validacion,render);
 for(const campo of ["r.resumen?.ingresos","r.resumen?.gastos","r.resumen?.deudaTotal",
  "home?.caja?.comprometidoMinor","home?.mes?.flujoRealizadoMinor","home?.patrimonio?.netoMinor"])
  assert.ok(fragmento.includes(campo),"indicador sin comprobación: "+campo);
 assert.match(fragmento,/indicadoresObligatorios\.every\(Number\.isSafeInteger\)/);
 assert.match(fragmento,/No se mostrarán como \$0/);
});

test("El formateador de COP nunca inventa $0, no redondea ni pierde precisión",()=>{
 const vm=require("node:vm");
 const inicio=codigo.indexOf("money=n=>{");
 const fin=codigo.indexOf(";async function api",inicio);
 assert.ok(inicio>0&&fin>inicio,"formateador personal presente");
 const money=vm.runInNewContext("("+codigo.slice(inicio,fin)+")",{Intl,Number,NaN});
 assert.match(money(0),/0/);
 assert.match(money(120000),/120/);
 assert.match(money(-5000),/5/);
 for(const valor of [undefined,null,"",false,0.1,1.25,Number.MAX_SAFE_INTEGER+1,"1.5","1e3","NaN",{},Infinity])
  assert.equal(money(valor),"No actualizado",String(valor)+" nunca puede convertirse a pesos");
 assert.match(money("120000"),/120/);
});

test("Cambio de sesión también invalida semáforo, balance y explicación anterior",()=>{
 const inicio=codigo.indexOf("function invalidarIndicadoresFinancieros()");
 const fin=codigo.indexOf("let cargaPanelEnCurso=",inicio);
 const bloque=codigo.slice(inicio,fin);
 for(const id of ["healthPercent","healthLabel","healthArrow","healthBubble","metricExplanation"])
  assert.ok(bloque.includes('$("'+id+'")'),"Debe limpiarse "+id);
 assert.match(bloque,/burbuja\.className="healthBubble neutral"/);
 assert.match(bloque,/Sin datos confirmados/);
 for(const id of ["chatHistory","drafts","histResultados","answer","iiResultado"])assert.ok(bloque.includes('"'+id+'"'),"Debe limpiar información privada visible: "+id);
 for(const id of ["captureText","histQ","histMonto","histDesde","histHasta"])assert.ok(bloque.includes('"'+id+'"'),"Debe limpiar texto del usuario anterior: "+id);
 assert.match(bloque,/el\.replaceChildren\(\)/);
 for(const id of ["homeGreeting","captureMsg","iiMsg","live"])assert.ok(bloque.includes('"'+id+'"'),"Debe limpiar mensajes de la cuenta anterior: "+id);
 assert.match(bloque,/mas\.hidden=true/);
 assert.match(bloque,/el\.dataset\.alert="false"/);
 assert.match(codigo,/function clearToken\(\)[\s\S]*?invalidarIndicadoresFinancieros\(\)/);
});
