require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const mqtt = require("mqtt");
const cors = require("cors");

const Consumo = require("./models/Consumo");
const Ubicacion = require("./models/Ubicacion");
const Viaje = require("./models/Viaje");

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
let sseClients = [];

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

  // Guardar clientes SSE conectados
  app.get("/api/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    sseClients.push(res);
    console.log("📡 Cliente SSE conectado, total:", sseClients.length);

    req.on("close", () => {
      sseClients = sseClients.filter(c => c !== res);
      console.log("📡 Cliente SSE desconectado, total:", sseClients.length);
    });
  });

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
  
    // Avisar a todos los clientes SSE del nuevo estado
    const evento = JSON.stringify({ tipo: "led", estado });
    sseClients.forEach(client => client.write(`data: ${evento}\n\n`));

    res.json({ mensaje: "Comando enviado correctamente" });
  });

  // Obtener últimas 100 ubicaciones para la ruta
app.get("/api/ubicaciones", async (req, res) => {
  try {
    const ubicaciones = await Ubicacion.find()
      .sort({ timestamp: -1 })
      .limit(100);
    res.json(ubicaciones.reverse());
  } catch (error) {
    res.status(500).json({ error: "Error obteniendo ubicaciones" });
  }
});

// Agregar ubicación simulada (para pruebas)
app.post("/api/ubicaciones", async (req, res) => {
  try {
    const { latitud, longitud } = req.body;
    const nueva = new Ubicacion({ latitud, longitud });
    await nueva.save();
    
    // Empujar por SSE
    const evento = JSON.stringify({ tipo: "ubicacion", latitud, longitud, timestamp: new Date() });
    sseClients.forEach(client => client.write(`data: ${evento}\n\n`));
    
    res.json({ mensaje: "Ubicación guardada" });
  } catch (error) {
    res.status(500).json({ error: "Error guardando ubicación" });
  }
});

app.get("/api/ubicaciones/rango", async (req, res) => {
  try {
    const { inicio, fin } = req.query;
    const inicioUTC = new Date(new Date(inicio).getTime() + 5 * 60 * 60 * 1000);
    const finUTC = new Date(new Date(fin).getTime() + 5 * 60 * 60 * 1000);

    const ubicaciones = await Ubicacion.find({
      timestamp: { $gte: inicioUTC, $lte: finUTC }
    }).sort({ timestamp: 1 });

    res.json(ubicaciones);
  } catch (error) {
    res.status(500).json({ error: "Error obteniendo rango GPS" });
  }
});

// Iniciar viaje
app.post("/api/viaje/iniciar", async (req, res) => {
  try {
    const { latitud, longitud, fecha, hora } = req.body;
    const viaje = new Viaje({
      inicio: { latitud, longitud, fecha, hora }
    });
    await viaje.save();
    console.log("🚗 Viaje iniciado");
    res.json({ mensaje: "Viaje iniciado", id: viaje._id });
  } catch (error) {
    res.status(500).json({ error: "Error iniciando viaje" });
  }
});

// Terminar viaje
app.post("/api/viaje/terminar", async (req, res) => {
  try {
    const { id, latitud, longitud, fecha, hora } = req.body;
    const viaje = await Viaje.findByIdAndUpdate(id, {
      fin: { latitud, longitud, fecha, hora, timestamp: new Date() },
      completado: true
    }, { new: true });
    console.log("🏁 Viaje terminado");
    res.json({ mensaje: "Viaje terminado", viaje });
  } catch (error) {
    res.status(500).json({ error: "Error terminando viaje" });
  }
});

// Obtener último dato GPS del ESP32
app.get("/api/gps/ultimo", async (req, res) => {
  try {
    const ultimo = await Ubicacion.findOne().sort({ timestamp: -1 });
    if (!ultimo) return res.status(404).json({ error: "Sin datos GPS" });
    res.json(ultimo);
  } catch (error) {
    res.status(500).json({ error: "Error obteniendo GPS" });
  }
});

// Descargar viajes en CSV
app.get("/api/viajes/csv", async (req, res) => {
  try {
    const viajes = await Viaje.find({ completado: true }).sort({ "inicio.timestamp": -1 });
    
    let csv = "Inicio Fecha,Inicio Hora,Inicio Lat,Inicio Lng,Fin Fecha,Fin Hora,Fin Lat,Fin Lng\n";
    viajes.forEach(v => {
      csv += `${v.inicio.fecha},${v.inicio.hora},${v.inicio.latitud},${v.inicio.longitud},`;
      csv += `${v.fin.fecha},${v.fin.hora},${v.fin.latitud},${v.fin.longitud}\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=viajes.csv");
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: "Error generando CSV" });
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

    mqttClient.subscribe("casa/led_estado", (err) => {
      if (err) {
        console.error("❌ Error al suscribirse a led_estado:", err);
      } else {
        console.log("📡 Suscrito a casa/led_estado");
      }
    });

    mqttClient.subscribe("casa/gps");

  });

  mqttClient.on("message", async (topic, message) => {
  const msg = message.toString();

  if (topic === "casa/led_estado") {
    estadoLEDActual = msg;
    const evento = JSON.stringify({ tipo: "led_confirmado", estado: msg });
    sseClients.forEach(client => client.write(`data: ${evento}\n\n`));
    return;
  }

  if (topic === "casa/consumo") {
    try {
      const valor = parseFloat(msg);
      const nuevoConsumo = new Consumo({ valor });
      await nuevoConsumo.save();
      console.log("📦 Consumo guardado:", valor);
      const evento = JSON.stringify({ valor, timestamp: new Date() });
      sseClients.forEach(client => client.write(`data: ${evento}\n\n`));
    } catch (error) {
      console.error("❌ Error guardando consumo:", error);
    }
  }

  if (topic === "casa/gps") {
  try {
    const { latitud, longitud, fecha, hora } = JSON.parse(msg);
    const nueva = new Ubicacion({ latitud, longitud, fecha, hora });
    await nueva.save();
    const evento = JSON.stringify({ tipo: "ubicacion", latitud, longitud, fecha, hora, timestamp: new Date() });
    sseClients.forEach(client => client.write(`data: ${evento}\n\n`));
  } catch (error) {
    console.error("❌ Error guardando GPS:", error);
  }
  return;
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