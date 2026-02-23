const mongoose = require("mongoose");

const consumoSchema = new mongoose.Schema({
  valor: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Consumo", consumoSchema);