require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();
app.use(express.static("public"));
app.use(cors());
app.use(express.json());

const mqtt = require("mqtt");
const mongoose = require("mongoose");

// Conectar a MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("🟢 MongoDB conectado"))
  .catch(err => console.error("Error MongoDB:", err));

// Esquema de datos
const consumoSchema = new mongoose.Schema({
  valor: Number,
  fecha: { type: Date, default: Date.now }
});

const Consumo = mongoose.model("Consumo", consumoSchema);

app.get("/api/consumos", async (req, res) => {
  const datos = await Consumo.find()
    .sort({ fecha: -1 })  // más recientes primero
    .limit(15);           // solo envía los últimos 15 datos al dashboard

  res.json(datos.reverse()); // volver a orden ascendente para la gráfica
});

// Conexión MQTT
const client = mqtt.connect({
  host: "816ed507f62b44af8b039c313433755e.s1.eu.hivemq.cloud",
  port: 8883,
  protocol: "mqtts",
  username: "admin-cris",
  password: "11Ismyreligion",
  rejectUnauthorized: false
});

client.on("connect", () => {
  console.log("🟢 Conectado a MQTT");
  client.subscribe("casa/consumo");
});

client.on("message", async (topic, message) => {
  if (topic === "casa/consumo") {
    const valor = parseFloat(message.toString());

    const nuevoDato = new Consumo({ valor });
    await nuevoDato.save();

    console.log("📥 Dato guardado:", valor);
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 API corriendo en puerto ${PORT}`);
});

app.get("/api/consumos/rango", async (req, res) => {
  try {
    const { inicio, fin } = req.query;

    const fechaInicio = new Date(inicio);
    const fechaFin = new Date(fin);

    const datos = await Consumo.find({
      fecha: {
        $gte: fechaInicio,
        $lte: fechaFin
      }
    }).sort({ fecha: 1 });

    res.json(datos);
  } catch (error) {
    res.status(500).json({ error: "Error filtrando datos" });
  }
});