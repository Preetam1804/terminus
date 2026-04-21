const { io } = require("socket.io-client");

// Adjust port to 5001 if your server is still on 5001
const socket = io("http://localhost:5001"); 

socket.on("connect", () => {
  console.log("🟢 Connected to server! Socket ID:", socket.id);
  
  console.log("🚀 Emitting 'startSimulation' for Edge E1...");
  socket.emit("startSimulation", "E1");
});

socket.on("simulationStep", (data) => {
  console.log(`\n⏳ ---------- STEP ${data.step} ----------`);
  
  // Extract just the failed/overloaded edges to see the cascade action
  const problematicEdges = data.graph.edges.filter(e => e.status !== "normal").map(e => `${e.id} [${e.status}]`);
  
  console.log(`⚠️ Active Issues:`, problematicEdges.length > 0 ? problematicEdges.join(", ") : "None");
});

socket.on("disconnect", () => {
  console.log("🔴 Disconnected from server.");
});
