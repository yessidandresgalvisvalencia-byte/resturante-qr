require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

app.set("io", io);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public",
    "index.html"));
  });
  app.get("/pago-suscripcion.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "pago-suscripcion.html"));
});

app.get("/pago-suscripcion", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "pago-suscripcion.html"));
});

console.log("MONGO_URI EXISTE", !! process.env.MONGO_URI)

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB conectado")
  })
  .catch(err => {
    console.log("Error MongoDB:", err);
  });

const apiRoutes = require("./routes/PI");
app.use("/api", apiRoutes);

const pagos = require("./routes/pagos");
app.use("/pagos", pagos);

io.on("connection", () => {
  console.log("Cliente conectado");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});