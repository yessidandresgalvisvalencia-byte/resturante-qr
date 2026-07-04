const express = require("express");
const router = express.Router();
const MensajeLaboral = require("../models/MensajeLaboral");

// ENVIAR MENSAJE
router.post("/", async (req, res) => {
  try {
    const mensaje = await MensajeLaboral.create(req.body);

    const io = req.app.get("io");

    if (io) {
      io.to(`laboral-${mensaje.restaurantId}`).emit("laboral:mensaje:nuevo", mensaje);
    }

    res.json({
      ok: true,
      mensaje: "Mensaje enviado correctamente.",
      data: mensaje
    });

  } catch (error) {
    console.error("Error enviando mensaje laboral:", error);

    res.status(500).json({
      ok: false,
      mensaje: "Error interno enviando mensaje."
    });
  }
});

// LISTAR MENSAJES GENERALES
router.get("/general/:restaurantId", async (req, res) => {
  try {
    const mensajes = await MensajeLaboral.find({
      restaurantId: req.params.restaurantId,
      tipoChat: "general"
    }).sort({ createdAt: 1 }).limit(100);

    res.json({
      ok: true,
      mensajes
    });

  } catch (error) {
    console.error("Error listando mensajes generales:", error);

    res.status(500).json({
      ok: false,
      mensaje: "Error interno listando mensajes."
    });
  }
});

// LISTAR CHAT PRIVADO ENTRE DOS USUARIOS
router.get("/privado/:restaurantId/:usuarioA/:usuarioB", async (req, res) => {
  try {
    const { restaurantId, usuarioA, usuarioB } = req.params;

    const mensajes = await MensajeLaboral.find({
      restaurantId,
      tipoChat: "privado",
      $or: [
        { remitenteId: usuarioA, destinatarioId: usuarioB },
        { remitenteId: usuarioB, destinatarioId: usuarioA }
      ]
    }).sort({ createdAt: 1 }).limit(100);

    res.json({
      ok: true,
      mensajes
    });

  } catch (error) {
    console.error("Error listando chat privado:", error);

    res.status(500).json({
      ok: false,
      mensaje: "Error interno listando chat privado."
    });
  }
});

module.exports = router;