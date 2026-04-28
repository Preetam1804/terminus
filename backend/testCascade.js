const { runCascade } = require("./engine/cascadeEngine");
const graph = require("./data/graph");

const result = runCascade(graph, "E2");

console.log("Steps simulated:", result.length);
result.slice(0, 8).forEach((step, i) => {
  console.log(`--- Step ${i} ---`);
  step.edges.forEach(e => {
    console.log(`  Edge ${e.id} [${e.status}] load: ${e.load.toFixed(1)} / cap: ${e.capacity}`);
  });
});
