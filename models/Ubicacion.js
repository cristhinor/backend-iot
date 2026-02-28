const mongoose = require("mongoose");

const ubicacionSchema = new mongoose.Schema({
  latitud: { type: Number, required: true },
  longitud: { type: Number, required: true },
  fecha: { type: String, default: "" },
  hora: { type: String, default: "" },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Ubicacion", ubicacionSchema);