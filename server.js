require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const mqtt = require("mqtt");

// 🔹 IMPORTA TU MODELO
const Consumo = require("./models/Consumo"); 

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

/* ===============================
   🔥 CONFIGURACIÓN MONGODB
================================ */

mongoose.set("strictQuery", true);

async function conectarMongo() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log("🟢 Conectado a MongoDB");

    iniciarServidor();
    iniciarMQTT();

  } catch (error) {
    console.error("❌ Error conectando a MongoDB:", error);
    process.exit(1); // Si no hay DB, no arranca
  }
}

mongoose.connection.on("disconnected", () => {
  console.error("🔴 MongoDB se desconectó");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ Error en MongoDB:", err);
});

/* ===============================
   🚀 SERVIDOR EXPRESS
================================ */

function iniciarServidor() {
  app.get("/", (req, res) => {
    res.send("Backend IoT funcionando correctamente 🚀");
  });

  // AGREGA ESTO:
  app.get("/api/consumos", async (req, res) => {
    try {
      const consumos = await Consumo.find().sort({ timestamp: -1 }).limit(50);
      res.json(consumos);
    } catch (error) {
      res.status(500).json({ error: "Error obteniendo consumos" });
    }
  });

  app.get("/api/consumos/rango", async (req, res) => {
  try {
    const { inicio, fin } = req.query;
    const consumos = await Consumo.find({
      timestamp: {
        $gte: new Date(inicio),
        $lte: new Date(fin)
      }
    }).sort({ timestamp: 1 });
    res.json(consumos);
  } catch (error) {
    res.status(500).json({ error: "Error obteniendo rango" });
  }
});

  app.listen(PORT, () => {
    console.log(`🚀 API corriendo en puerto ${PORT}`);
  });
}

/* ===============================
   📡 MQTT
================================ */

function iniciarMQTT() {
  const brokerUrl = `mqtts://${process.env.MQTT_HOST}:8883`;
  const client = mqtt.connect(brokerUrl, {
    username: process.env.MQTT_USER,
    password: process.env.MQTT_PASS,
    reconnectPeriod: 5000,
  });

  client.on("connect", () => {
    console.log("🟢 Conectado a MQTT");
    client.subscribe("casa/consumo");
  });

  client.on("message", async (topic, message) => {
    try {
      const valor = parseFloat(message.toString());
      const nuevoConsumo = new Consumo({ valor });
      await nuevoConsumo.save();
      console.log("📦 Consumo guardado:", valor);
    } catch (error) {
      console.error("❌ Error guardando consumo:", error);
    }
  });

  client.on("error", (err) => {
    console.error("❌ Error MQTT:", err);
  });
}

/* ===============================
   🛡 MANEJO GLOBAL DE ERRORES
================================ */

process.on("uncaughtException", (err) => {
  console.error("❌ Error no capturado:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("❌ Promesa no manejada:", err);
});

/* ===============================
   🔥 INICIAR TODO
================================ */

conectarMongo();