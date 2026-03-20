const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");

const app = express();

const iniciarJobSuscripciones = require("./jobs/suscripciones");
const apiRoutes = require("./routes/API");
app.use("/api", apiRoutes);

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

app.set("io", io);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use("/api", apiRoutes);

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