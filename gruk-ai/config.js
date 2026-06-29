module.exports = {
  version: "1.0.0",

  reconocimiento: {
    umbralAceptacion: 0.75,
    modo: process.env.GRUK_FACE_MODE || "evidencia"
  }
};