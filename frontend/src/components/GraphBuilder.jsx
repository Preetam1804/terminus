import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

const API = "http://localhost:5001";

// ── Preset graphs ──────────────────────────────────────────────────
const PRESETS = {
  ring: {
    name: "Ring Network",
    nodes: [
      { id: "N1", x: 380, y: 140 }, 
      { id: "N2", x: 494, y: 223 }, 
      { id: "N3", x: 451, y: 357 }, 
      { id: "N4", x: 309, y: 357 }, 
      { id: "N5", x: 266, y: 223 }
    ],
    edges: [
      { id: "E1", from: "N1", to: "N2", load: 30, capacity: 100, overloadTime: 0, threshold: 3, status: "normal" },
      { id: "E2", from: "N2", to: "N3", load: 40, capacity: 100, overloadTime: 0, threshold: 3, status: "normal" },
      { id: "E3", from: "N3", to: "N4", load: 50, capacity: 100, overloadTime: 0, threshold: 3, status: "normal" },
      { id: "E4", from: "N4", to: "N5", load: 35, capacity: 100, overloadTime: 0, threshold: 3, status: "normal" },
      { id: "E5", from: "N5", to: "N1", load: 45, capacity: 100, overloadTime: 0, threshold: 3, status: "normal" },
    ],
  },
  star: {
    name: "Star Topology",
    nodes: [
      { id: "HUB", x: 380, y: 260 }, 
      { id: "S1", x: 380, y: 110 }, 
      { id: "S2", x: 530, y: 260 }, 
      { id: "S3", x: 380, y: 410 }, 
      { id: "S4", x: 230, y: 260 }
    ],
    edges: [
      { id: "E1", from: "HUB", to: "S1", load: 60, capacity: 80,  overloadTime: 0, threshold: 3, status: "normal" },
      { id: "E2", from: "HUB", to: "S2", load: 50, capacity: 80,  overloadTime: 0, threshold: 3, status: "normal" },
      { id: "E3", from: "HUB", to: "S3", load: 70, capacity: 80,  overloadTime: 0, threshold: 3, status: "normal" },
      { id: "E4", from: "HUB", to: "S4", load: 40, capacity: 80,  overloadTime: 0, threshold: 3, status: "normal" },
    ],
  },
  mesh: {
    name: "Mesh Network",
    nodes: [
      { id: "A", x: 260, y: 140 }, 
      { id: "B", x: 500, y: 140 }, 
      { id: "C", x: 500, y: 380 }, 
      { id: "D", x: 260, y: 380 }
    ],
    edges: [
      { id: "E1", from: "A", to: "B", load: 50, capacity: 100, overloadTime: 0, threshold: 3, status: "normal" },
      { id: "E2", from: "B", to: "C", load: 70, capacity: 80,  overloadTime: 0, threshold: 3, status: "normal" },
      { id: "E3", from: "C", to: "D", load: 30, capacity: 60,  overloadTime: 0, threshold: 3, status: "normal" },
      { id: "E4", from: "A", to: "D", load: 20, capacity: 50,  overloadTime: 0, threshold: 3, status: "normal" },
      { id: "E5", from: "B", to: "D", load: 40, capacity: 90,  overloadTime: 0, threshold: 3, status: "normal" },
    ],
  },
};

// ── Colors ────────────────────────────────────────────────────────
function nodeColor(selected) {
  return selected ? "#22d3ee" : "#3b82f6";
}

