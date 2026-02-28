const mongoose = require("mongoose");

const viajeSchema = new mongoose.Schema({
  inicio: {
    latitud: Number,
    longitud: Number,
    fecha: String,
    hora: String,
    timestamp: { type: Date, default: Date.now }
  },
  fin: {
    latitud: Number,
    longitud: Number,
    fecha: String,
    hora: String,
    timestamp: Date
  },
  completado: { type: Boolean, default: false }
});

module.exports = mongoose.model("Viaje", viajeSchema);