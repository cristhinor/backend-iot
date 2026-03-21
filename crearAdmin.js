require("dotenv").config();
const mongoose = require("mongoose");
const Usuario = require("./models/Usuario");

async function crearAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Conectado a MongoDB");

    const admin = new Usuario({
      nombre: "Cristhian",
      email: "admin@iot.com",
      password: "Admin2026*",
      rol: "admin"
    });

    await admin.save();
    console.log("✅ Admin creado correctamente");
    console.log("Email:", admin.email);
    console.log("Rol:", admin.rol);

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    mongoose.disconnect();
  }
}

crearAdmin();