export default function GraphBuilder({ onSaved, onClose }) {
  const containerRef = useRef();
  const svgRef       = useRef(null);
  const simRef       = useRef(null);

  // ── Graph state ───────────────────────────────────────────────
  const [nodes, setNodes]         = useState([]);
  const [edges, setEdges]         = useState([]);
  const [graphName, setGraphName] = useState("My Graph");
  const [savedDbGraphs, setSavedDbGraphs] = useState([]);
  const [loadedGraphId, setLoadedGraphId] = useState(null);

  // ── Build mode sub-states ──────────────────────────────────────
  const [tool, setTool]               = useState("node"); // "node" | "edge" | "delete"
  const [pendingNode, setPendingNode] = useState(null);   // first node clicked for edge
  const [editEdge, setEditEdge]       = useState(null);   // edge being edited

  // ── Refs for D3 (always current) ──────────────────────────────
  const nodesRef      = useRef([]);
  const edgesRef      = useRef([]);
  const toolRef       = useRef("node");
  const pendingRef    = useRef(null);
  const renderRef     = useRef(null);   // imperative re-render fn

  // ── Sync refs ─────────────────────────────────────────────────
  toolRef.current    = tool;
  pendingRef.current = pendingNode;
  nodesRef.current   = nodes;
  edgesRef.current   = edges;

  // ── Status messages ───────────────────────────────────────────
  const [msg, setMsg] = useState({ text: "Click anywhere to add a node", type: "info" });

  function flash(text, type = "info") {
    setMsg({ text, type });
  }

  // ── Load preset ───────────────────────────────────────────────
  function loadPreset(key) {
    const p = PRESETS[key];
    setNodes([...p.nodes]);
    setEdges([...p.edges]);
    setGraphName(p.name);
    setPendingNode(null);
    setLoadedGraphId(null);
    flash(`Loaded preset: ${p.name}`, "info");
  }

  // ── Fetch & Load DB Graphs ────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/graphs`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setSavedDbGraphs(data);
      })
      .catch(() => {});
  }, []);

  async function loadDbGraph(id) {
    try {
      const res = await fetch(`${API}/graph/${id}`);
      if (!res.ok) throw new Error("Load failed");
      const data = await res.json();
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
      setGraphName(data.name || "Loaded Graph");
      setLoadedGraphId(data._id);
      setPendingNode(null);
      flash(`Loaded DB Graph: ${data.name}`, "success");
    } catch {
      flash("Failed to load graph from DB", "error");
    }
  }

  async function deleteDbGraph(id, e) {
    e.stopPropagation();
    try {
      await fetch(`${API}/graph/${id}`, { method: "DELETE" });
      setSavedDbGraphs(prev => prev.filter(g => g.id !== id));
      if (loadedGraphId === id) setLoadedGraphId(null);
      flash("Graph deleted", "info");
    } catch {
      flash("Failed to delete graph", "error");
    }
  }

  // ── Export JSON ───────────────────────────────────────────────
  function exportJSON() {
    const data = JSON.stringify({ nodes, edges }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `${graphName.replace(/\s+/g, "_")}.json`;
    a.click(); URL.revokeObjectURL(url);
  }

  // ── Save to backend ───────────────────────────────────────────
  async function saveGraph() {
    // Validate
    if (nodes.length === 0) { flash("Add at least one node first!", "error"); return; }

    for (const e of edges) {
      if (e.capacity <= 0) { flash(`Edge ${e.id}: capacity must be > 0`, "error"); return; }
      if (e.load < 0)      { flash(`Edge ${e.id}: load must be ≥ 0`, "error"); return; }
    }

    try {
      const res = await fetch(`${API}/graph`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: loadedGraphId, name: graphName, nodes, edges }),
      });
      const data = await res.json();
      if (!res.ok) { flash(data.error || "Save failed", "error"); return; }
      flash(`✅ Graph saved! ID: ${data.id}`, "success");
      onSaved?.(data.graph);
    } catch {
      flash("❌ Could not reach backend", "error");
    }
  }

  // ── Delete node + its edges ────────────────────────────────────
  function deleteNode(id) {
    setNodes(prev => prev.filter(n => n.id !== id));
    setEdges(prev => prev.filter(e => e.from !== id && e.to !== id));
    setPendingNode(null);
    flash(`Deleted node ${id}`, "info");
  }

  // ── Delete edge ────────────────────────────────────────────────
  function deleteEdge(id) {
    setEdges(prev => prev.filter(e => e.id !== id));
    if (editEdge?.id === id) setEditEdge(null);
    flash(`Deleted edge ${id}`, "info");
  }

  // ── Update edge field ──────────────────────────────────────────
  function updateEdgeField(id, field, value) {
    setEdges(prev => prev.map(e =>
      e.id === id ? { ...e, [field]: Number(value) } : e
    ));
    setEditEdge(prev => prev && prev.id === id ? { ...prev, [field]: Number(value) } : prev);
  }

  // ── D3 draw ───────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const W = el.clientWidth  || 760;
    const H = el.clientHeight || 520;

    d3.select(el).selectAll("svg").remove();

    const svg = d3.select(el).append("svg")
      .attr("width", W).attr("height", H)
      .style("cursor", "crosshair");

    svgRef.current = svg;

    // Background rect (click to add node)
    svg.append("rect")
      .attr("width", W).attr("height", H)
      .attr("fill", "transparent")
      .on("click", (event) => {
        if (toolRef.current !== "node") return;
        const [x, y] = d3.pointer(event);

        const maxNum = nodesRef.current.reduce((max, n) => {
          if (n.id.startsWith("N")) {
            const num = parseInt(n.id.substring(1));
            return (!isNaN(num) && num > max) ? num : max;
          }
          return max;
        }, 0);
        
        const newId   = "N" + (maxNum + 1);
        const newNode = { id: newId, x, y };
        nodesRef.current = [...nodesRef.current, newNode];
        setNodes([...nodesRef.current]);
        flash(`Added node ${newId}`, "info");
      });

    // ── Dot-grid background ────────────────────────────────────
    const defs = svg.append("defs");
    const pat  = defs.append("pattern")
      .attr("id", "gb-grid").attr("width", 36).attr("height", 36)
      .attr("patternUnits", "userSpaceOnUse");
    pat.append("circle").attr("cx", 18).attr("cy", 18).attr("r", 0.8)
      .attr("fill", "#1a2240");
    svg.insert("rect", ":first-child")
      .attr("width", W).attr("height", H)
      .attr("fill", "url(#gb-grid)");

    // Layers
    const edgeLayer = svg.append("g");
    const nodeLayer = svg.append("g");

    // ── Render function ────────────────────────────────────────
    renderRef.current = () => {
      const ns = nodesRef.current;
      const es = edgesRef.current;
      const pending = pendingRef.current;

      // ── Edges ──────────────────────────────────────────────
      const edgeSel = edgeLayer.selectAll("g.gb-edge")
        .data(es, d => d.id);

      edgeSel.exit().remove();

      const edgeEnter = edgeSel.enter().append("g").attr("class", "gb-edge");

      // Hit area
      edgeEnter.append("line").attr("class", "gb-edge-hit")
        .attr("stroke", "transparent").attr("stroke-width", 18)
        .style("cursor", () => toolRef.current === "delete" ? "pointer" : "pointer");

      // Visual line
      edgeEnter.append("line").attr("class", "gb-edge-vis")
        .attr("stroke-width", 2)
        .style("pointer-events", "none");

      // Label
      edgeEnter.append("text").attr("class", "gb-edge-label")
        .attr("text-anchor", "middle")
        .attr("font-size", 9)
        .attr("font-family", "JetBrains Mono, monospace")
        .style("pointer-events", "none");

      const edgeAll = edgeLayer.selectAll("g.gb-edge");

      edgeAll.each(function(d) {
        const src = ns.find(n => n.id === d.from);
        const tgt = ns.find(n => n.id === d.to);
        if (!src || !tgt) return;

        const g = d3.select(this);

        g.select(".gb-edge-hit")
          .attr("x1", src.x).attr("y1", src.y)
          .attr("x2", tgt.x).attr("y2", tgt.y)
          .on("click", (event) => {
            event.stopPropagation();
            if (toolRef.current === "delete") { deleteEdge(d.id); return; }
            setEditEdge(edgesRef.current.find(e => e.id === d.id));
          });

        const ratio = d.load / d.capacity;
        const color = ratio > 1 ? "#ef4444" : ratio > 0.75 ? "#f59e0b" : "#60a5fa";

        g.select(".gb-edge-vis")
          .attr("x1", src.x).attr("y1", src.y)
          .attr("x2", tgt.x).attr("y2", tgt.y)
          .attr("stroke", color);

        g.select(".gb-edge-label")
          .attr("x", (src.x + tgt.x) / 2)
          .attr("y", (src.y + tgt.y) / 2 - 8)
          .attr("fill", color)
          .text(`${d.load}/${d.capacity}`);
      });

      // ── Nodes ──────────────────────────────────────────────
      const nodeSel = nodeLayer.selectAll("g.gb-node")
        .data(ns, d => d.id);

      nodeSel.exit().remove();

      const nodeEnter = nodeSel.enter().append("g").attr("class", "gb-node");
      nodeEnter.append("circle").attr("class", "gb-node-ring")
        .attr("r", 20).attr("fill", "none").attr("stroke-width", 1.5).attr("opacity", 0.3);
      nodeEnter.append("circle").attr("class", "gb-node-core")
        .attr("r", 13).attr("stroke-width", 2);
      nodeEnter.append("text").attr("class", "gb-node-label")
        .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
        .attr("font-size", 10).attr("font-weight", 700)
        .attr("font-family", "Inter, sans-serif")
        .style("pointer-events", "none");

      const nodeAll = nodeLayer.selectAll("g.gb-node");

      nodeAll.each(function(d) {
        const isPending = pending && pending.id === d.id;
        const g = d3.select(this);
        g.attr("transform", `translate(${d.x},${d.y})`);

        g.select(".gb-node-ring")
          .attr("stroke", isPending ? "#22d3ee" : "#3b82f6")
          .attr("opacity", isPending ? 0.6 : 0.3);

        g.select(".gb-node-core")
          .attr("fill",   isPending ? "#0e7490" : "#1d4ed8")
          .attr("stroke", isPending ? "#22d3ee" : "#3b82f6");

        g.select(".gb-node-label")
          .attr("fill", "#e8eaf0")
          .text(d.id.length > 4 ? d.id.slice(0, 4) : d.id);

        // Node label below
        nodeLayer.selectAll("text.gb-nlabel")
          .filter(n => n.id === d.id)
          .attr("x", d.x).attr("y", d.y + 30);

        g.style("cursor", toolRef.current === "delete" ? "pointer" : "grab")
          .on("click", (event) => {
            event.stopPropagation();

            if (toolRef.current === "delete") {
              deleteNode(d.id);
              return;
            }

            if (toolRef.current !== "edge") return;

            const cur = pendingRef.current;
            if (!cur) {
              setPendingNode(d);
              flash(`Node ${d.id} selected — click another to connect`, "info");
              return;
            }

            if (cur.id === d.id) {
              setPendingNode(null);
              flash("Can't connect a node to itself", "error");
              return;
            }

            // Check duplicate edge
            const dup = edgesRef.current.find(
              e => (e.from === cur.id && e.to === d.id) ||
                   (e.from === d.id   && e.to === cur.id)
            );
            if (dup) {
              setPendingNode(null);
              flash("Edge already exists between these nodes", "error");
              return;
            }

            const newEdge = {
              id:          "E" + Date.now(),
              from:        cur.id,
              to:          d.id,
              load:        0,
              capacity:    100,
              overloadTime: 0,
              threshold:   3,
              status:      "normal",
            };
            edgesRef.current = [...edgesRef.current, newEdge];
            setEdges([...edgesRef.current]);
            setPendingNode(null);
            flash(`Edge ${cur.id} → ${d.id} created`, "info");
          });
      });

      // Node labels outside (below)
      const labelSel = nodeLayer.selectAll("text.gb-nlabel")
        .data(ns, d => d.id);
      labelSel.exit().remove();
      labelSel.enter().append("text").attr("class", "gb-nlabel")
        .attr("text-anchor", "middle")
        .attr("font-size", 10)
        .attr("font-family", "Inter, sans-serif")
        .attr("fill", "#5a6a8a")
        .style("pointer-events", "none")
        .merge(labelSel)
        .attr("x", d => d.x)
        .attr("y", d => d.y + 30)
        .text(d => d.id);

      // ── Drag ────────────────────────────────────────────────────
      nodeAll.call(
        d3.drag()
          .on("start", (e, d) => { d.dragging = true; })
          .on("drag",  (e, d) => {
            d.x = e.x; d.y = e.y;
            renderRef.current?.();
          })
          .on("end",   (e, d) => {
            d.dragging = false;
            // sync back to React state
            nodesRef.current = nodesRef.current.map(n =>
              n.id === d.id ? { ...n, x: d.x, y: d.y } : n
            );
            setNodes([...nodesRef.current]);
          })
      );
    };

    renderRef.current();

    return () => { svgRef.current = null; renderRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount once

  // ── Re-render D3 whenever state changes ─────────────────────────
  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
    renderRef.current?.();
  }, [nodes, edges, pendingNode, tool]);

  // ── JSX ──────────────────────────────────────────────────────────
  return (
    <div className="builder-overlay">
      <div className="builder-shell">

        {/* ── Header ──────────────────────────────────────────── */}
        <div className="builder-header">
          <div className="builder-title">
            <span className="builder-icon">🔧</span>
            <input
              className="builder-name-input"
              value={graphName}
              onChange={e => setGraphName(e.target.value)}
              placeholder="Graph name..."
            />
          </div>

          <div className="builder-tools">
            <button
              className={`btool ${tool === "node" ? "active" : ""}`}
              onClick={() => { setTool("node"); setPendingNode(null); flash("Click empty space to add a node", "info"); }}
              title="Add Node"
            >⊕ Node</button>
            <button
              className={`btool ${tool === "edge" ? "active" : ""}`}
              onClick={() => { setTool("edge"); setPendingNode(null); flash("Click two nodes to connect them", "info"); }}
              title="Add Edge"
            >↗ Edge</button>
            <button
              className={`btool ${tool === "delete" ? "active delete" : ""}`}
              onClick={() => { setTool("delete"); setPendingNode(null); flash("Click a node or edge to delete it", "info"); }}
              title="Delete"
            >✕ Delete</button>
          </div>

          <div className="builder-presets">
            <span className="builder-preset-label">Presets:</span>
            {Object.entries(PRESETS).map(([key, p]) => (
              <button key={key} className="btool preset" onClick={() => loadPreset(key)}>
                {p.name}
              </button>
            ))}
            {savedDbGraphs.length > 0 && <span className="builder-preset-label" style={{marginLeft: 12}}>Saved:</span>}
            {savedDbGraphs.map(g => (
              <div key={g.id} style={{ display: "flex" }}>
                <button className="btool preset" style={{borderColor: '#10b981', color: '#10b981', borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: 'none'}} onClick={() => loadDbGraph(g.id)}>
                  {g.name}
                </button>
                <button className="btool preset" style={{borderColor: '#10b981', color: '#ef4444', padding: '6px 8px', borderTopLeftRadius: 0, borderBottomLeftRadius: 0}} onClick={(e) => deleteDbGraph(g.id, e)} title="Delete saved graph">✕</button>
              </div>
            ))}
          </div>

          <div className="builder-actions">
            <button className="btool" onClick={exportJSON} title="Export JSON">⬇ Export</button>
            <button className="btool save" onClick={saveGraph} title="Save & use for simulation">💾 Save & Run</button>
            <button className="btool close" onClick={onClose} title="Close builder">✕ Close</button>
          </div>
        </div>

        {/* ── Status bar ─────────────────────────────────────── */}
        <div className={`builder-msg builder-msg-${msg.type}`}>{msg.text}</div>

        {/* ── Body: canvas + edge editor ─────────────────────── */}
        <div className="builder-body">
          <div className="builder-canvas" ref={containerRef} />

          {/* ── Right panel ──────────────────────────────────── */}
          <div className="builder-panel">

            {/* Graph stats */}
            <div className="bp-section">
              <div className="bp-label">Graph</div>
              <div className="bp-stats">
                <div className="bp-stat"><span>Nodes</span><strong>{nodes.length}</strong></div>
                <div className="bp-stat"><span>Edges</span><strong>{edges.length}</strong></div>
              </div>
            </div>

            {/* Edit edge */}
            <div className="bp-section">
              <div className="bp-label">Edge Properties</div>
              {editEdge ? (
                <div className="bp-edge-edit">
                  <div className="bp-edge-id">{editEdge.from} → {editEdge.to}</div>
                  <label className="bp-field-label">Load</label>
                  <input
                    type="number" min="0"
                    className="bp-input"
                    value={edges.find(e => e.id === editEdge.id)?.load ?? editEdge.load}
                    onChange={e => updateEdgeField(editEdge.id, "load", e.target.value)}
                  />
                  <label className="bp-field-label">Capacity</label>
                  <input
                    type="number" min="1"
                    className="bp-input"
                    value={edges.find(e => e.id === editEdge.id)?.capacity ?? editEdge.capacity}
                    onChange={e => updateEdgeField(editEdge.id, "capacity", e.target.value)}
                  />
                  <label className="bp-field-label">Threshold (steps)</label>
                  <input
                    type="number" min="1"
                    className="bp-input"
                    value={edges.find(e => e.id === editEdge.id)?.threshold ?? editEdge.threshold}
                    onChange={e => updateEdgeField(editEdge.id, "threshold", e.target.value)}
                  />
                  <button
                    className="bp-delete-btn"
                    onClick={() => deleteEdge(editEdge.id)}
                  >✕ Delete edge</button>
                </div>
              ) : (
                <div className="bp-empty">Click an edge to edit its properties</div>
              )}
            </div>

            {/* Node list */}
            <div className="bp-section bp-scroll">
              <div className="bp-label">Nodes</div>
              {nodes.length === 0
                ? <div className="bp-empty">No nodes yet</div>
                : nodes.map(n => (
                  <div key={n.id} className="bp-node-row">
                    <span>{n.id}</span>
                    <button className="bp-delete-icon" onClick={() => deleteNode(n.id)}>✕</button>
                  </div>
                ))
              }
            </div>

            {/* Edge list */}
            <div className="bp-section bp-scroll">
              <div className="bp-label">Edges</div>
              {edges.length === 0
                ? <div className="bp-empty">No edges yet</div>
                : edges.map(e => (
                  <div key={e.id} className="bp-edge-row"
                    onClick={() => setEditEdge(e)}
                    style={{ cursor: "pointer" }}
                  >
                    <span>{e.from}→{e.to}</span>
                    <span className="bp-edge-ratio">{e.load}/{e.capacity}</span>
                    <button className="bp-delete-icon" onClick={(ev) => { ev.stopPropagation(); deleteEdge(e.id); }}>✕</button>
                  </div>
                ))
              }
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
