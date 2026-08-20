require("dotenv").config();

const mongoose = require("mongoose");

const Empresa = require("../models/Empresa");
const Restaurante = require("../models/restaurante");
const Sede = require("../models/sede");
const Usuario = require("../models/usuario");

async function migrarEmpresas() {
  try {
    console.log("Iniciando migración GRUK → Empresa...");

    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB conectado");

    // Solo restaurantes que todavía no tienen empresa asociada
    const restaurantes = await Restaurante.find({
      $or: [
        { empresaId: { $exists: false } },
        { empresaId: null }
      ]
    });

    console.log(
      `Restaurantes pendientes de migración: ${restaurantes.length}`
    );
    

    let migrados = 0;
    let errores = 0;

    for (const restaurante of restaurantes) {
      try {
        console.log(
          `Migrando: ${restaurante.nombreRestaurante} (${restaurante.restaurantId})`
        );

        const empresa = await Empresa.create({
          empresaId: `emp_${restaurante.restaurantId}`,

          nombre:
            restaurante.nombreRestaurante ||
            restaurante.restaurantId,

          tipoNegocio: "restaurante",

          correo:
            restaurante.correo ||
            `sin-correo-${restaurante.restaurantId}@gruk.local`,

          estado: "activa",

          modulos: {
            restaurante: true,
            inventario: true,
            finanzas: true,
            facturacion: true,
            laboral: true,
            inteligencia: false
          }
        });

        // Vincular restaurante
        restaurante.empresaId = empresa._id;
        await restaurante.save();

        // Vincular todas sus sedes
        const resultadoSedes = await Sede.updateMany(
          {
            restauranteId: restaurante.restaurantId
          },
          {
            $set: {
              empresaId: empresa._id
            }
          }
        );

        // Vincular todos sus usuarios
        const resultadoUsuarios = await Usuario.updateMany(
          {
            restauranteId: restaurante.restaurantId
          },
          {
            $set: {
              empresaId: empresa._id
            }
          }
        );

        console.log(
          `OK | Sedes: ${resultadoSedes.modifiedCount} | Usuarios: ${resultadoUsuarios.modifiedCount}`
        );

        migrados++;

      } catch (error) {
        errores++;

        console.error(
          `ERROR migrando ${restaurante.restaurantId}:`,
          error.message
        );
      }
    }

    console.log("");
    console.log("===== MIGRACIÓN TERMINADA =====");
    console.log(`Migrados correctamente: ${migrados}`);
    console.log(`Errores: ${errores}`);

  } catch (error) {
    console.error("ERROR GENERAL:", error);

  } finally {
    await mongoose.disconnect();
    console.log("MongoDB desconectado");
  }
}

migrarEmpresas();