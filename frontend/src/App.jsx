import { useEffect, useState, useCallback } from "react";
import Graph from "./components/Graph";
import GraphBuilder from "./components/GraphBuilder";
import socket from "./socket";

const API = "http://localhost:5001";

function App() {
  const [graph,        setGraph]        = useState(null);
  const [status,       setStatus]       = useState("loading");
  const [simulating,   setSimulating]   = useState(false);
  const [socketOk,     setSocketOk]     = useState(false);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [cascadeCount, setCascadeCount] = useState(0);
  const [stepCount,    setStepCount]    = useState(0);
  const [stepData,     setStepData]     = useState({ prevEdges: null, currentEdges: null });
  const [buildMode,    setBuildMode]    = useState(false);  // ← Graph Builder

  // ── Socket connection ────────────────────────────────────────
  useEffect(() => {
    const onConnect    = () => setSocketOk(true);
    const onDisconnect = () => setSocketOk(false);
    socket.on("connect",    onConnect);
    socket.on("disconnect", onDisconnect);
    if (socket.connected) setSocketOk(true);
    return () => {
      socket.off("connect",    onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  // ── Simulation events ────────────────────────────────────────
  useEffect(() => {
    const onStep = ({ step, graph: g }) => {
      setStepCount(step + 1);
      setStepData(prev => ({
        prevEdges: step === 0 ? prev.prevEdges : prev.currentEdges,
        currentEdges: g.edges
      }));
    };
    const onEnd  = ()         => {
      setSimulating(false);
      setCascadeCount(c => c + 1);
    };
    socket.on("simulationStep", onStep);
    socket.on("simulationEnd",  onEnd);
    return () => {
      socket.off("simulationStep", onStep);
      socket.off("simulationEnd",  onEnd);
    };
  }, []);

  // ── Fetch graph ───────────────────────────────────────────────
  const fetchGraph = useCallback(() => {
    setStatus("loading");
    fetch(`${API}/graph`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        const parsedEdges = data.edges.map(e => ({ ...e, source: e.from, target: e.to }));
        setGraph({
          nodes: data.nodes,
          edges: parsedEdges,
        });
        setStepData({ prevEdges: parsedEdges, currentEdges: parsedEdges });
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }, []);

  useEffect(() => { fetchGraph(); }, [fetchGraph]);

  // ── Controls ──────────────────────────────────────────────────
  const handleStop = () => {
    socket.emit("stopSimulation");
    setSimulating(false);
  };

  const handleReset = () => {
    socket.emit("stopSimulation");
    setSimulating(false);
    setSelectedEdge(null);
    setStepCount(0);
    fetch(`${API}/reset`)
      .then(res => res.json())
      .then(() => fetchGraph())
      .catch(() => {});
  };

  // ── Called when builder saves → use the new graph immediately
  const handleBuilderSaved = (savedGraph) => {
    const parsedEdges = savedGraph.edges.map(e => ({ ...e, source: e.from, target: e.to }));
    setGraph({
      nodes: savedGraph.nodes,
      edges: parsedEdges,
    });
    setStepData({ prevEdges: parsedEdges, currentEdges: parsedEdges });
    setStatus("ok");
    setSelectedEdge(null);
    setStepCount(0);
    setBuildMode(false);      // close builder
  };

  const nodeCount = graph?.nodes.length ?? 0;
  const edgeCount = graph?.edges.length ?? 0;

  return (
    <div className="app-shell">

      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="header">
        <div className="logo">
          <div className="logo-icon">⚡</div>
          <div className="logo-text">TERMIN<span>US</span></div>
          <div className="logo-sub">Network Cascade Simulator</div>
        </div>

        <div className="header-center">
          {simulating ? (
            <div className="sim-banner">
              <div className="sim-pulse" />
              Cascade propagating
            </div>
          ) : (
            <div className="idle-hint">
              Click any <strong>edge</strong> on the graph to trigger a cascade failure ⚡
            </div>
          )}
        </div>

        <div className="header-right">
          {/* Build Graph toggle */}
          <button
            id="btn-build"
            className={`btn btn-build ${buildMode ? "active" : ""}`}
            onClick={() => {
              if (!buildMode) {
                socket.emit("stopSimulation");
                setSimulating(false);
                setSelectedEdge(null);
                setStepCount(0);
              }
              setBuildMode(b => !b);
            }}
            title="Open the interactive graph builder"
          >
            {buildMode ? "✕ Close Builder" : "🔧 Build Graph"}
          </button>

          <div className="header-status">
            <div className={`status-dot ${socketOk ? "" : "error"}`} />
            <span>{socketOk ? "Connected" : "Disconnected"}</span>
          </div>
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────────── */}
      <div className="main-content">

        {/* ── Graph canvas ─────────────────────────────────────── */}
        <section className="graph-canvas">
          {status === "loading" && (
            <div className="center-overlay">
              <div className="spinner" />
              <span>Fetching network graph…</span>
            </div>
          )}

          {status === "error" && (
            <div className="center-overlay">
              <div className="error-icon">⚠️</div>
              <span>Could not reach <strong>localhost:5001/graph</strong></span>
              <span style={{ fontSize: 12, color: "#3b4560" }}>
                Run <code style={{ background: "#161b27", padding: "2px 6px", borderRadius: 4 }}>
                  node server.js
                </code> in the backend folder
              </span>
            </div>
          )}

          {status === "ok" && graph && (
            <Graph
              key={graph._id || JSON.stringify(graph.nodes.map(n => n.id))}
              graph={graph}
              setGraph={setGraph}
              onSimulating={setSimulating}
              setSelectedEdge={setSelectedEdge}
              selectedEdge={selectedEdge}
            />
          )}
        </section>

        {/* ── Right sidebar ────────────────────────────────────── */}
        <aside className="sidebar">

          {/* Controls */}
          <div className="sidebar-section">
            <div className="sidebar-label">Controls</div>
            <div className="control-grid">
              <button
                id="btn-stop"
                className={`btn btn-stop btn-wide ${simulating ? "visible" : "hidden-btn"}`}
                disabled={!simulating}
                onClick={handleStop}
                title="Stop running simulation"
              >
                ■ Stop
              </button>

              <button
                id="btn-reset"
                className="btn btn-reset btn-wide"
                onClick={handleReset}
                disabled={simulating}
                title="Reset network to initial state"
              >
                ↺ Reset Network
              </button>
            </div>

            {simulating && (
              <div className="sim-status-pill running">
                <div className="sim-pulse" /> Running ⚡
              </div>
            )}
          </div>

          {/* Network stats */}
          <div className="sidebar-section">
            <div className="sidebar-label">Network</div>
            <div className="stats-row">
              <div className="stat-card">
                <div className="stat-card-label">Nodes</div>
                <div className="stat-card-value accent">{nodeCount}</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">Edges</div>
                <div className="stat-card-value accent">{edgeCount}</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">Runs</div>
                <div className="stat-card-value warning">{cascadeCount}</div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="sidebar-section">
            <div className="sidebar-label">Legend</div>
            <div className="legend-list">
              <div className="legend-item">
                <div className="legend-dot" style={{ background: "#60a5fa" }} />
                <span>Normal</span>
              </div>
              <div className="legend-item">
                <div className="legend-dot" style={{ background: "#f59e0b" }} />
                <span>Near capacity</span>
              </div>
              <div className="legend-item">
                <div className="legend-dot" style={{ background: "#f97316" }} />
                <span>Overloaded</span>
              </div>
              <div className="legend-item">
                <div className="legend-dot legend-dot-dashed" style={{ borderColor: "#ef4444" }} />
                <span>Failed</span>
              </div>
            </div>
          </div>

          {/* Edge Info */}
          <div className="sidebar-section">
            <div className="sidebar-label">Edge Info</div>
            {selectedEdge ? (
              <div className="edge-info-card">
                <div className="edge-info-row">
                  <span className="edge-info-key">ID</span>
                  <span className="edge-info-val accent">{selectedEdge.id}</span>
                </div>
                <div className="edge-info-row">
                  <span className="edge-info-key">Route</span>
                  <span className="edge-info-val">{selectedEdge.from ?? "?"} → {selectedEdge.to ?? "?"}</span>
                </div>
                <div className="edge-info-row">
                  <span className="edge-info-key">Load</span>
                  <span className="edge-info-val">{Math.round(selectedEdge.load ?? 0)}</span>
                </div>
                <div className="edge-info-row">
                  <span className="edge-info-key">Capacity</span>
                  <span className="edge-info-val">{selectedEdge.capacity ?? "?"}</span>
                </div>
                <div className="edge-info-row">
                  <span className="edge-info-key">Status</span>
                  <span
                    className="edge-info-val"
                    style={{
                      color:
                        selectedEdge.status === "failed"     ? "#ef4444" :
                        selectedEdge.status === "overloaded" ? "#f97316" :
                        selectedEdge.status === "near"       ? "#f59e0b" : "#60a5fa",
                      fontWeight: 700,
                    }}
                  >
                    {selectedEdge.status ?? "normal"}
                  </span>
                </div>
                {selectedEdge.status !== "failed" && (
                  <button
                    className="btn btn-start edge-trigger-btn"
                    disabled={simulating}
                    onClick={() => {
                      if (simulating) return;
                      setSimulating(true);
                      setStepCount(0);
                      if (graph) setStepData({ prevEdges: graph.edges, currentEdges: graph.edges });
                      socket.emit("startSimulation", selectedEdge.id);
                    }}
                  >
                    ▶ Cascade from {selectedEdge.id}
                  </button>
                )}
              </div>
            ) : (
              <div className="edge-info-empty">
                <div className="edge-info-empty-icon">🔗</div>
                <p>Click an edge on the graph to inspect it</p>
              </div>
            )}
          </div>

          {/* Live Changes */}
          {simulating && stepData.prevEdges && stepData.currentEdges && (
            <div className="sidebar-section">
              <div className="sidebar-label">Load Changes</div>
              <table className="load-changes-table">
                <thead>
                  <tr>
                    <th>Edge</th>
                    <th>Old Load</th>
                    <th>New Load</th>
                  </tr>
                </thead>
                <tbody>
                  {stepData.currentEdges.map(curr => {
                    const prev = stepData.prevEdges.find(e => e.id === curr.id);
                    if (!prev) return null;
                    if (Math.round(prev.load) === Math.round(curr.load)) return null;
                    return (
                      <tr key={curr.id}>
                        <td>{curr.id}</td>
                        <td>{Math.round(prev.load)}</td>
                        <td>{Math.round(curr.load)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* How to use */}
          <div className="sidebar-section sidebar-help">
            <div className="sidebar-label">How to use</div>
            <p className="help-text">
              Click any <strong>edge</strong> in the graph to view its details, then use
              the Edge Info panel to simulate a cascade failure.
            </p>
            <p className="help-text" style={{ marginTop: 8 }}>
              Use <strong>🔧 Build Graph</strong> to design your own network, then
              save it to run a simulation.
            </p>
          </div>

        </aside>
      </div>

      {/* ── Graph Builder overlay ─────────────────────────────────── */}
      {buildMode && (
        <GraphBuilder
          onSaved={handleBuilderSaved}
          onClose={() => setBuildMode(false)}
        />
      )}
    </div>
  );
}

export default App;