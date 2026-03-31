"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useReactFlow,
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
  basic_design: { bg: "#FAEEDA", border: "#EF9F27", text: "#5a3d0a" },
  detail_design: { bg: "#FDF2E0", border: "#D4880E", text: "#5a3d0a" },
  code: { bg: "#EAF3DE", border: "#639922", text: "#2a4a0a" },
};

const LANE_ORDER = ["overview", "need", "req", "spec", "basic_design", "detail_design", "code"];

const nodeTypes = {
  custom: NodeCard,
};

interface Props {
  nodes: any[];
  edges: any[];
  projectId: string;
}

function FocusHandler({ rfNodes }: { rfNodes: RFNode[] }) {
  const { setCenter, getZoom } = useReactFlow();
  const panToNodeId = useAppStore((s) => s.panToNodeId);
  const setPanToNodeId = useAppStore((s) => s.setPanToNodeId);

  useEffect(() => {
    if (!panToNodeId) return;
    const node = rfNodes.find((n) => n.id === panToNodeId);
    if (node) {
      setCenter(node.position.x + 90, node.position.y + 30, { duration: 300, zoom: getZoom() });
    }
    setPanToNodeId(null);
  }, [panToNodeId, rfNodes, setCenter, getZoom, setPanToNodeId]);

  return null;
}

function TraceGraphInner({ nodes: rawNodes, edges: rawEdges }: Omit<Props, "projectId">) {
  const { selectedNodeId, setSelectedNodeId, focusNodeId, setFocusNodeId } = useAppStore();
  const { hiddenLanes } = useAppStore();

  const filteredNodes = useMemo(() => {
    return rawNodes.filter((n: any) => !hiddenLanes.has(n.type));
  }, [rawNodes, hiddenLanes]);

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
    return LANE_ORDER.filter((l) => !hiddenLanes.has(l));
  }, [hiddenLanes]);

  // Layout: group by need (row-based), position horizontally by lane
  const rfNodes: RFNode[] = useMemo(() => {
    const NODE_HEIGHT = 100;
    const ROW_GAP = 20;

    // Build lane X positions
    const laneX: Record<string, number> = {};
    visibleLanes.forEach((lane, li) => { laneX[lane] = li * 220; });

    // Separate overview and need nodes
    const overviewNodes = filteredNodes.filter((n) => n.type === "overview");
    const needNodes = filteredNodes.filter((n) => n.type === "need");
    const assignedIds = new Set<string>();

    // Build row groups: each need + all descendants grouped by lane
    const rowGroups = needNodes.map((need) => {
      const byLane: Record<string, any[]> = { need: [need] };
      assignedIds.add(need.id);
      const queue = [need.id];
      const visited = new Set([need.id]);
      while (queue.length > 0) {
        const id = queue.shift()!;
        for (const childId of adjDown.get(id) || []) {
          if (visited.has(childId)) continue;
          visited.add(childId);
          const child = filteredNodes.find((n) => n.id === childId);
          if (child) {
            if (!byLane[child.type]) byLane[child.type] = [];
            byLane[child.type].push(child);
            assignedIds.add(child.id);
            queue.push(childId);
          }
        }
      }
      const maxCount = Math.max(...Object.values(byLane).map((arr) => arr.length));
      return { byLane, height: maxCount * NODE_HEIGHT };
    });

    const result: RFNode[] = [];
    const addNode = (node: any, x: number, y: number) => {
      const isFocused = focusSet ? focusSet.has(node.id) : true;
      result.push({
        id: node.id,
        type: "custom",
        position: { x, y },
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
    };

    const startY = 60;
    let currentY = startY;

    // Place each need row group (overview deferred to center later)
    for (const group of rowGroups) {
      for (const lane of visibleLanes) {
        if (lane === "overview") continue;
        const nodes = group.byLane[lane] || [];
        const x = laneX[lane];
        if (x === undefined) continue;
        nodes.forEach((node, i) => {
          addNode(node, x, currentY + i * NODE_HEIGHT);
        });
      }
      currentY += group.height + ROW_GAP;
    }

    const totalHeight = Math.max(currentY - startY - ROW_GAP, 0);

    // Place overview nodes at vertical center
    if (laneX["overview"] !== undefined) {
      const overviewBlockHeight = overviewNodes.length * NODE_HEIGHT;
      const centerY = startY + totalHeight / 2 - overviewBlockHeight / 2;
      overviewNodes.forEach((node, i) => {
        assignedIds.add(node.id);
        addNode(node, laneX["overview"], centerY + i * NODE_HEIGHT);
      });
    }

    // Place orphan nodes (not assigned to any need group)
    const orphans = filteredNodes.filter((n) => !assignedIds.has(n.id));
    const orphanByLane: Record<string, any[]> = {};
    for (const node of orphans) {
      if (!orphanByLane[node.type]) orphanByLane[node.type] = [];
      orphanByLane[node.type].push(node);
    }
    if (orphans.length > 0) {
      for (const lane of visibleLanes) {
        const nodes = orphanByLane[lane] || [];
        const x = laneX[lane];
        if (x === undefined) continue;
        nodes.forEach((node, i) => {
          addNode(node, x, currentY + i * NODE_HEIGHT);
        });
      }
    }

    return result;
  }, [filteredNodes, visibleLanes, selectedNodeId, focusSet, adjDown]);

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
        <FocusHandler rfNodes={rfNodes} />
      </ReactFlow>
    </div>
  );
}

export function TraceGraph({ nodes, edges }: Props) {
  return (
    <ReactFlowProvider>
      <TraceGraphInner nodes={nodes} edges={edges} />
    </ReactFlowProvider>
  );
}
