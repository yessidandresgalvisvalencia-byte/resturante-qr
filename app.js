const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const eventBus = require("./core/eventos/eventBus");
const { registrarFinanzasListener } = require("./intelligence/listeners/finanzas.listener");
const { registrarCajaListener } = require("./intelligence/listeners/caja.listener");
const { registrarJuntaVivaListener } = require("./intelligence/listeners/juntaViva.listener");
const { registrarAgendaFinancieraListener } = require("./intelligence/listeners/agendaFinanciera.listener");
const estadisticasRoutes = require("./routes/estadisticas");
const restaurantRoutes = require("./routes/restaurants");
const facturacionRoutes = require("./routes/facturacion");
const facturacionCoreRoutes = require("./core/facturacion/facturacion.routes");
const { registrarFacturacionListener } = require("./core/facturacion/facturacion.listener");
const laboralRoutes = require("./routes/laboral");
const gastosRoutes = require("./routes/gastos");
const finanzasRoutes = require("./routes/finanzas");
const productosServiciosRoutes = require("./routes/productosServicios");
const comprasRoutes = require("./routes/compras");
const cerebroRoutes = require("./routes/cerebro");
const juntaRoutes = require("./routes/junta");
const memoriaRoutes = require("./routes/memoria");
const tesoreriaRoutes = require("./routes/tesoreria");
const configuracionInteligenciaRoutes = require("./routes/configuracionInteligencia");
const ejecutivoRoutes = require("./routes/ejecutivo");
const iniciarCerebroJob = require("./shared/jobs/cerebro.job");
const iniciarCajaJob = require("./shared/jobs/caja.job");
const iniciarMemoriaJob = require("./shared/jobs/memoria.job");
const app = express();
app.disable("x-powered-by");
const { securityHeaders, noStore } = require("./core/security/httpSecurity.middleware");
const rateLimit = require("./core/security/rateLimit.middleware");
app.set("trust proxy", 1);
app.use(securityHeaders);
app.use("/api", noStore, rateLimit({ windowMs: 60 * 1000, max: 180 }));
app.use(express.json({ limit: "1mb", strict: true }));
app.use(express.urlencoded({ extended: false, limit: "256kb", parameterLimit: 200 }));
const inventarioRoutes =
require("./routes/inventario");
const recetasRoutes = require("./routes/recetas");
app.use("/api/recetas", recetasRoutes);
const mensajesLaboralRoutes = require("./routes/mensajesLaboral");

const iniciarJobSuscripciones = require("./jobs/suscripciones");
const apiRoutes = require("./routes/API");

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

const io = new Server(server, { maxHttpBufferSize: 1e6, cors: { origin: false } });

app.set("io", io);

registrarCajaListener();
registrarFinanzasListener();
registrarAgendaFinancieraListener();
registrarJuntaVivaListener();
registrarFacturacionListener();
eventBus.on("VENTA_COMPLETADA", (event) => {
  console.log(
    "[GRUK EVENT] VENTA_COMPLETADA",
    {
      ventaId: event.payload.ventaId?.toString(),
      empresaId: event.payload.empresaId?.toString(),
      sedeId: event.payload.sedeId?.toString() || null,
      total: event.payload.total,
      occurredAt: event.occurredAt
    }
  );
});

app.use(express.static("public"));
app.use("/estadisticas", estadisticasRoutes);
app.use("/api/restaurants", restaurantRoutes);
app.use("/api/facturacion", facturacionRoutes); // legado: no retirar aún
app.use("/api/facturacion-v2", facturacionCoreRoutes);
app.use("/api/gastos", gastosRoutes);
app.use("/api/finanzas", finanzasRoutes);
app.use("/api/productos-servicios", productosServiciosRoutes);
app.use("/api/compras", comprasRoutes);
app.use("/api/cerebro", cerebroRoutes);
app.use("/api/junta", juntaRoutes);
app.use("/api/memoria", memoriaRoutes);
app.use("/api/tesoreria", tesoreriaRoutes);
app.use("/api/configuracion-inteligencia", configuracionInteligenciaRoutes);
app.use("/api/ejecutivo", ejecutivoRoutes);
app.use("/api", apiRoutes);
app.use(
"/api/inventario",
inventarioRoutes
);
app.use("/laboral/mensajes", mensajesLaboralRoutes);
app.use("/laboral", laboralRoutes);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/pago-suscripcion.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "pago-suscripcion.html"));
});

app.get("/pago-suscripcion", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "pago-suscripcion.html"));
});

console.log("MONGO_URI EXISTE", !!process.env.MONGO_URI);
mongoose.connection.once("open", () => {
  console.log("GRUK MongoDB:", {
    host: mongoose.connection.host,
    db: mongoose.connection.name
  });
});
async function iniciarAplicacion() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI no configurado");
    process.exit(1);
  }

  try {
    await mongoose.connect(
      process.env.MONGO_URI,
      process.env.MONGO_DB
        ? { dbName: process.env.MONGO_DB }
        : {}
    );

    console.log("MongoDB conectado");

    iniciarJobSuscripciones();
    iniciarCajaJob();
    iniciarCerebroJob();
    iniciarMemoriaJob();

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
    });
  } catch (err) {
    console.error("Error MongoDB:", err.message);
    process.exit(1);
  }
}

io.on("connection", (socket) => {
  // Los canales sensibles requieren autenticación antes de habilitar suscripciones.
  socket.on("laboral:unirse", () => {
    socket.emit("security:error", { error: "Canal laboral requiere autenticación" });
  });
});

iniciarAplicacion();