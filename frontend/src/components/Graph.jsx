import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import socket from "../socket";

// (API calls handled in App.jsx — Graph is pure D3 + socket)

// ── Color palette ─────────────────────────────────────────────
const NODE_COLORS = {
  failed:     "#ef4444",
  overloaded: "#f97316",
  stressed:   "#f59e0b",
  near:       "#f59e0b",
  normal:     "#3b82f6",
};

const EDGE_COLORS = {
  failed:     "#ef4444",
  overloaded: "#f97316",
  near:       "#f59e0b",
  normal:     "#60a5fa",
};

function nodeColor(status) {
  return NODE_COLORS[status] ?? NODE_COLORS.normal;
}

function edgeColor(status, load, capacity) {
  if (status === "failed")     return EDGE_COLORS.failed;
  if (status === "overloaded") return EDGE_COLORS.overloaded;
  if (status === "near")       return EDGE_COLORS.near;
  const ratio = (load ?? 0) / (capacity ?? 1);
  if (ratio > 1)    return EDGE_COLORS.overloaded;
  if (ratio > 0.75) return EDGE_COLORS.near;
  return EDGE_COLORS.normal;
}

function getEdgeStatus(status, load, capacity) {
  if (status === "failed")     return "failed";
  if (status === "overloaded") return "overloaded";
  if (status === "near")       return "near capacity";
  const ratio = (load ?? 0) / (capacity ?? 1);
  if (ratio > 1)    return "overloaded";
  if (ratio > 0.75) return "near capacity";
  return status ?? "normal";
}

// Selected edge gets a wider stroke
function edgeWidth(d, selectedId) { return d.id === selectedId ? 4 : 1.5; }

function edgeDash(status) {
  if (status === "failed") return "6 4";
  return "none";
}

// ─────────────────────────────────────────────────────────────

