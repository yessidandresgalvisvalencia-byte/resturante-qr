require("dotenv").config();
const { MongoClient } = require("mongodb");

async function probar() {
  try {
    console.log("URI existe:", !!process.env.MONGO_URI);

    const client = new MongoClient(process.env.MONGO_URI);
    await client.connect();

    console.log("Conexión directa OK");
    await client.close();
  } catch (error) {
    console.log("Error conexión directa:");
    console.log(error);
  }
}

probar();