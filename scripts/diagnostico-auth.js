require("dotenv").config({ quiet: true });

const mongoose = require("mongoose");
const Admin = require("../models/admin");
const Restaurante = require("../models/restaurante");
const Empresa = require("../models/Empresa");

(async () => {
  const srvUri = String(process.env.MONGO_URI || "");
  const resto = srvUri.slice("mongodb+srv://".length);
  const arroba = resto.lastIndexOf("@");
  const credenciales = resto.slice(0, arroba);

  const uriDirecta =
    "mongodb://" +
    credenciales +
    "@" +
    "ac-ydmjvim-shard-00-00.m1heukw.mongodb.net:27017," +
    "ac-ydmjvim-shard-00-01.m1heukw.mongodb.net:27017," +
    "ac-ydmjvim-shard-00-02.m1heukw.mongodb.net:27017/" +
    "restaurante" +
    "?tls=true" +
    "&replicaSet=atlas-4uw6ie-shard-0" +
    "&authSource=admin" +
    "&retryWrites=true" +
    "&w=majority";

  await mongoose.connect(uriDirecta, {
    serverSelectionTimeoutMS: 15000
  });

  const admins = await Admin.find({})
    .select("_id restaurantId usuario")
    .lean();

  const restaurantes = await Restaurante.find({})
    .select(
      "_id restaurantId nombreRestaurante correo usuarioAdmin empresaId"
    )
    .sort({ restaurantId: 1 })
    .lean();

  const empresas = await Empresa.find({})
    .select("_id nombre nombreEmpresa")
    .lean();

  console.log("=== RESUMEN ===");
  console.log({
    admins: admins.length,
    restaurantes: restaurantes.length,
    empresas: empresas.length,
    restaurantesSinEmpresa: restaurantes.filter(
      r => !r.empresaId
    ).length
  });

  console.log("\n=== RESTAURANTES ===");

  console.table(
    restaurantes.map(r => ({
      restaurantId: r.restaurantId || "",
      nombre: r.nombreRestaurante || "",
      usuarioAdmin: r.usuarioAdmin || "",
      empresaId: r.empresaId
        ? String(r.empresaId)
        : "SIN_EMPRESA"
    }))
  );

  console.log("\n=== ADMINS SIN RESTAURANTE ===");

  const restaurantIds = new Set(
    restaurantes.map(r => String(r.restaurantId || ""))
  );

  console.table(
    admins
      .filter(a => !restaurantIds.has(String(a.restaurantId || "")))
      .map(a => ({
        adminId: String(a._id),
        usuario: a.usuario || "",
        restaurantId: a.restaurantId || ""
      }))
  );

  await mongoose.disconnect();

})().catch(async error => {
  console.error("ERROR:", error.message);

  try {
    await mongoose.disconnect();
  } catch (_) {}

  process.exit(1);
});