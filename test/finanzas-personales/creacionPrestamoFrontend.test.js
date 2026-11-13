"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),crypto=require("node:crypto");
const {crearControlMutacionesPersonales:crear}=require("../../public/finanzas-personales-control-mutaciones");
const S=require("../../modules/finanzas-personales/services/creacionPrestamoRecuperablePersonal.service");
const src=fs.readFileSync(require.resolve("../../public/finanzas-personales.js"),"utf8");
const solicitud=()=>({confirmacion:true,direccion:"POR_COBRAR",origenCuentaPorCobrar:"TRABAJO",contraparte:"Ana",concepto:"Trabajo",principalMinor:100,fechaInicio:"2026-01-01T05:00:00.000Z",fechaVencimiento:null});
function control(){const m=new Map();return crear({almacenamiento:{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)},digerir:async v=>crypto.createHash("sha256").update(v).digest("hex"),usuarioDeToken:t=>t});}
function recibo(s,id){return{confirmado:true,certificaEstadoActual:false,metodo:"POST",ruta:"/prestamos",solicitudId:id,solicitudHuella:S.huellaSolicitud(s),prestamoId:"a".repeat(24),hash:"b".repeat(64)};}
test("formulario usa fecha visible estable, confirmación, clave y bloqueo de doble clic",async()=>{
 const dom=new Map(Object.entries({pContraparte:{value:"Ana"},pConcepto:{value:"Trabajo"},pSaldo:{value:"100"},pOrigen:{value:"TRABAJO"},pFecha:{value:"2026-01-01"},app:{hidden:false},savePrestamo:{disabled:false}})),mensajes=[],llamadas=[];let resolver,cargas=0;
 const ctx={window:{confirm:()=>true},token:"sesion",$:id=>dom.get(id),money:String,msg:(...a)=>mensajes.push(a),crypto:{randomUUID:()=>"id_00000001"},load:async()=>cargas++,api:async(p,o)=>{llamadas.push({p,o});return await new Promise(r=>resolver=r);}};
 vm.runInNewContext(src.slice(src.indexOf('$("savePrestamo").onclick='),src.indexOf('$("saveCredito").onclick=')),ctx);
 const a=dom.get("savePrestamo").onclick();await dom.get("savePrestamo").onclick();assert.equal(llamadas.length,1);assert.deepEqual(JSON.parse(llamadas[0].o.body),solicitud());assert.match(llamadas[0].o.headers["Idempotency-Key"],/^prestamo_/);
 resolver({recibo:{confirmado:true}});await a;assert.equal(cargas,1);assert.equal(dom.get("pSaldo").value,"");assert.equal(dom.get("savePrestamo").disabled,false);
 ctx.window.confirm=()=>false;dom.get("pContraparte").value="Ana";dom.get("pSaldo").value="100";await dom.get("savePrestamo").onclick();assert.equal(llamadas.length,1);
});
test("respuesta tardía de otra sesión no borra el formulario ni publica confirmación",async()=>{
 const dom=new Map(),$=id=>{if(!dom.has(id))dom.set(id,{value:({pContraparte:"Ana",pSaldo:"100",pConcepto:"Trabajo",pFecha:"2026-01-01",pOrigen:"TRABAJO"})[id]||"",hidden:false,disabled:false});return dom.get(id);};let resolver;const mensajes=[],ctx={window:{confirm:()=>true},token:"sesion",$,money:String,msg:(...a)=>mensajes.push(a),crypto:{randomUUID:()=>"id_00000001"},load:async()=>{throw Error("carga indebida");},api:async()=>await new Promise(r=>resolver=r)};
 vm.runInNewContext(src.slice(src.indexOf('$("savePrestamo").onclick='),src.indexOf('$("saveCredito").onclick=')),ctx);const p=$("savePrestamo").onclick();ctx.token="otra";resolver({recibo:{confirmado:true}});await p;assert.equal($("pSaldo").value,"100");assert.equal(mensajes.length,0);
});
test("consulta de creación perdida usa solo GET y resuelve únicamente su huella",async()=>{
 const c=control(),s=solicitud(),id="prestamo_prueba_0001",op=await c.iniciar("sesion","/prestamos",{method:"POST",headers:{"Idempotency-Key":id},body:JSON.stringify(s)});op.finalizar("INCIERTA");const llamadas=[];let cargas=0;const dom=new Map(),ctx={window:{},token:"sesion",$:id=>{if(!dom.has(id))dom.set(id,{hidden:false,disabled:false});return dom.get(id);},controlFinancieroPersonal:()=>c,api:async(p,o)=>{llamadas.push({p,o});return{recibo:recibo(s,id)};},msg:()=>{},loadDrafts:async()=>{},load:async()=>cargas++};
 vm.runInNewContext(src.slice(src.indexOf("const aprobacionesEnCurso="),src.indexOf("window.discardDraft=")),ctx);await ctx.window.confirmarAprobacionesPendientes();assert.equal(llamadas.length,1);assert.equal(llamadas[0].p,"/prestamos/confirmacion-creacion/"+id);assert.equal(llamadas[0].o,undefined);assert.equal(c.estado("sesion").bloqueada,false);assert.equal(cargas,1);
});
