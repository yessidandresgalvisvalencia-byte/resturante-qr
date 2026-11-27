"use strict";
const disponible=require("./disponibleConversacionalPersonal.service");
const temas=Object.freeze({
 inversion:{titulo:"inversión",criterio:"La elección depende de objetivo, plazo, liquidez, costos y pérdida que podrías asumir.",accion:"define objetivo, plazo, liquidez necesaria y pérdida máxima aceptable."},
 ahorro:{titulo:"ahorro",criterio:"La meta necesita un valor y fecha; las obligaciones deben seguir cubiertas.",accion:"define el valor y la fecha de tu meta de ahorro."},
 finanzas:{titulo:"tus finanzas",criterio:"La caja y los compromisos registrados preceden a cualquier nuevo objetivo.",accion:"define el objetivo y la fecha que quieres analizar."},
 vivienda:{titulo:"vivienda",criterio:"Comparar compra y arriendo requiere precio, cuota, intereses, seguros, impuestos y mantenimiento.",accion:"reúne valores, fechas y costos de las alternativas de vivienda."},
 seguros:{titulo:"seguros",criterio:"La comparación requiere prima, coberturas, exclusiones y deducibles registrados.",accion:"reúne las cotizaciones y condiciones que quieres comparar."},
 retiro:{titulo:"retiro",criterio:"Una proyección requiere fecha, aportes, costos y supuestos explícitos; aquí no se proyecta una pensión.",accion:"define la fecha y los aportes que quieres evaluar para tu retiro."},
 presupuesto:{titulo:"presupuesto",criterio:"El presupuesto requiere fechas y montos de ingresos, obligaciones y objetivos.",accion:"define tu objetivo de presupuesto y su fecha."}
});
function validarOpciones(tipo,tema){
 if(!Object.hasOwn(temas,tema)||!(tipo==="ASESORIA_FINANCIERA_ABIERTA"&&["inversion","ahorro","finanzas"].includes(tema)||tipo==="ASESORIA_PLANIFICACION"&&["vivienda","seguros","retiro","presupuesto"].includes(tema)||tipo==="INVERSION"&&tema==="inversion"))throw Object.assign(new Error("Orientación inválida"),{statusCode:400});
 return temas[tema];
}
const money=n=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n);
function presentar(v,{tipo,tema}){
 const t=validarOpciones(tipo,tema),conocido=v.autorizado===true,a=conocido?v.datos:null;
 const datos={tema,orientacionGeneral:true,requiereAprobacion:false,disponibleConocido:conocido,disponibleMinor:a?.disponibleHoyMinor??null,montoInvertibleMinor:null,montoAhorrableMinor:null,aptoParaInversion:false,aptoParaAhorro:false,motivo:v.codigo,...(a?{corte:a.corte,estaEnRojo:a.estaEnRojo,escenarioGmf:a.escenarioGmf}:{requiereReconciliacion:v.codigo==="CONCILIACION_PENDIENTE"})};
 let lineas;
 if(!conocido)lineas=["🟡 Orientación sobre "+t.titulo+".","No tengo un saldo disponible verificado para esta decisión.",v.mensaje,t.criterio,"No recomiendo un aporte ni producto con esos datos.","Acción: "+v.accion];
 else if(a.disponibleHoyMinor===0)lineas=[(a.estaEnRojo?"🔴":"🟡")+" Orientación sobre "+t.titulo+".","Disponible Hoy registrado: "+money(a.disponibleHoyMinor)+".",a.estaEnRojo?"La brecha actual para compromisos y colchón es "+money(a.faltanteActualMinor)+".":"Con estos registros no hay margen para una salida adicional.",t.criterio,"No se fija un aporte de ahorro ni inversión.","Acción: no comprometas dinero adicional con estos registros."];
 else lineas=["🟡 Orientación sobre "+t.titulo+".","Disponible Hoy registrado: "+money(a.disponibleHoyMinor)+" en salidas totales.","Ese límite incluye gasto e impuestos; no es un monto apto para invertir o ahorrar.",t.criterio,"No elegí un producto ni proyecté rendimientos; el ingreso previsto no está garantizado.","Acción: "+t.accion];
 return{tipo,respuesta:lineas.join("\n"),datos,fuente:"ASESOR_HOME_VERIFICADO"};
}
async function consultar(usuarioId,{tipo,tema,ahora=new Date()}={}){
 validarOpciones(tipo,tema);
 return presentar(await disponible.observar(usuarioId,{ahora}),{tipo,tema});
}
module.exports={consultar,presentar};
