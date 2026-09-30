const express = require("express");
const router = express.Router();
const ia = require("../gruk-ai");
const EmpleadoLaboral = require("../models/EmpleadoLaboral");
const SolicitudLaboral = require("../models/SolicitudLaboral");
const AsistenciaLaboral = require("../models/AsistenciaLaboral");
const authMiddleware = require("../core/auth/auth.middleware");
const { ROLES_GRUK, roleCheck } = require("../core/auth/roleCheck.middleware");
const { resolverContextoLaboral } = require("../core/laboral/tenantLaboral.service");

// CREAR EMPLEADO
router.post("/empleados", authMiddleware, roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE), async (req, res) => {
  try {
    const {
      restaurantId,
      nombre,
      documento,
      cargo,
      area,
      telefono,
      correo,
      contrato,
      salario,
      valorHora,
      fotoBase
    } = req.body;

    if (!restaurantId || !nombre || !documento || !cargo || !area) {
      return res.status(400).json({
        ok: false,
        mensaje: "Faltan datos obligatorios del empleado."
      });
    }

    const salarioNum = Number(salario || 0);

    let valorHoraNum = Number(valorHora || 0);

    if (valorHoraNum <= 0 && salarioNum > 0) {
      valorHoraNum = Math.round(salarioNum / 240);
    }

    const contexto = await resolverContextoLaboral(req.auth, restaurantId);

    const empleado = await EmpleadoLaboral.create({
      empresaId: contexto.empresaId,
      sedeId: contexto.sedeId,
      restaurantId: contexto.restaurantId,
      nombre,
      documento,
      cargo,
      area,
      telefono,
      correo,
      contrato,
      salario: salarioNum,
      valorHora: valorHoraNum,
      fotoBase,
      activo: true
    });

    res.json({
      ok: true,
      mensaje: "Empleado creado correctamente.",
      empleado
    });

   } catch (error) {
    console.error("Error creando empleado laboral:", error);
    if (error.code === 11000) {
      return res.status(409).json({
        ok: false,
        mensaje: "Ya existe un empleado con ese documento en este restaurante."
      });
    }

    res.status(500).json({
      ok: false,
      mensaje: "Error interno creando empleado laboral."
    });
  }
});

// LISTAR EMPLEADOS
router.get("/empleados/:restaurantId", authMiddleware, roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE), async (req,res)=>{
 try{
  const contexto=await resolverContextoLaboral(req.auth,req.params.restaurantId);
  const empleados=await EmpleadoLaboral.find({empresaId:req.auth.empresaId,restaurantId:contexto.restaurantId}).sort({createdAt:-1});
  return res.json({ok:true,empleados});
 }catch(error){console.error("Error listando empleados laborales:",error);return res.status(500).json({ok:false,mensaje:"Error interno listando empleados."});}
});

// CAMBIAR ESTADO ACTIVO / INACTIVO
router.put("/empleados/:id/estado", authMiddleware, roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE), async (req,res)=>{
 try{
  const actual=await EmpleadoLaboral.findOne({_id:req.params.id,empresaId:req.auth.empresaId}).select("restaurantId activo").lean();
  if(!actual)return res.status(404).json({ok:false,mensaje:"Empleado no encontrado."});
  const contexto=await resolverContextoLaboral(req.auth,actual.restaurantId);
  const empleado=await EmpleadoLaboral.findOneAndUpdate({_id:req.params.id,empresaId:req.auth.empresaId,restaurantId:contexto.restaurantId},{$set:{activo:!actual.activo}},{returnDocument:"after"});
  if(!empleado)return res.status(404).json({ok:false,mensaje:"Empleado no encontrado."});
  return res.json({ok:true,mensaje:"Estado actualizado.",empleado});
 }catch(error){console.error("Error cambiando estado empleado:",error);return res.status(500).json({ok:false,mensaje:"Error interno cambiando estado."});}
});

