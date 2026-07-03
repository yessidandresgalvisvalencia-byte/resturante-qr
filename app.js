const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const estadisticasRoutes = require("./routes/estadisticas");
const restaurantRoutes = require("./routes/restaurants");
const facturacionRoutes = require("./routes/facturacion");
const laboralRoutes = require("./routes/laboral");
const app = express();
const inventarioRoutes =
require("./routes/inventario");
const recetasRoutes = require("./routes/recetas");
app.use("/api/recetas", recetasRoutes);

const iniciarJobSuscripciones = require("./jobs/suscripciones");
const apiRoutes = require("./routes/API");

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

app.set("io", io);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.static("public"));
app.use("/estadisticas", estadisticasRoutes);
app.use("/api/restaurants", restaurantRoutes);
app.use("/api/facturacion", facturacionRoutes);
app.use("/api", apiRoutes);
app.use(
"/api/inventario",
inventarioRoutes
);
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

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB conectado");
  })
  .catch(err => {
    console.log("Error MongoDB:", err);
  });

io.on("connection", (socket) => {
  console.log("Cliente conectado");

  socket.on("disconnect", () => {
    console.log("Cliente desconectado");
  });
});

iniciarJobSuscripciones();

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});