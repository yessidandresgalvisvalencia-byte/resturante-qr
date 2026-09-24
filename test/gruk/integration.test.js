"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const TEST_MONGO_URI = process.env.TEST_MONGO_URI;

test(
  "ciclo completo: 5 neuronas -> decision -> aprobacion -> auditoria",
  { skip: !TEST_MONGO_URI },
  async () => {
    const mongoose = require("mongoose");
    const Empresa = require("../../models/Empresa");
    const Venta = require("../../models/Venta");
    const Inventario = require("../../models/Inventario");
    const Reporte = require("../../intelligence/models/CerebroReporteNeurona");
    const Decision = require("../../intelligence/models/CerebroDecision");
    const Auditoria = require("../../intelligence/models/CerebroAuditoria");
    const Memoria = require("../../intelligence/memory/CerebroMemoria");
    const JuntaSesion = require("../../intelligence/board/JuntaSesion");
    const { ejecutarCicloEmpresa } = require("../../intelligence/orchestrator/cicloInteligencia");
    const { procesarOrden, obtenerAuditoria } = require("../../intelligence/brain/cerebro.service");
    const { ROLES_GRUK } = require("../../core/auth/roleCheck.middleware");
    const { abrirSesion, agregarIntervencion, cerrarSesion } = require("../../intelligence/board/junta.service");
    const { evaluarPendientes } = require("../../intelligence/memory/memoria.service");

    await mongoose.connect(TEST_MONGO_URI, {
      dbName: "gruk_ci"
    });

    try {
      await mongoose.connection.db.dropDatabase();

      const empresa = await Empresa.create({
        empresaId: "emp_ci_integracion",
        nombre: "GRUK CI",
        tipoNegocio: "restaurante",
        correo: "ci@gruk.test",
        estado: "activa",
        configuracion: {
          margen_objetivo: 40,
          punto_equilibrio: 1000000,
          ticket_objetivo: 50000,
          cac_maximo: 10000,
          empleados_actuales: 18
        },
        modulos: {
          restaurante: true,
          inventario: true,
          finanzas: true,
          facturacion: false,
          laboral: false,
          inteligencia: true,
          gente: false,
          servicio_cliente: false
        }
      });

      const fecha = new Date();

      await Venta.create([
        {
          empresaId: empresa._id,
          concepto: "Venta CI 1",
          cantidad: 1,
          precioUnitario: 40000,
          costoUnitario: 30000,
          costoTotal: 30000,
          utilidadBruta: 10000,
          margenBruto: 25,
          total: 40000,
          estado: "pagada",
          fecha,
          metadata: { costoCongelado: true }
        },
        {
          empresaId: empresa._id,
          concepto: "Venta CI 2",
          cantidad: 1,
          precioUnitario: 40000,
          costoUnitario: 30000,
          costoTotal: 30000,
          utilidadBruta: 10000,
          margenBruto: 25,
          total: 40000,
          estado: "pagada",
          fecha,
          metadata: { costoCongelado: true }
        }
      ]);

      await Inventario.create([
        {
          empresaId: empresa._id,
          nombre: "Insumo disponible",
          categoria: "CI",
          cantidad: 10,
          estado: "vigente",
          anulado: false
        },
        {
          empresaId: empresa._id,
          nombre: "Insumo agotado",
          categoria: "CI",
          cantidad: 0,
          estado: "agotado",
          anulado: false
        }
      ]);

      const resultado = await ejecutarCicloEmpresa(
        empresa._id,
        { forzarDecision: true }
      );

      assert.equal(resultado.reportes.length, 5);
      assert.deepEqual(
        new Set(resultado.reportes.map((r) => r.neurona)),
        new Set(["FINANZAS", "VENTAS", "MARKETING", "OPERACIONES", "GENTE"])
      );

      const reportesGuardados = await Reporte.countDocuments({
        empresaId: empresa._id,
        deletedAt: null
      });
      assert.equal(reportesGuardados, 5);

      assert.ok(resultado.decision?._id);
      assert.ok(resultado.decision.ordenes_por_departamento.length > 0);

      const decisionGuardada = await Decision.findById(resultado.decision._id);
      const orden = decisionGuardada.ordenes_por_departamento[0];
      assert.equal(orden.estado, "PENDIENTE_APROBACION");

      const usuarioId = new mongoose.Types.ObjectId();

      const authDueno = {
        usuarioId: String(usuarioId),
        empresaId: String(empresa._id),
        sedeId: null,
        rol: ROLES_GRUK.DUENO
      };

      const junta = await abrirSesion({
        auth: authDueno,
        decisionId: String(decisionGuardada._id)
      });

      assert.equal(junta.estado, "ABIERTA");
      assert.equal(
        junta.intervenciones.filter((item) => item.tipo === "NEURONA").length,
        5
      );

      const juntaIntervenida = await agregarIntervencion({
        auth: authDueno,
        sesionId: String(junta._id),
        payload: {
          departamento: "DIRECCION",
          mensaje: "Validar responsables y fecha antes de ejecutar."
        }
      });

      assert.equal(
        juntaIntervenida.intervenciones.filter((item) => item.tipo === "HUMANO").length,
        1
      );
      const intervencionHumana = juntaIntervenida.intervenciones.find(
        (item) => item.tipo === "HUMANO"
      );
      assert.equal(intervencionHumana.impacto_financiero_estimado, null);
      assert.equal(intervencionHumana.confianza, null);

      const juntaGuardada = await JuntaSesion.findById(junta._id).lean();
      assert.equal(juntaGuardada.intervenciones.length, 6);

      const juntaCerrada = await cerrarSesion({
        auth: authDueno,
        sesionId: String(junta._id)
      });
      assert.equal(juntaCerrada.estado, "CERRADA");
      assert.equal(String(juntaCerrada.closedBy), String(usuarioId));
      assert.ok(juntaCerrada.closedAt);

      await assert.rejects(
        () => agregarIntervencion({
          auth: authDueno,
          sesionId: String(junta._id),
          payload: {
            departamento: "DIRECCION",
            mensaje: "No debe entrar después del cierre."
          }
        }),
        (error) => error.statusCode === 409
      );

      const otraEmpresa = await Empresa.create({
        empresaId: "emp_ci_aislamiento",
        nombre: "GRUK CI Tenant B",
        tipoNegocio: "servicios",
        correo: "tenant-b@gruk.test",
        estado: "activa"
      });

      await assert.rejects(
        () => abrirSesion({
          auth: {
            usuarioId: String(new mongoose.Types.ObjectId()),
            empresaId: String(otraEmpresa._id),
            sedeId: null,
            rol: ROLES_GRUK.DUENO
          },
          decisionId: String(decisionGuardada._id)
        }),
        (error) => error.statusCode === 404,
        "Junta no debe abrir decision de otro tenant"
      );

      await assert.rejects(
        () => procesarOrden({
          auth: {
            usuarioId: String(new mongoose.Types.ObjectId()),
            empresaId: String(otraEmpresa._id),
            sedeId: null,
            rol: ROLES_GRUK.DUENO
          },
          decisionId: String(decisionGuardada._id),
          ordenId: String(orden._id),
          accion: "APROBAR"
        }),
        (error) => error.statusCode === 404
      );

      const auditoriaAjena = await Auditoria.countDocuments({
        empresaId: otraEmpresa._id,
        decisionId: decisionGuardada._id
      });
      assert.equal(auditoriaAjena, 0);

      const aprobada = await procesarOrden({
        auth: authDueno,
        decisionId: String(decisionGuardada._id),
        ordenId: String(orden._id),
        accion: "APROBAR"
      });

      assert.equal(aprobada.estado, "APROBADA");
      assert.equal(String(aprobada.aprobadaPor), String(usuarioId));

      const auditorias = await Auditoria.countDocuments({
        empresaId: empresa._id,
        decisionId: decisionGuardada._id,
        ordenId: orden._id,
        accion: "APROBAR",
        usuarioId
      });
      assert.equal(auditorias, 1);

      const memorias = await Memoria.countDocuments({
        empresaId: empresa._id,
        decisionId: decisionGuardada._id,
        ordenId: orden._id,
        resultado: "PENDIENTE",
        createdBy: usuarioId
      });
      assert.equal(memorias, 1);

      await Memoria.updateOne(
        {
          empresaId: empresa._id,
          decisionId: decisionGuardada._id,
          ordenId: orden._id
        },
        { $set: { evaluarAt: new Date(0) } }
      );

      const evaluadas = await evaluarPendientes(new Date());
      assert.equal(evaluadas.length, 1);
      assert.equal(evaluadas[0].resultado, "SIN_CAMBIO");

      const historial = await obtenerAuditoria(authDueno, 100);
      const accionesHistorial = new Set(historial.map((evento) => evento.accion));
      assert.ok(accionesHistorial.has("APROBAR"));
      assert.ok(accionesHistorial.has("JUNTA_ABIERTA"));
      assert.ok(accionesHistorial.has("JUNTA_INTERVENCION"));
      assert.ok(accionesHistorial.has("JUNTA_CERRADA"));
      assert.ok(accionesHistorial.has("MEMORIA_EVALUADA"));

      const empresaActualizada = await Empresa.findById(empresa._id).lean();
      assert.equal(empresaActualizada.modulos.gente, true);
      assert.equal(empresaActualizada.modulos.servicio_cliente, false);
    } finally {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.db.dropDatabase();
      }
      await mongoose.disconnect();
    }
  }
);
