require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const graphData = require("./data/graph");

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

app.get("/test", (req, res) => {
  res.json({ message: "API working properly 🚀" });
});

app.get("/graph", (req, res) => {
  res.json(graphData);
});

app.get("/test", (req, res) => {
  res.json({ message: "API working properly 🚀" });
});

// ── Socket.io Events ────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.id}`);
  });
});

// ── Start Server ─────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});