// ELIMINAR EMPLEADO
router.delete("/empleados/:id", authMiddleware, roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE), async (req,res)=>{
 try{
  const actual=await EmpleadoLaboral.findOne({_id:req.params.id,empresaId:req.auth.empresaId}).select("restaurantId").lean();
  if(!actual)return res.status(404).json({ok:false,mensaje:"Empleado no encontrado."});
  const contexto=await resolverContextoLaboral(req.auth,actual.restaurantId);
  const empleado=await EmpleadoLaboral.findOneAndDelete({_id:req.params.id,empresaId:req.auth.empresaId,restaurantId:contexto.restaurantId});
  if(!empleado)return res.status(404).json({ok:false,mensaje:"Empleado no encontrado."});
  return res.json({ok:true,mensaje:"Empleado eliminado correctamente."});
 }catch(error){console.error("Error eliminando empleado:",error);return res.status(500).json({ok:false,mensaje:"Error interno eliminando empleado."});}
});
router.post("/reconocer", authMiddleware, roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE, ROLES_GRUK.EMPLEADO), async (req, res) => {
  try {
    const { restaurantId, selfie } = req.body;

    if (!restaurantId || !selfie) {
      return res.status(400).json({
        ok: false,
        mensaje: "Faltan restaurantId o selfie."
      });
    }

    const contexto = await resolverContextoLaboral(req.auth, restaurantId);
    const empleados = await EmpleadoLaboral.find({
      empresaId: contexto.empresaId,
      restaurantId: contexto.restaurantId,
      activo: true
    }).lean();

    const resultado = await ia.reconocimiento.reconocerEmpleado({
  restaurantId,
  selfie,
  empleados
});

    res.json(resultado);

  } catch (error) {
    console.error("Error en /laboral/reconocer:", error);

    res.status(500).json({
      ok: false,
      mensaje: "Error reconociendo empleado."
    });
  }
});
// CREAR SOLICITUD LABORAL
router.post("/solicitudes", authMiddleware, roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE, ROLES_GRUK.EMPLEADO), async (req,res)=>{
 try{
  const {restaurantId,empleadoId,empleadoNombre,tipo}=req.body;
  if(!restaurantId||!empleadoId||!tipo)return res.status(400).json({ok:false,mensaje:"Faltan datos obligatorios de la solicitud."});
  const contexto=await resolverContextoLaboral(req.auth,restaurantId);
  const empleado=await EmpleadoLaboral.findOne({_id:empleadoId,empresaId:req.auth.empresaId,restaurantId:contexto.restaurantId,activo:true}).select("_id nombre").lean();
  if(!empleado)return res.status(403).json({ok:false,mensaje:"Empleado fuera del tenant autorizado."});
  const solicitud=await SolicitudLaboral.create({empresaId:req.auth.empresaId,sedeId:contexto.sedeId,restaurantId:contexto.restaurantId,empleadoId,empleadoNombre:empleado.nombre||empleadoNombre,tipo,estado:"pendiente"});
  return res.json({ok:true,mensaje:"Solicitud enviada correctamente.",solicitud});
 }catch(error){console.error("Error creando solicitud laboral:",error);return res.status(500).json({ok:false,mensaje:"Error interno creando solicitud laboral."});}
});

// LISTAR SOLICITUDES POR RESTAURANTE
router.get("/solicitudes/:restaurantId", authMiddleware, roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE), async (req,res)=>{
 try{
  const contexto=await resolverContextoLaboral(req.auth,req.params.restaurantId);
  const solicitudes=await SolicitudLaboral.find({empresaId:req.auth.empresaId,restaurantId:contexto.restaurantId}).sort({createdAt:-1});
  return res.json({ok:true,solicitudes});
 }catch(error){console.error("Error listando solicitudes:",error);return res.status(500).json({ok:false,mensaje:"Error interno listando solicitudes."});}
});

// CAMBIAR ESTADO DE SOLICITUD
router.put("/solicitudes/:id/estado", authMiddleware, roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE), async (req,res)=>{
 try{
  const {estado,observacion}=req.body;
  if(!["pendiente","aprobada","rechazada"].includes(estado))return res.status(400).json({ok:false,mensaje:"Estado inválido."});
  const actual=await SolicitudLaboral.findOne({_id:req.params.id,empresaId:req.auth.empresaId}).select("restaurantId").lean();
  if(!actual)return res.status(404).json({ok:false,mensaje:"Solicitud no encontrada."});
  const contexto=await resolverContextoLaboral(req.auth,actual.restaurantId);
  const solicitud=await SolicitudLaboral.findOneAndUpdate({_id:req.params.id,empresaId:req.auth.empresaId,restaurantId:contexto.restaurantId},{$set:{estado,observacion:observacion||""}},{returnDocument:"after"});
  if(!solicitud)return res.status(404).json({ok:false,mensaje:"Solicitud no encontrada."});
  return res.json({ok:true,mensaje:"Solicitud actualizada correctamente.",solicitud});
 }catch(error){console.error("Error actualizando solicitud:",error);return res.status(500).json({ok:false,mensaje:"Error interno actualizando solicitud."});}
});
// MARCAR ENTRADA
router.post("/asistencias/entrada", authMiddleware, roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE, ROLES_GRUK.EMPLEADO), async (req, res) => {
  try {
    const {
      restaurantId,
      empleadoId,
      empleadoNombre,
      cargo,
      fecha,
      selfieEntrada,
      gpsEntrada
    } = req.body;

    if (!restaurantId || !empleadoId || !fecha) {
      return res.status(400).json({
        ok: false,
        mensaje: "Faltan datos para marcar entrada."
      });
    }

    const contexto = await resolverContextoLaboral(req.auth, restaurantId);
    const empleado = await EmpleadoLaboral.findOne({ _id:empleadoId, empresaId:contexto.empresaId, restaurantId:contexto.restaurantId, activo:true }).select("_id").lean();
    if (!empleado) return res.status(403).json({ ok:false, mensaje:"Empleado fuera del tenant autorizado." });
    const existente = await AsistenciaLaboral.findOne({
      empresaId: contexto.empresaId,
      restaurantId: contexto.restaurantId,
      empleadoId,
      fecha
    });

    if (existente && existente.entradaReal) {
      return res.status(400).json({
        ok: false,
        mensaje: "Ya registraste entrada hoy.",
        asistencia: existente
      });
    }

    const asistencia = await AsistenciaLaboral.create({
      empresaId: contexto.empresaId,
      sedeId: contexto.sedeId,
      restaurantId: contexto.restaurantId,
      empleadoId,
      empleadoNombre,
      cargo,
      fecha,
      entradaReal: new Date().toISOString(),
      horaEntradaTexto: new Date().toLocaleTimeString("es-CO", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Bogota"
}),
    
      selfieEntrada,
      gpsEntrada,
      salidaReal: null,
      selfieSalida: null,
      gpsSalida: null,
      horasTrabajadas: 0,
      estado: "entrada_registrada",
      verificacionFacial: "empleado_reconocido"
    });

    res.json({
      ok: true,
      mensaje: "Entrada registrada correctamente.",
      asistencia
    });

  } catch (error) {
    console.error("Error marcando entrada:", error);
    res.status(500).json({
      ok: false,
      mensaje: "Error interno marcando entrada."
    });
  }
});

