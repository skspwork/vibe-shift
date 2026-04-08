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

const NODE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  overview: { bg: "#2E4057", border: "#1a2a3a", text: "#ffffff" },
  need: { bg: "#E6F1FB", border: "#378ADD", text: "#1a3a5c" },
  feature: { bg: "#E1F5EE", border: "#1D9E75", text: "#0d4a36" },
  spec: { bg: "#EEEDFE", border: "#7F77DD", text: "#3a356a" },
};

// Lanes within one group (need → feature → spec)
const GROUP_LANES = ["need", "feature", "spec"];

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
  const { selectedNodeId, setSelectedNodeId, focusNodeId, setFocusNodeId, graphColumns } = useAppStore();

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

  // Build focus set: upstream + downstream
  const focusSet = useMemo(() => {
    if (!focusNodeId) return null;
    const set = new Set<string>();
    set.add(focusNodeId);

    const upQueue = [focusNodeId];
    while (upQueue.length > 0) {
      const current = upQueue.shift()!;
      for (const parent of adjUp.get(current) || []) {
        if (!set.has(parent)) { set.add(parent); upQueue.push(parent); }
      }
    }

    const downQueue = [focusNodeId];
    while (downQueue.length > 0) {
      const current = downQueue.shift()!;
      for (const child of adjDown.get(current) || []) {
        if (!set.has(child)) { set.add(child); downQueue.push(child); }
      }
    }

    return set;
  }, [focusNodeId, adjDown, adjUp]);

  // Layout: 2-column grid of need groups
  const rfNodes: RFNode[] = useMemo(() => {
    const NODE_HEIGHT = 100;
    const ROW_GAP = 20;
    const LANE_WIDTH = 220;
    const GROUP_WIDTH = GROUP_LANES.length * LANE_WIDTH;
    const GROUP_GAP_X = 60; // horizontal gap between columns

    const nodeMap = new Map(rawNodes.map((n: any) => [n.id, n]));
    const needNodes = rawNodes.filter((n: any) => n.type === "need");
    const assignedIds = new Set<string>();

    const result: RFNode[] = [];
    const addNode = (node: any, x: number, y: number) => {
      const isFocused = focusSet ? focusSet.has(node.id) : true;
      const isDisabled = !!node.disabled_at;
      result.push({
        id: node.id,
        type: "custom",
        position: { x, y },
        data: {
          label: node.title,
          nodeType: node.type,
          colors: NODE_COLORS[node.type] || NODE_COLORS.need,
          selected: node.id === selectedNodeId,
          dimmed: !isFocused || isDisabled,
          disabled: isDisabled,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      });
    };

    // Build groups: each need + features + specs
    const groups = needNodes.map((need: any) => {
      assignedIds.add(need.id);
      const features: any[] = [];
      const featureSpecs = new Map<string, any[]>();

      const queue = [need.id];
      const visited = new Set([need.id]);
      while (queue.length > 0) {
        const id = queue.shift()!;
        for (const childId of adjDown.get(id) || []) {
          if (visited.has(childId)) continue;
          visited.add(childId);
          const child = nodeMap.get(childId);
          if (!child) continue;
          if (child.type === "feature") {
            features.push(child);
            assignedIds.add(child.id);
            // Collect spec descendants
            const specs: any[] = [];
            const specQueue = [child.id];
            const specVisited = new Set([child.id]);
            while (specQueue.length > 0) {
              const sid = specQueue.shift()!;
              for (const descId of adjDown.get(sid) || []) {
                if (specVisited.has(descId)) continue;
                specVisited.add(descId);
                const desc = nodeMap.get(descId);
                if (desc && desc.type === "spec") {
                  specs.push(desc);
                  assignedIds.add(desc.id);
                  specQueue.push(descId);
                }
              }
            }
            featureSpecs.set(child.id, specs);
          } else if (child.type !== "spec") {
            queue.push(childId);
          }
        }
      }

      // Calculate group height
      const height = features.length > 0
        ? features.reduce((sum, f) => {
            const specs = featureSpecs.get(f.id) || [];
            return sum + Math.max(NODE_HEIGHT, specs.length * NODE_HEIGHT);
          }, 0)
        : NODE_HEIGHT;

      return { need, features, featureSpecs, height };
    });

    // Place groups in 2-column grid
    // Track current Y for each column independently
    const columnY = new Array(graphColumns).fill(40);

    for (const group of groups) {
      // Pick the column with the smallest current Y (shortest column)
      let col = 0;
      for (let c = 1; c < graphColumns; c++) {
        if (columnY[c] < columnY[col]) col = c;
      }

      const baseX = col * (GROUP_WIDTH + GROUP_GAP_X);
      const startY = columnY[col];

      // Place need node (vertically centered)
      const needY = startY + group.height / 2 - NODE_HEIGHT / 2;
      addNode(group.need, baseX, needY);

      // Place features and specs
      let featureY = startY;
      for (const feature of group.features) {
        const specs = group.featureSpecs.get(feature.id) || [];
        const blockHeight = Math.max(NODE_HEIGHT, specs.length * NODE_HEIGHT);

        const featureCenterY = featureY + blockHeight / 2 - NODE_HEIGHT / 2;
        addNode(feature, baseX + LANE_WIDTH, featureCenterY);

        const specStartY = featureY + (blockHeight - specs.length * NODE_HEIGHT) / 2;
        specs.forEach((spec: any, i: number) => {
          addNode(spec, baseX + LANE_WIDTH * 2, specStartY + i * NODE_HEIGHT);
        });

        featureY += blockHeight;
      }

      columnY[col] = startY + group.height + ROW_GAP;
    }

    // Mark overview as assigned (don't display it)
    rawNodes.filter((n: any) => n.type === "overview").forEach((n: any) => assignedIds.add(n.id));

    // Place orphan nodes
    const orphans = rawNodes.filter((n: any) => !assignedIds.has(n.id));
    if (orphans.length > 0) {
      const maxY = Math.max(...columnY);
      orphans.forEach((node: any, i: number) => {
        addNode(node, 0, maxY + ROW_GAP + i * NODE_HEIGHT);
      });
    }

    return result;
  }, [rawNodes, selectedNodeId, focusSet, adjDown, graphColumns]);

  // Filter out edges connected to overview nodes
  const visibleNodeIds = useMemo(() => new Set(rfNodes.map((n) => n.id)), [rfNodes]);

  const rfEdges: RFEdge[] = useMemo(() => {
    return rawEdges
      .filter((e: any) => visibleNodeIds.has(e.from_node_id) && visibleNodeIds.has(e.to_node_id))
      .map((e: any) => {
        const isFocused = focusSet
          ? focusSet.has(e.from_node_id) && focusSet.has(e.to_node_id)
          : true;
        const isReference = e.link_type === "references";
        return {
          id: e.id,
          source: e.from_node_id,
          target: e.to_node_id,
          animated: false,
          style: {
            stroke: isReference ? "#9B59B6" : "#94a3b8",
            strokeWidth: 2,
            strokeDasharray: isReference ? "5,5" : undefined,
            opacity: isFocused ? 1 : 0.5,
          },
        };
      });
  }, [rawEdges, visibleNodeIds, focusSet]);

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

  // Lane headers for 2 columns
  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
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