export default function Graph({ graph, onSimulating, setSelectedEdge, selectedEdge }) {
  const containerRef = useRef();
  const svgRef       = useRef();      // d3 selection
  const simRef       = useRef();
  const nodesRef     = useRef([]);    // live D3 node objects with x/y
  const applyRef     = useRef(null);  // imperative update fn

  const [tooltip,  setTooltip]  = useState({ visible: false, x: 0, y: 0, data: null, type: null });
  const [stepInfo, setStepInfo] = useState(null);   // { current, total: null } — live feed has no total
  const stepCountRef    = useRef(0);
  const selectedEdgeRef    = useRef(null);  // latest selected edge ID — safe inside D3 closures
  const setSelectedEdgeRef = useRef(null);  // latest setSelectedEdge fn — safe inside D3 closures

  // ── Mount D3 once ────────────────────────────────────────────
  useEffect(() => {
    if (!graph || !containerRef.current) return;

    const el = containerRef.current;
    const W  = el.clientWidth  || 900;
    const H  = el.clientHeight || 600;

    // Clear any previous SVG
    d3.select(el).selectAll("svg").remove();

    const svg = d3.select(el).append("svg")
      .attr("width",  W)
      .attr("height", H)
      .style("overflow", "visible");

    svgRef.current = svg;

    // ── Defs ─────────────────────────────────────────────────
    const defs = svg.append("defs");

    // Subtle dot-grid background
    const pat = defs.append("pattern")
      .attr("id", "grid").attr("width", 36).attr("height", 36)
      .attr("patternUnits", "userSpaceOnUse");
    pat.append("circle").attr("cx", 18).attr("cy", 18).attr("r", 0.7)
      .attr("fill", "#1a2240");

    svg.append("rect").attr("width", W).attr("height", H)
      .attr("fill", "url(#grid)");

    // Glow filter
    const glow = defs.append("filter").attr("id", "glow")
      .attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
    glow.append("feGaussianBlur").attr("in", "SourceGraphic")
      .attr("stdDeviation", "3").attr("result", "blur");
    const glowMerge = glow.append("feMerge");
    glowMerge.append("feMergeNode").attr("in", "blur");
    glowMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Pulse filter for nodes during overload
    const pulse = defs.append("filter").attr("id", "pulse")
      .attr("x", "-80%").attr("y", "-80%").attr("width", "260%").attr("height", "260%");
    pulse.append("feGaussianBlur").attr("in", "SourceGraphic")
      .attr("stdDeviation", "6").attr("result", "blur");
    const pulseMerge = pulse.append("feMerge");
    pulseMerge.append("feMergeNode").attr("in", "blur");
    pulseMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // ── Deep-clone data so D3 can mutate x/y freely ──────────
    const nodes = graph.nodes.map(n => ({ ...n }));
    const edges = graph.edges.map(e => ({ ...e, source: e.from, target: e.to }));
    nodesRef.current = nodes;

    // ── Layers ───────────────────────────────────────────────
    const edgeLayer = svg.append("g").attr("class", "edge-layer");
    const nodeLayer = svg.append("g").attr("class", "node-layer");

    // ── Edge elements ─────────────────────────────────────────
    // Background hit area (wide, transparent)
    const hitLines = edgeLayer.selectAll("line.hit")
      .data(edges, d => d.id)
      .enter().append("line")
        .attr("class", "hit")
        .attr("stroke", "transparent")
        .attr("stroke-width", 22)
        .style("cursor", "pointer");

    // Visual line
    const visLines = edgeLayer.selectAll("line.vis")
      .data(edges, d => d.id)
      .enter().append("line")
        .attr("class", "vis")
        .style("pointer-events", "none")
        .style("transition", "stroke 0.7s ease, stroke-opacity 0.7s ease");

    // Load labels — positioned above the midpoint
    const edgeLabels = edgeLayer.selectAll("text.elabel")
      .data(edges, d => d.id)
      .enter().append("text")
        .attr("class", "elabel")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("font-size", 9)
        .attr("font-family", "JetBrains Mono, monospace")
        .style("pointer-events", "none")
        .style("transition", "fill 0.7s ease");

    // ── Node elements ─────────────────────────────────────────
    const nodeGroups = nodeLayer.selectAll("g.node")
      .data(nodes, d => d.id)
      .enter().append("g").attr("class", "node")
        .style("cursor", "grab");

    // Outer glow ring
    nodeGroups.append("circle")
      .attr("class", "node-ring")
      .attr("r", 20)
      .attr("fill", "none")
      .attr("stroke-width", 1.5)
      .attr("opacity", 0.2)
      .attr("filter", "url(#glow)")
      .style("transition", "stroke 0.7s ease, opacity 0.7s ease, r 0.4s ease");

    // Core circle — clean, no jank
    nodeGroups.append("circle")
      .attr("class", "node-core")
      .attr("r", 13)
      .attr("stroke-width", 1.5)
      .style("transition", "fill 0.7s ease, stroke 0.7s ease");

    // Node label — sits below the node, NOT inside
    nodeLayer.selectAll("text.nlabel")
      .data(nodes, d => d.id)
      .enter().append("text")
        .attr("class", "nlabel")
        .attr("text-anchor", "middle")
        .attr("font-size", 11)
        .attr("font-weight", 600)
        .attr("font-family", "Inter, sans-serif")
        .attr("pointer-events", "none")
        .style("transition", "fill 0.7s ease")
        .text(d => d.id);

    // ── Set initial appearance ────────────────────────────────
    nodeGroups.select("circle.node-core")
      .attr("fill",   d => nodeColor(d.status))
      .attr("stroke", d => nodeColor(d.status) + "66");
    nodeGroups.select("circle.node-ring")
      .attr("stroke", d => nodeColor(d.status));

    function applyEdgeAppearance(sel, selectedId) {
      sel
        .attr("stroke",          d => edgeColor(d.status, d.load, d.capacity))
        .attr("stroke-width",    d => edgeWidth(d, selectedId))
        .attr("stroke-opacity",  d => d.status === "failed" ? 0.3 : 0.85)
        .attr("stroke-dasharray",d => edgeDash(d.status))
        .attr("filter",          d => d.status === "overloaded" ? "url(#glow)" : null);
    }
    applyEdgeAppearance(visLines, null);

    edgeLabels
      .attr("fill", d => edgeColor(d.status, d.load, d.capacity))
      .text(d => `${Math.round(d.load ?? 0)}/${d.capacity}`);

    // ── Force simulation ──────────────────────────────────────
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(edges).id(d => d.id).distance(160).strength(0.6))
      .force("charge", d3.forceManyBody().strength(-500))
      .force("center", d3.forceCenter(W / 2, H / 2))
      .force("collision", d3.forceCollide(40))
      .alphaDecay(0.04);

    simRef.current = simulation;

    simulation.on("tick", () => {
      hitLines
        .attr("x1", d => d.source.x).attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
      visLines
        .attr("x1", d => d.source.x).attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
      edgeLabels
        .attr("x", d => (d.source.x + d.target.x) / 2 + (d.target.y - d.source.y) * 0.12)
        .attr("y", d => (d.source.y + d.target.y) / 2 - (d.target.x - d.source.x) * 0.12 - 4);
      nodeGroups.attr("transform", d => `translate(${d.x},${d.y})`);
      nodeLayer.selectAll("text.nlabel")
        .attr("x", d => d.x)
        .attr("y", d => d.y + 30);
    });

    // Once settled, freeze all node positions so cascade never shakes them
    simulation.on("end", () => {
      nodes.forEach(n => { n.fx = n.x; n.fy = n.y; });
    });

    // ── Drag (unfreeze temporarily) ───────────────────────────
    const drag = d3.drag()
      .on("start", (e, d) => {
        simulation.alphaTarget(0.05).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on("drag",  (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on("end",   (e, d) => {
        simulation.alphaTarget(0);
        // Re-freeze after drag
        d.fx = d.x; d.fy = d.y;
      });
    nodeGroups.call(drag);

    // ── Edge click ────────────────────────────────────────────
    hitLines.on("click", (event, d) => {
      if (d.status === "failed") return;
      // Update selected edge in React + highlight in D3
      setSelectedEdge?.(d);
      selectedEdgeRef.current = d.id;
      applyEdgeAppearance(visLines, d.id);
      handleEdgeClickRef.current?.(d.id);
    });

    // ── Tooltips ──────────────────────────────────────────────
    function getRelPos(e) {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left + 14, y: e.clientY - r.top - 10 };
    }

    hitLines
      .on("mouseenter", (e, d) => {
        const p = getRelPos(e);
        setTooltip({ visible: true, ...p, data: { ...d, from: d.from ?? d.source?.id, to: d.to ?? d.target?.id }, type: "edge" });
      })
      .on("mousemove",  (e) => { const p = getRelPos(e); setTooltip(t => ({ ...t, ...p })); })
      .on("mouseleave", ()  => setTooltip(t => ({ ...t, visible: false })));

    nodeGroups
      .on("mouseenter", (e, d) => { const p = getRelPos(e); setTooltip({ visible: true, ...p, data: d, type: "node" }); })
      .on("mousemove",  (e)    => { const p = getRelPos(e); setTooltip(t => ({ ...t, ...p })); })
      .on("mouseleave", ()     => setTooltip(t => ({ ...t, visible: false })));

    // ── Imperative update fn (called by cascade steps) ────────
    applyRef.current = (updatedGraph) => {
      const edgeMap = new Map(updatedGraph.edges.map(e => [e.id, e]));
      const nodeMap = new Map(updatedGraph.nodes.map(n => [n.id, n]));

      // Update data on live D3 objects (no position change)
      edges.forEach(e => {
        const u = edgeMap.get(e.id);
        if (u) { e.status = u.status; e.load = u.load; e.capacity = u.capacity; }
      });
      nodes.forEach(n => {
        const u = nodeMap.get(n.id);
        if (u) { n.status = u.status; n.stress = u.stress; }
      });

      // CSS transitions handle the smooth visual change (0.6s)
      applyEdgeAppearance(visLines, selectedEdgeRef.current);
      edgeLabels
        .attr("fill", d => edgeColor(d.status, d.load, d.capacity))
        .text(d => `${Math.round(d.load ?? 0)}/${d.capacity}`);

      // Nodes — consistent size, color carries all meaning
      nodeGroups.select("circle.node-core")
        .attr("fill",   d => nodeColor(d.status))
        .attr("stroke", d => nodeColor(d.status) + "66");
      nodeGroups.select("circle.node-ring")
        .attr("stroke", d => nodeColor(d.status))
        .attr("opacity",d => (d.status === "overloaded" || d.status === "failed") ? 0.4 : 0.2);
      nodeLayer.selectAll("text.nlabel")
        .attr("fill", d => (d.status === "failed" || d.status === "overloaded") ? nodeColor(d.status) : "#5a6a8a");

      hitLines.style("cursor", d => d.status === "failed" ? "not-allowed" : "pointer");

      // ── Sync Edge Info panel in React with the live D3 state ──────
      // selectedEdge in React is a stale snapshot from click-time; refresh it
      if (selectedEdgeRef.current) {
        const live = edges.find(e => e.id === selectedEdgeRef.current);
        if (live) {
          setSelectedEdgeRef.current?.({
            ...live,
            // ensure from/to are readable strings even after D3 rewrites source/target
            from: live.from ?? live.source?.id ?? live.source,
            to:   live.to   ?? live.target?.id ?? live.target,
          });
        }
      }

      // Reset: unfreeze so nodes settle back to center
      const isReset = updatedGraph.edges.every(e => e.status === "normal");
      if (isReset) {
        selectedEdgeRef.current = null;
        nodes.forEach(n => { n.fx = null; n.fy = null; });
        simulation.alpha(0.3).restart();
        simulation.on("end", () => { nodes.forEach(n => { n.fx = n.x; n.fy = n.y; }); });
      }
    };

    return () => {
      simulation.stop();
      applyRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← MOUNT ONLY — D3 never re-runs from React

  // ── Socket listeners (stable, mount-once) ────────────────────
  const handleEdgeClickRef = useRef(null);

  useEffect(() => {
    socket.on("simulationStep", ({ step, graph: g }) => {
      const formatted = {
        nodes: g.nodes,
        edges: g.edges.map(e => ({ ...e, source: e.from, target: e.to })),
      };
      applyRef.current?.(formatted);
      stepCountRef.current = step + 1;
      setStepInfo({ current: step + 1 });
    });

    socket.on("simulationEnd", ({ graph: g }) => {
      // Apply final state
      if (g) {
        const formatted = {
          nodes: g.nodes,
          edges: g.edges.map(e => ({ ...e, source: e.from, target: e.to })),
        };
        applyRef.current?.(formatted);
      }
      onSimulating?.(false);
      // Show final step count for 3s then clear
      setTimeout(() => {
        setStepInfo(null);
        stepCountRef.current = 0;
      }, 3000);
    });

    // connection state tracked in App.jsx

    return () => {
      socket.off("simulationStep");
      socket.off("simulationEnd");
    };
  }, [onSimulating]);

  // handleEdgeClick — emits to backend, does NOT fetch
  const handleEdgeClick = useCallback((edgeId) => {
    onSimulating?.(true);
    stepCountRef.current = 0;
    setStepInfo({ current: 0 });
    socket.emit("startSimulation", edgeId);
  }, [onSimulating]);

  handleEdgeClickRef.current   = handleEdgeClick;
  setSelectedEdgeRef.current   = setSelectedEdge;   // keep ref current for D3 closure

  // Handle reset — graph prop changes back to initial state (from App.jsx fetchGraph)
  const prevGraphRef = useRef(null);
  useEffect(() => {
    if (!graph) return;
    const isReset = graph.edges.every(e => e.status === "normal");
    if (isReset && prevGraphRef.current && applyRef.current) {
      applyRef.current(graph);
    }
    prevGraphRef.current = graph;
  }, [graph]);



  // ── JSX ───────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      {stepInfo && (
        <div className="step-hud">
          <span className="step-label">Live</span>
          <span className="step-value">{stepInfo.current}</span>
        </div>
      )}

      <div
        className={`tooltip ${tooltip.visible ? "visible" : ""}`}
        style={{ left: tooltip.x, top: tooltip.y }}
      >
        {tooltip.data && tooltip.type === "node" && (
          <>
            <div className="tooltip-title">Node {tooltip.data.id}</div>
            <div className="tooltip-row">
              <span>Status</span>
              <span style={{ color: nodeColor(tooltip.data.status) }}>
                {tooltip.data.status ?? "normal"}
              </span>
            </div>
            {tooltip.data.stress !== undefined && (
              <div className="tooltip-row">
                <span>Stress</span>
                <span>{(tooltip.data.stress * 100).toFixed(0)}%</span>
              </div>
            )}
          </>
        )}
        {tooltip.data && tooltip.type === "edge" && (
          <>
            <div className="tooltip-title">Edge {tooltip.data.id}</div>
            <div className="tooltip-row">
              <span>Route</span>
              <span>{tooltip.data.from ?? "?"} → {tooltip.data.to ?? "?"}</span>
            </div>
            <div className="tooltip-row">
              <span>Load / Cap</span>
              <span>{Math.round(tooltip.data.load ?? 0)} / {tooltip.data.capacity ?? "?"}</span>
            </div>
            <div className="tooltip-row">
              <span>Status</span>
              <span style={{ color: edgeColor(tooltip.data.status, tooltip.data.load, tooltip.data.capacity) }}>
                {getEdgeStatus(tooltip.data.status, tooltip.data.load, tooltip.data.capacity)}
              </span>
            </div>
            {tooltip.data.status !== "failed" && (
              <div className="tooltip-hint">Click to trigger cascade</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
