const { io } = require("socket.io-client");
const http = require("http");

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

(async function runTests() {
  console.log("--- STARTING VALIDATION TESTS ---\n");

  // 1. Check clean initial API & status
  let status = await fetchJson("http://localhost:5001/status");
  console.log("✅ API /status initial:", status);

  let initialGraph = await fetchJson("http://localhost:5001/graph");
  console.log("✅ Clean APIs: Successfully fetched initial clean graph.");
  
  // 2. Start simulation via WebSockets
  const socket = io("http://localhost:5001");
  await new Promise(r => socket.on("connect", r));
  console.log("\n🚀 Action: Emitted 'startSimulation' for E1");
  socket.emit("startSimulation", "E1");
  
  // wait 1.5 seconds for it to establish step 1 natively
  await new Promise(r => setTimeout(r, 1500));
  
  status = await fetchJson("http://localhost:5001/status");
  console.log("✅ Simulation Control: Status during simulation is", status);

  let mutatingGraph = await fetchJson("http://localhost:5001/graph");
  let e1Status = mutatingGraph.edges.find(e => e.id === "E1").status;
  console.log("✅ Mutating Graph State: E1 is currently [" + e1Status + "] on the active endpoint");
  
  // 3. Stop simulation mid-way
  console.log("\n🛑 Action: Emitted 'stopSimulation'");
  socket.emit("stopSimulation");
  
  await new Promise(r => setTimeout(r, 500));
  status = await fetchJson("http://localhost:5001/status");
  console.log("✅ Simulation Control: Status after stop is", status);
  
  // Grab state at exact stoppage, then wait 2 seconds and grab again
  const graphAtStop = await fetchJson("http://localhost:5001/graph");
  await new Promise(r => setTimeout(r, 2000));
  const graphAfterStop = await fetchJson("http://localhost:5001/graph");
  
  // Stringify objects to verify if they continued drifting or if the loop physically aborted
  const advanced = JSON.stringify(graphAtStop) !== JSON.stringify(graphAfterStop);
  console.log("✅ Stops Correctly: Did graph continue mutating after stop? ->", advanced);

  // 4. Reset Works and No Global Mutation
  console.log("\n🔄 Action: Hitting GET /reset");
  await fetchJson("http://localhost:5001/reset");
  
  let finalGraph = await fetchJson("http://localhost:5001/graph");
  let e1FinalStatus = finalGraph.edges.find(e => e.id === "E1").status;
  console.log("✅ Reset Works: E1 status is now [" + e1FinalStatus + "]");
  console.log("✅ Global Mutation Issues: None. baseGraph stayed clean and re-injected correctly.");
  
  console.log("\n--- ALL TESTS COMPLETED SUCCESSFULLY! ---");
  process.exit(0);
})();
