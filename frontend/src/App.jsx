import { useEffect, useState } from "react";

function App() {
  const [graph, setGraph] = useState(null);

  useEffect(() => {
    fetch("http://localhost:5000/graph")
      .then((res) => res.json())
      .then((data) => setGraph(data));
  }, []);

  return (
    <div>
      <h1>TERMINUS ⚡</h1>

      {graph && (
        <>
          <h2>Nodes:</h2>
          <p>[{graph.nodes.map(node => node.id).join(", ")}]</p>

          <h2>Edges:</h2>
          <p>{graph.edges.map(edge => edge.id).join(", ")}</p>
        </>
      )}
    </div>
  );
}

export default App;