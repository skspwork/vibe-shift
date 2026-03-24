"use client";

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Node as RFNode,
  type Edge as RFEdge,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useAppStore } from "@/lib/store";
import { NodeCard } from "./NodeCard";

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

  // Build focus set for highlight
  const focusSet = useMemo(() => {
    if (!focusNodeId) return null;
    const set = new Set<string>();
    set.add(focusNodeId);
    // Walk upstream and downstream
    const queue = [focusNodeId];
    const visited = new Set<string>();
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      set.add(current);
      for (const e of rawEdges) {
        if (e.from_node_id === current && !visited.has(e.to_node_id)) {
          queue.push(e.to_node_id);
        }
        if (e.to_node_id === current && !visited.has(e.from_node_id)) {
          queue.push(e.from_node_id);
        }
      }
    }
    return set;
  }, [focusNodeId, rawEdges]);

  // Layout: group by type (lane), position horizontally
  const rfNodes: RFNode[] = useMemo(() => {
    const byLane: Record<string, any[]> = {};
    for (const node of rawNodes) {
      const lane = node.type;
      if (!byLane[lane]) byLane[lane] = [];
      byLane[lane].push(node);
    }

    const result: RFNode[] = [];
    for (const lane of LANE_ORDER) {
      const laneNodes = byLane[lane] || [];
      const laneX = LANE_ORDER.indexOf(lane) * 220;

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
  }, [rawNodes, selectedNodeId, focusSet]);

  const rfEdges: RFEdge[] = useMemo(() => {
    return rawEdges.map((e: any) => {
      const isFocused = focusSet
        ? focusSet.has(e.from_node_id) && focusSet.has(e.to_node_id)
        : true;
      return {
        id: e.id,
        source: e.from_node_id,
        target: e.to_node_id,
        animated: false,
        style: {
          stroke: isFocused ? "#94a3b8" : "#e2e8f0",
          strokeWidth: isFocused ? 2 : 1,
          opacity: isFocused ? 1 : 0.1,
        },
      };
    });
  }, [rawEdges, focusSet]);

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
        {LANE_ORDER.map((lane) => {
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
              {lane}
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
