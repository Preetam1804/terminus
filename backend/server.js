
require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const baseGraph = require("./data/graph");
let currentGraph = JSON.parse(JSON.stringify(baseGraph));
let activeBaseGraph = JSON.parse(JSON.stringify(baseGraph));
let simulationRunning = false;
let liveIntervalId = null;
const { failEdge, failNode } = require("./engine/failureEngine");

const app = express();
const server = http.createServer(app);

// ── Socket.io ────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// ── Middleware ───────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── MongoDB Connection ───────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI is not defined in .env file");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err.message));

// ── Routes ───────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ message: "Terminus server is running 🚀" });
}); 

app.get("/status", (req, res) => {
  res.json({ simulationRunning });
});

app.get("/reset", (req, res) => {
  currentGraph = JSON.parse(JSON.stringify(activeBaseGraph));
  simulationRunning = false;
  if (liveIntervalId) {
    clearInterval(liveIntervalId);
    liveIntervalId = null;
  }
  res.json({
    message: "System reset successful",
    graph: currentGraph
  });
});

app.get("/test", (req, res) => {
  res.json({ message: "API working properly 🚀" });
});

app.get("/graph", (req, res) => {
  res.json(currentGraph);
});

// ── User-built graph store (MongoDB) ────────────────────────────
const GraphModel = require("./models/Graph");

// POST /graph — validate and save a user-built graph, also set as currentGraph
app.post("/graph", async (req, res) => {
  const graph = req.body;

  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    return res.status(400).json({ error: "Invalid graph: nodes and edges arrays required" });
  }
  if (graph.nodes.length === 0) {
    return res.status(400).json({ error: "Graph must have at least one node" });
  }

  const nodeIds = new Set(graph.nodes.map(n => n.id));

  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      return res.status(400).json({ error: `Edge ${edge.id} references missing node` });
    }
    if (!edge.capacity || edge.capacity <= 0) {
      return res.status(400).json({ error: `Edge ${edge.id}: capacity must be > 0` });
    }
    if (edge.load < 0) {
      return res.status(400).json({ error: `Edge ${edge.id}: load must be >= 0` });
    }
  }

  try {
    const toSave = {
      name: graph.name || `Graph ${Date.now()}`,
      nodes: graph.nodes,
      edges: graph.edges.map(e => ({
        ...e,
        overloadTime: e.overloadTime ?? 0,
        threshold:    e.threshold    ?? 3,
        status:       "normal",
      })),
    };

    let newGraph;
    if (graph.id) {
      newGraph = await GraphModel.findByIdAndUpdate(graph.id, toSave, { new: true });
      if (!newGraph) newGraph = await GraphModel.create(toSave);
    } else {
      newGraph = await GraphModel.create(toSave);
    }
    
    // Clean up Mongoose document for currentGraph
    const plainGraph = newGraph.toObject();
    
    // Make it the active graph for simulation
    activeBaseGraph = JSON.parse(JSON.stringify(plainGraph));
    currentGraph = JSON.parse(JSON.stringify(plainGraph));

    res.json({ message: "Graph saved successfully", id: newGraph._id, graph: currentGraph });
  } catch (error) {
    res.status(500).json({ error: "Failed to save graph to DB" });
  }
});

// GET /graph/:id — load a saved user graph
app.get("/graph/:id", async (req, res) => {
  try {
    const g = await GraphModel.findById(req.params.id);
    if (!g) return res.status(404).json({ error: "Graph not found" });
    res.json(g);
  } catch (error) {
    res.status(500).json({ error: "Invalid graph ID" });
  }
});

// DELETE /graph/:id — delete a saved user graph
app.delete("/graph/:id", async (req, res) => {
  try {
    await GraphModel.findByIdAndDelete(req.params.id);
    res.json({ message: "Graph deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete graph" });
  }
});

// GET /graphs — list all saved graphs (name + id)
app.get("/graphs", async (req, res) => {
  try {
    const graphs = await GraphModel.find({}, "name nodes edges createdAt");
    const list = graphs.map(g => ({
      id: g._id,
      name: g.name,
      nodes: g.nodes.length,
      edges: g.edges.length,
    }));
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch graphs" });
  }
});

app.get("/fail-edge/:id", (req, res) => {
  const edgeId = req.params.id;
  try {
    currentGraph = failEdge(currentGraph, edgeId);
    res.json({ success: true, graph: currentGraph });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get("/fail-node/:id", (req, res) => {
  const nodeId = req.params.id;
  try {
    currentGraph = failNode(currentGraph, nodeId);
    res.json({ success: true, graph: currentGraph });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

const { updateStress } = require("./engine/stressEngine");
const { cloneGraph } = require("./utils/graphUtils");
const { redistributeLoad } = require("./engine/loadRedistribution");
const { runCascade, runCascadeLive } = require("./engine/cascadeEngine");

// ── Test Stress Route ───────────────────────────────────────────
app.get("/test-stress", (req, res) => {
  const cloned = cloneGraph(currentGraph);
  // Simulate overload manually
  cloned.edges[0].load = 150; // exceed capacity

  const times = parseInt(req.query.times) || 1;
  let failedEdges = [];
  for (let i = 0; i < times; i++) {
    const failed = updateStress(cloned);
    failedEdges = failedEdges.concat(failed);
  }

  res.json({
    message: `Stress updated ${times} time(s)`,
    firstEdge: cloned.edges[0],
    failedEdges: failedEdges
  });
});

// ── Test Cascade Route ───────────────────────────────────────────
app.get("/test-cascade", (req, res) => {
  const cloned = cloneGraph(currentGraph);
  // Step 1: Fail an edge (simulate failure)
  const failedEdge = cloned.edges.find(e => e.id === "E1");
  cloned.edges = cloned.edges.map(e => e.id === "E1" ? { ...e, status: "failed" } : e);
  // Step 2: Redistribute load
  redistributeLoad(cloned, failedEdge);
  // Step 3: Update stress
  const newFailed = updateStress(cloned);
  res.json({
    message: "Cascade simulation: Failed E1 → Redistributed load → Updated stress",
    edges: cloned.edges,
    failedEdges: newFailed
  });
});

// ── Cascade Simulation Route ───────────────────────────────────────────
app.get("/simulate/:edgeId", (req, res) => {
  const edgeId = req.params.edgeId;
  const result = runCascade(currentGraph, edgeId);
  res.json({
    steps: result
  });
});

// ── Socket.io Events ────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  socket.on("startSimulation", (edgeId) => {
    if (simulationRunning) return;
    simulationRunning = true;

    liveIntervalId = runCascadeLive(currentGraph, edgeId, io, socket, () => {
      simulationRunning = false;
    });
  });

  socket.on("stopSimulation", () => {
    simulationRunning = false;
    if (liveIntervalId) {
      clearInterval(liveIntervalId);
      liveIntervalId = null;
    }
  });

  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.id}`);
  });
});

// ── Start Server ─────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
