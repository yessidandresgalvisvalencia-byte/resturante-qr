"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const servicio=require("../../modules/finanzas-personales/services/creacionPrestamoRecuperablePersonal.service");
const {crearControlMutacionesPersonales:crear}=require("../../public/finanzas-personales-control-mutaciones");
const solicitud=()=>({confirmacion:true,direccion:"POR_COBRAR",origenCuentaPorCobrar:"TRABAJO",contraparte:"Ana",principalMinor:100,fechaInicio:"2026-01-01T05:00:00.000Z",fechaVencimiento:null});
test("creación exige confirmación, importes exactos y fechas explícitas sin coerción",()=>{
 assert.equal(servicio.validarSolicitud(solicitud()).principalMinor,100);
 for(const d of [{confirmacion:false},{usuarioId:"ajeno"},{principalMinor:"100"},{principalMinor:NaN},{principalMinor:0},{principalMinor:Number.MAX_SAFE_INTEGER+1},{cuotaMinor:1.5},{tasaMensualPct:"0"},{fechaInicio:"2026-02-30T05:00:00.000Z"},{fechaInicio:new Date().toISOString().replace(/^\d{4}/,"2099")},{fechaInicio:1000},{fechaVencimiento:"2025-12-31T05:00:00.000Z"},{cuentaId:"a".repeat(24)},{contraparte:" "}])assert.throws(()=>servicio.validarSolicitud({...solicitud(),...d}));
 assert.throws(()=>servicio.validarIdentidad("a".repeat(24),"sin-prefijo"));
});
test("recibo de creación se vincula a huella persistida, no autoriza saldo actual ni otra operación",async()=>{
 const datos=new Map(),control=()=>crear({almacenamiento:{getItem:k=>datos.get(k)??null,setItem:(k,v)=>datos.set(k,v)},digerir:async v=>crypto.createHash("sha256").update(v).digest("hex"),usuarioDeToken:t=>t}),c=control(),s=solicitud(),id="prestamo_prueba_0001";
 const op=await c.iniciar("ana","/prestamos",{method:"POST",headers:{"Idempotency-Key":id},body:JSON.stringify(s)});
 const r={confirmado:true,certificaEstadoActual:false,ruta:"/prestamos",metodo:"POST",solicitudId:id,solicitudHuella:servicio.huellaSolicitud(s),hash:"a".repeat(64),prestamoId:"b".repeat(24)};
 assert.equal(c.reciboPrestamoValido("ana",r),true);assert.equal(c.confirmarCreacionPrestamo("ana",r),false);op.finalizar("INCIERTA");const recargado=control();
 for(const mal of [{hash:""},{certificaEstadoActual:true},{ruta:"/creditos"},{solicitudHuella:"c".repeat(64)},{prestamoId:""},{solicitudId:"prestamo_otro_0002"}])assert.equal(recargado.confirmarCreacionPrestamo("ana",{...r,...mal}),false);
 assert.equal(recargado.confirmarCreacionPrestamo("otra",r),false);
 await assert.rejects(recargado.iniciar("ana","/prestamos",{method:"POST",headers:{"Idempotency-Key":"prestamo_otro_0002"},body:JSON.stringify({...s,principalMinor:101})}),/sin confirmar/);
 const retry=await recargado.iniciar("ana","/prestamos",{method:"POST",headers:{"Idempotency-Key":"prestamo_nuevo_0002"},body:JSON.stringify(s)});assert.equal(retry.opciones.headers["Idempotency-Key"],id);retry.finalizar("INCIERTA");
 assert.equal(recargado.confirmarCreacionPrestamo("ana",r),true);assert.equal(recargado.confirmarCreacionPrestamo("ana",r),false);assert.equal(recargado.estado("ana").bloqueada,false);
});
test("modelo bloquea mutación aun omitiendo validación de mongoose",async()=>{const R=require("../../modules/finanzas-personales/models/reciboCreacionPrestamoPersonal.model");const r=R.hydrate({_id:"a".repeat(24)});await assert.rejects(r.save({validateBeforeSave:false}),/APPEND_ONLY/);});

test("rutas usan propietario JWT y clave, ocultan errores internos y consultan sin escritura",async()=>{
 const router=require("../../modules/finanzas-personales/routes"),post=router.stack.find(x=>x.route?.path==="/prestamos"&&x.route.methods.post).route.stack.at(-1).handle,get=router.stack.find(x=>x.route?.path==="/prestamos/confirmacion-creacion/:solicitudId").route.stack.at(-1).handle,crearOriginal=servicio.crear,consultarOriginal=servicio.consultar;
 const res={statusCode:200,status(n){this.statusCode=n;return this;},json(j){this.datos=j;return this;}},req={personalAuth:{userId:"propietario"},body:solicitud(),get:n=>{assert.equal(n,"Idempotency-Key");return"prestamo_prueba_0001";},params:{solicitudId:"prestamo_prueba_0001"}};
 try{servicio.crear=async(u,id,s)=>{assert.equal(u,"propietario");assert.equal(id,req.params.solicitudId);assert.equal(s,req.body);return{duplicado:false,recibo:{confirmado:true}};};await post(req,res);assert.equal(res.statusCode,201);
 servicio.consultar=async(u,id)=>{assert.equal(u,"propietario");assert.equal(id,req.params.solicitudId);return{confirmado:true};};await get(req,res);assert.equal(res.datos.recibo.confirmado,true);
 servicio.consultar=async()=>{throw Error("secreto de conexión");};await get(req,res);assert.equal(res.statusCode,500);assert.doesNotMatch(res.datos.error,/secreto/);
 }finally{servicio.crear=crearOriginal;servicio.consultar=consultarOriginal;}
});
