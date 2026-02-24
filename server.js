require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const mqtt = require("mqtt");
const cors = require("cors");

const Consumo = require("./models/Consumo");

const app = express();
const PORT = process.env.PORT || 3000;

/* ===============================
   🔐 CORS
================================ */

app.use(cors({
  origin: "https://frontend-iot-3xgs.onrender.com"
}));

app.use(express.json());

/* ===============================
   🔥 VARIABLE GLOBAL MQTT
================================ */

let mqttClient;
let estadoLEDActual = "OFF";

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

    iniciarMQTT();
    iniciarServidor();

  } catch (error) {
    console.error("❌ Error conectando a MongoDB:", error);
    process.exit(1);
  }
}

/* ===============================
   🚀 SERVIDOR EXPRESS
================================ */

function iniciarServidor() {

  app.get("/", (req, res) => {
    res.send("Backend IoT funcionando correctamente 🚀");
  });

  app.get("/api/consumos", async (req, res) => {
    try {
      const consumos = await Consumo.find()
        .sort({ timestamp: -1 })
        .limit(50);

      res.json(consumos);

    } catch (error) {
      res.status(500).json({ error: "Error obteniendo consumos" });
    }
  });

  app.get("/api/consumos/rango", async (req, res) => {
    try {
      const { inicio, fin } = req.query;

      const inicioUTC = new Date(new Date(inicio).getTime() + 5 * 60 * 60 * 1000);
      const finUTC = new Date(new Date(fin).getTime() + 5 * 60 * 60 * 1000);

      const consumos = await Consumo.find({
        timestamp: {
          $gte: inicioUTC,
          $lte: finUTC
        }
      }).sort({ timestamp: 1 });

      res.json(consumos);

    } catch (error) {
      res.status(500).json({ error: "Error obteniendo rango" });
    }
  });

  /* ===============================
     🔥 ENDPOINT PARA LED
  ================================= */
//ENDPOINT PARA CONSULTAR ESTADO DEL LED
  app.get("/api/led", (req, res) => {
    res.json({ estado: estadoLEDActual });
  });
//ENDPOINT PARA CAMBIAR ESTADO DEL LED
  app.post("/api/led", (req, res) => {
    const { estado } = req.body;

    if (!mqttClient) {
      return res.status(500).json({ error: "MQTT no conectado" });
    }

    mqttClient.publish("casa/led", estado);
    estadoLEDActual = estado; // guardamos estado actual
    console.log("💡 Comando LED enviado:", estado);
    res.json({ mensaje: "Comando enviado correctamente" });
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

  mqttClient = mqtt.connect(brokerUrl, {
    username: process.env.MQTT_USER,
    password: process.env.MQTT_PASS,
    reconnectPeriod: 5000,
  });

  mqttClient.on("connect", () => {
    console.log("🟢 Conectado a MQTT");

    mqttClient.subscribe("casa/consumo", (err) => {
      if (err) {
        console.error("❌ Error al suscribirse:", err);
      } else {
        console.log("📡 Suscrito a casa/consumo");
      }
    });
  });

  mqttClient.on("message", async (topic, message) => {
    try {
      const valor = parseFloat(message.toString());

      const nuevoConsumo = new Consumo({ valor });
      await nuevoConsumo.save();

      console.log("📦 Consumo guardado:", valor);

    } catch (error) {
      console.error("❌ Error guardando consumo:", error);
    }
  });

  mqttClient.on("error", (err) => {
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