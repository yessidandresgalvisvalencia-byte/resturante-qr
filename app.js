const express = require("express")
const mongoose = require("mongoose")
const path = require("path")
const http = require("http")
const { Server } = require("socket.io")

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
    cors: {
        origin: "*"
    }
})

app.set("io", io)

app.use(express.json())
app.use(express.static(path.join(__dirname, "public")))

mongoose.connect("mongodb://127.0.0.1:27017/restaurante")
.then(() => {
    console.log("MongoDB conectado")
})
.catch(err => {
    console.log("Error MongoDB:", err)
})

const apiRoutes = require("./routes/api")
app.use("/api", apiRoutes)

io.on("connection", () => {
    console.log("Cliente conectado")
})

server.listen(3000, "0.0.0.0", () => {
    console.log("Servidor corriendo en puerto 3000")
})