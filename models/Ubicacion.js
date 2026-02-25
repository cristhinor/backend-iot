const mongoose = require("mongoose");

const ubicacionSchema = new mongoose.Schema({
  latitud: { type: Number, required: true },
  longitud: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Ubicacion", ubicacionSchema);