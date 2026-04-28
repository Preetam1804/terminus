const mongoose = require("mongoose");

const NodeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  x: { type: Number },
  y: { type: Number }
});

const EdgeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  from: { type: String, required: true },
  to: { type: String, required: true },
  load: { type: Number, default: 0 },
  capacity: { type: Number, required: true },
  overloadTime: { type: Number, default: 0 },
  threshold: { type: Number, default: 3 },
  status: { type: String, default: "normal" }
});

const GraphSchema = new mongoose.Schema({
  name: { type: String, default: "My Graph" },
  nodes: [NodeSchema],
  edges: [EdgeSchema],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Graph", GraphSchema);
