const path = require("path");
const faceapi = require("@vladmandic/face-api");
const canvas = require("canvas");

const { Canvas, Image, ImageData, loadImage } = canvas;

faceapi.env.monkeyPatch({
  Canvas,
  Image,
  ImageData
});

let modelosCargados = false;

async function cargarModelosGRUK() {
  if (modelosCargados) return;

  const rutaModelos = path.join(__dirname, "models");

  await faceapi.nets.ssdMobilenetv1.loadFromDisk(rutaModelos);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(rutaModelos);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(rutaModelos);

  modelosCargados = true;
  console.log("Modelos faciales GRUK cargados");
}

async function obtenerDescriptorFacialGRUK(imagenBase64) {
  await cargarModelosGRUK();

  const img = await loadImage(imagenBase64);

  const deteccion = await faceapi
    .detectSingleFace(img)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!deteccion) return null;

  return Array.from(deteccion.descriptor);
}

function distanciaFacialGRUK(descriptorA, descriptorB) {
  if (!descriptorA || !descriptorB) return Infinity;

  return faceapi.euclideanDistance(
    new Float32Array(descriptorA),
    new Float32Array(descriptorB)
  );
}

module.exports = {
  obtenerDescriptorFacialGRUK,
  distanciaFacialGRUK
};