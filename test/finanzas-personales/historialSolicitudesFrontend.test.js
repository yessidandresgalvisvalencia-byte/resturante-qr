"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const fuente=fs.readFileSync(path.resolve(__dirname,"../../public/finanzas-personales.js"),"utf8");
function preparar(){
 const elementos=new Map(),solicitudes=[];
 const $=id=>{
  if(!elementos.has(id))elementos.set(id,{value:"",hidden:false,textContent:"",dataset:{},children:[],
   replaceChildren(){this.children=[];},append(el){this.children.push(el);},addEventListener(){},reset(){}});
  return elementos.get(id);
 };
 const contexto=vm.createContext({$,token:"cuenta-uno",URLSearchParams,Date,esc:String,money:String,window:{},
  document:{createElement:()=>({innerHTML:""})},api:url=>new Promise((resolve,reject)=>solicitudes.push({url,resolve,reject}))});
 const inicio=fuente.indexOf("let histPagina="),fin=fuente.indexOf("window.rastrearCobro52000=",inicio);
 assert.ok(inicio>0&&fin>inicio);vm.runInContext(fuente.slice(inicio,fin),contexto);
 const a=fuente.indexOf("function invalidarIndicadoresFinancieros()"),b=fuente.indexOf("let cargaPanelEnCurso=",a);
 vm.runInContext(fuente.slice(a,b),contexto);
 return {$,contexto,solicitudes};
}
const respuesta=(nombre,hayMas=false)=>({items:[{clase:"MOVIMIENTO",tipo:"INGRESO",concepto:nombre,
 montoMinor:100,estado:"ACTIVA",fecha:"2026-10-29T12:00:00.000Z"}],hayMas});
test("limpiar durante una consulta impide que su respuesta vuelva a llenar el historial",async()=>{
 const {$,contexto,solicitudes}=preparar(),carga=contexto.buscarHistorial();
 $("histLimpiar").onclick();solicitudes[0].resolve(respuesta("Resultado descartado",true));await carga;
 assert.equal($("histResultados").children.length,0);
 assert.equal($("histMensaje").textContent,"");assert.equal($("histMas").hidden,true);
});
for(const falla of [false,true])test("una nueva búsqueda reemplaza la pendiente sin que la anterior "+(falla?"falle":"dibuje")+" sobre ella",async()=>{
 const {$,contexto,solicitudes}=preparar();$("histQ").value="primera";
 const primera=contexto.buscarHistorial();$("histQ").value="segunda";
 const segunda=contexto.buscarHistorial();assert.equal(solicitudes.length,2);
 assert.equal(new URL("https://ejemplo.test"+solicitudes[1].url).searchParams.get("q"),"segunda");
 if(falla)solicitudes[0].reject(Error("Error anterior"));else solicitudes[0].resolve(respuesta("Anterior",true));
 await primera;
 // El finally antiguo no debe desbloquear la paginación de la consulta actual.
 await contexto.buscarHistorial(false);assert.equal(solicitudes.length,2);
 assert.equal($("histResultados").children.length,0);
 assert.equal($("histMensaje").textContent,"Buscando en el historial…");
 solicitudes[1].resolve(respuesta("Vigente",true));await segunda;
 assert.equal($("histResultados").children.length,1);
 assert.match($("histResultados").children[0].innerHTML,/Vigente/);
 assert.equal($("histMas").hidden,false);
 const mas=contexto.buscarHistorial(false);assert.equal(solicitudes.length,3);
 assert.equal(new URL("https://ejemplo.test"+solicitudes[2].url).searchParams.get("pagina"),"2");
 solicitudes[2].resolve(respuesta("Página dos"));await mas;
 assert.equal($("histResultados").children.length,2);assert.equal($("histMas").hidden,true);
});
test("el cambio de cuenta libera la búsqueda y reinicia la página sin aceptar respuestas antiguas",async()=>{
 const {$,contexto,solicitudes}=preparar();
 const primera=contexto.buscarHistorial();solicitudes[0].resolve(respuesta("Primera",true));await primera;
 const pendiente=contexto.buscarHistorial(false);assert.equal(solicitudes.length,2);
 contexto.token="cuenta-dos";contexto.invalidarIndicadoresFinancieros();
 const actual=contexto.buscarHistorial(false);assert.equal(solicitudes.length,3);
 assert.equal(new URL("https://ejemplo.test"+solicitudes[2].url).searchParams.get("pagina"),"1");
 solicitudes[1].resolve(respuesta("Cuenta anterior",true));await pendiente;
 assert.equal($("histResultados").children.length,0);
 solicitudes[2].resolve(respuesta("Cuenta actual"));await actual;
 assert.equal($("histResultados").children.length,1);
 assert.match($("histResultados").children[0].innerHTML,/Cuenta actual/);
});
