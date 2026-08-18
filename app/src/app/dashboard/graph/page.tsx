"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type GraphNode = { id: string; kind: "curriculum" | "learning"; name: string };
type GraphLink = { source: string; target: string; predicate: string };
type Snapshot = { nodes: GraphNode[]; links: GraphLink[] };

const NODE_COLORS = { curriculum: "#7fb3d5", learning: "#e8a33d" } as const;
const LINK_COLORS: Record<string, string> = {
  prerequisite: "#5d6f7e",
  mastered: "#58a27a",
  struggled: "#d06b5b",
};

/** Interactive 3D force view of the knowledge graph; admin-only data. */
export default function Graph3DPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<{ _destructor: () => void } | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/knowledge/graph", {
          cache: "no-store",
        });
        if (response.status === 403) {
          setDenied(true);
          return;
        }
        if (!response.ok) {
          setError("The graph is unavailable right now.");
          return;
        }
        setSnapshot((await response.json()) as Snapshot);
      } catch {
        setError("The graph is unavailable right now.");
      }
    })();
  }, []);

  useEffect(() => {
    if (!snapshot || !containerRef.current) return;
    if (snapshot.nodes.length === 0) return;
    let disposed = false;
    (async () => {
      const { default: ForceGraph3D } = await import("3d-force-graph");
      if (disposed || !containerRef.current) return;
      graphRef.current?._destructor();
      const graph = new ForceGraph3D(containerRef.current)
        .graphData(snapshot)
        .backgroundColor("rgba(0,0,0,0)")
        .nodeLabel("name")
        .nodeColor((node) => NODE_COLORS[(node as GraphNode).kind] ?? "#9aa8b5")
        .nodeRelSize(4)
        .linkColor(
          (link) => LINK_COLORS[(link as GraphLink).predicate] ?? "#54606c",
        )
        .linkOpacity(0.55)
        .linkWidth(0.6)
        .onNodeClick(() => graph.zoomToFit(600));
      graphRef.current = graph as unknown as { _destructor: () => void };
    })();
    return () => {
      disposed = true;
      graphRef.current?._destructor();
      graphRef.current = null;
    };
  }, [snapshot]);

  return (
    <main className="graph3d-shell">
      <header className="graph3d-topbar">
        <Link href="/dashboard" className="graph3d-back">
          ← Dashboard
        </Link>
        <span className="graph3d-title">Knowledge Graph · 3D</span>
        <span className="graph3d-legend">
          <span style={{ color: NODE_COLORS.curriculum }}>● concepts</span>
          <span style={{ color: NODE_COLORS.learning }}>● learning</span>
          <span style={{ color: LINK_COLORS.prerequisite }}>
            — prerequisite
          </span>
          <span style={{ color: LINK_COLORS.mastered }}>— mastered</span>
          <span style={{ color: LINK_COLORS.struggled }}>— struggled</span>
        </span>
      </header>
      {denied ? (
        <p role="alert" className="graph3d-note">
          Admin access is required for the knowledge graph.
        </p>
      ) : error ? (
        <p role="alert" className="graph3d-note">
          {error}{" "}
          <button type="button" onClick={() => window.location.reload()}>
            Retry
          </button>
        </p>
      ) : !snapshot ? (
        <p role="status" className="graph3d-note">
          Loading the graph…
        </p>
      ) : snapshot.nodes.length === 0 ? (
        <p role="status" className="graph3d-note">
          No graph is recorded yet. Seed the curriculum graph from the
          dashboard&apos;s Knowledge Graph tab first.
        </p>
      ) : (
        <div
          ref={containerRef}
          className="graph3d-canvas"
          aria-label="Interactive 3D knowledge graph"
        />
      )}
    </main>
  );
}