// MARCAR SALIDA
router.put("/asistencias/salida", authMiddleware, roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE, ROLES_GRUK.EMPLEADO), async (req, res) => {
  try {
    const {
      restaurantId,
      empleadoId,
      fecha,
      selfieSalida,
      gpsSalida
    } = req.body;

    const contexto = await resolverContextoLaboral(req.auth, restaurantId);
    const asistencia = await AsistenciaLaboral.findOne({
      empresaId: contexto.empresaId,
      restaurantId: contexto.restaurantId,
      empleadoId,
      fecha
    });

    if (!asistencia || !asistencia.entradaReal) {
      return res.status(400).json({
        ok: false,
        mensaje: "Primero debes marcar entrada."
      });
    }

    if (asistencia.salidaReal) {
      return res.status(400).json({
        ok: false,
        mensaje: "Ya registraste salida hoy."
      });
    }

    const salida = new Date();
    const entrada = new Date(asistencia.entradaReal);

    const horas =
      (salida.getTime() - entrada.getTime()) / (1000 * 60 * 60);

    asistencia.salidaReal = salida.toISOString();
    asistencia.horaSalidaTexto = salida.toLocaleTimeString("es-CO", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Bogota"
});
    asistencia.selfieSalida = selfieSalida;
    asistencia.gpsSalida = gpsSalida;
    asistencia.horasTrabajadas = Number(horas.toFixed(2));
    asistencia.estado = "turno_completado";

    await asistencia.save();

    res.json({
      ok: true,
      mensaje: "Salida registrada correctamente.",
      asistencia
    });

  } catch (error) {
    console.error("Error marcando salida:", error);
    res.status(500).json({
      ok: false,
      mensaje: "Error interno marcando salida."
    });
  }
});

// LISTAR ASISTENCIAS
router.get("/asistencias/:restaurantId/:empleadoId", authMiddleware, roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE), async (req, res) => {
  try {
    const { restaurantId, empleadoId } = req.params;
    const contexto = await resolverContextoLaboral(req.auth, restaurantId);

    const asistencias = await AsistenciaLaboral.find({
      empresaId: contexto.empresaId,
      restaurantId: contexto.restaurantId,
      empleadoId
    }).sort({ createdAt: -1 });

    res.json({
      ok: true,
      asistencias
    });

  } catch (error) {
    console.error("Error listando asistencias:", error);
    res.status(500).json({
      ok: false,
      mensaje: "Error interno listando asistencias."
    });
  }
});

// LISTAR TODAS LAS ASISTENCIAS DEL RESTAURANTE
router.get("/asistencias/:restaurantId", authMiddleware, roleCheck(ROLES_GRUK.DUENO, ROLES_GRUK.ADMIN_SEDE), async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const contexto = await resolverContextoLaboral(req.auth, restaurantId);

    const asistencias = await AsistenciaLaboral.find({
      empresaId: contexto.empresaId,
      restaurantId: contexto.restaurantId
    }).sort({ createdAt: -1 });

    res.json({
      ok: true,
      asistencias
    });

  } catch (error) {
    console.error("Error listando asistencias restaurante:", error);
    res.status(500).json({
      ok: false,
      mensaje: "Error interno listando asistencias."
    });
  }
});
module.exports = router;