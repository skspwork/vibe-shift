"use client";

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node as RFNode,
  type Edge as RFEdge,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useAppStore } from "@/lib/store";
import { NodeCard } from "./NodeCard";
import { NODE_LABELS } from "@cddai/shared";

const NODE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  overview: { bg: "#2E4057", border: "#1a2a3a", text: "#ffffff" },
  need: { bg: "#E6F1FB", border: "#378ADD", text: "#1a3a5c" },
  req: { bg: "#E1F5EE", border: "#1D9E75", text: "#0d4a36" },
  spec: { bg: "#EEEDFE", border: "#7F77DD", text: "#3a356a" },
  design: { bg: "#FAEEDA", border: "#EF9F27", text: "#5a3d0a" },
  task: { bg: "#FAECE7", border: "#D85A30", text: "#5a1f0a" },
  code: { bg: "#EAF3DE", border: "#639922", text: "#2a4a0a" },
  test: { bg: "#FBEAF0", border: "#D4537E", text: "#5a1a30" },
};

const LANE_ORDER = ["overview", "need", "req", "spec", "design", "task", "code", "test"];

const nodeTypes = {
  custom: NodeCard,
};

interface Props {
  nodes: any[];
  edges: any[];
  projectId: string;
}

export function TraceGraph({ nodes: rawNodes, edges: rawEdges, projectId }: Props) {
  const { selectedNodeId, setSelectedNodeId, focusNodeId, setFocusNodeId } = useAppStore();
  const { viewMode, hiddenLanes } = useAppStore();

  // Filter nodes by view mode and hidden lanes
  const SUMMARY_LANES = new Set(["overview", "need", "req"]);
  const filteredNodes = useMemo(() => {
    return rawNodes.filter((n: any) => {
      if (viewMode === "summary" && !SUMMARY_LANES.has(n.type)) return false;
      if (hiddenLanes.has(n.type)) return false;
      return true;
    });
  }, [rawNodes, viewMode, hiddenLanes]);

  const visibleNodeIds = useMemo(() => new Set(filteredNodes.map((n: any) => n.id)), [filteredNodes]);

  const filteredEdges = useMemo(() => {
    return rawEdges.filter((e: any) => visibleNodeIds.has(e.from_node_id) && visibleNodeIds.has(e.to_node_id));
  }, [rawEdges, visibleNodeIds]);

  // Build adjacency maps for directed traversal
  const { adjDown, adjUp } = useMemo(() => {
    const down = new Map<string, string[]>();
    const up = new Map<string, string[]>();
    for (const e of rawEdges) {
      down.set(e.from_node_id, [...(down.get(e.from_node_id) || []), e.to_node_id]);
      up.set(e.to_node_id, [...(up.get(e.to_node_id) || []), e.from_node_id]);
    }
    return { adjDown: down, adjUp: up };
  }, [rawEdges]);

  // Build focus set: upstream (parents) + downstream (children) only
  const focusSet = useMemo(() => {
    if (!focusNodeId) return null;
    const set = new Set<string>();
    set.add(focusNodeId);

    // Walk upstream (parent direction)
    const upQueue = [focusNodeId];
    while (upQueue.length > 0) {
      const current = upQueue.shift()!;
      for (const parent of adjUp.get(current) || []) {
        if (!set.has(parent)) {
          set.add(parent);
          upQueue.push(parent);
        }
      }
    }

    // Walk downstream (child direction)
    const downQueue = [focusNodeId];
    while (downQueue.length > 0) {
      const current = downQueue.shift()!;
      for (const child of adjDown.get(current) || []) {
        if (!set.has(child)) {
          set.add(child);
          downQueue.push(child);
        }
      }
    }

    return set;
  }, [focusNodeId, adjDown, adjUp]);

  // Visible lanes for layout
  const visibleLanes = useMemo(() => {
    if (viewMode === "summary") return LANE_ORDER.filter((l) => SUMMARY_LANES.has(l) && !hiddenLanes.has(l));
    return LANE_ORDER.filter((l) => !hiddenLanes.has(l));
  }, [viewMode, hiddenLanes]);

  // Layout: group by type (lane), position horizontally
  const rfNodes: RFNode[] = useMemo(() => {
    const byLane: Record<string, any[]> = {};
    for (const node of filteredNodes) {
      const lane = node.type;
      if (!byLane[lane]) byLane[lane] = [];
      byLane[lane].push(node);
    }

    const result: RFNode[] = [];
    for (let li = 0; li < visibleLanes.length; li++) {
      const lane = visibleLanes[li];
      const laneNodes = byLane[lane] || [];
      const laneX = li * 220;

      laneNodes.forEach((node, i) => {
        const isFocused = focusSet ? focusSet.has(node.id) : true;
        result.push({
          id: node.id,
          type: "custom",
          position: { x: laneX, y: 60 + i * 100 },
          data: {
            label: node.title,
            nodeType: node.type,
            colors: NODE_COLORS[node.type] || NODE_COLORS.need,
            selected: node.id === selectedNodeId,
            dimmed: !isFocused,
          },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
        });
      });
    }
    return result;
  }, [filteredNodes, visibleLanes, selectedNodeId, focusSet]);

  const rfEdges: RFEdge[] = useMemo(() => {
    return filteredEdges.map((e: any) => {
      const isFocused = focusSet
        ? focusSet.has(e.from_node_id) && focusSet.has(e.to_node_id)
        : true;
      return {
        id: e.id,
        source: e.from_node_id,
        target: e.to_node_id,
        animated: false,
        style: {
          stroke: isFocused ? "#94a3b8" : "#94a3b8",
          strokeWidth: isFocused ? 2 : 2,
          opacity: isFocused ? 1 : 0.5,
        },
      };
    });
  }, [filteredEdges, focusSet]);

  const onNodeClick = useCallback(
    (_: any, node: RFNode) => {
      setSelectedNodeId(node.id);
      setFocusNodeId(node.id);
    },
    [setSelectedNodeId, setFocusNodeId]
  );

  const onPaneClick = useCallback(() => {
    setFocusNodeId(null);
  }, [setFocusNodeId]);

  return (
    <div className="w-full h-full">
      {/* Lane headers */}
      <div className="absolute top-0 left-0 right-0 z-10 flex h-8 bg-gray-50/80 border-b">
        {visibleLanes.map((lane) => {
          const colors = NODE_COLORS[lane];
          return (
            <div
              key={lane}
              className="text-xs font-medium flex items-center justify-center"
              style={{
                width: 220,
                color: colors.border,
                borderBottom: `2px solid ${colors.border}`,
              }}
            >
              {NODE_LABELS[lane] || lane}
            </div>
          );
        })}
      </div>

      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        style={{ paddingTop: 32 }}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
