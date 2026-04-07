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
  feature: { bg: "#E1F5EE", border: "#1D9E75", text: "#0d4a36" },
  spec: { bg: "#EEEDFE", border: "#7F77DD", text: "#3a356a" },
};

const LANE_ORDER = ["overview", "need", "feature", "spec"];

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

  // Layout
  const rfNodes: RFNode[] = useMemo(() => {
    const NODE_HEIGHT = 100;
    const SUB_NODE_HEIGHT = 60;
    const ROW_GAP = 20;
    const LANE_WIDTH = 220;
    const SUB_NODE_X_OFFSET = LANE_WIDTH;

    // Lane X positions
    const laneX: Record<string, number> = {};
    LANE_ORDER.forEach((lane, li) => { laneX[lane] = li * LANE_WIDTH; });

    const nodeMap = new Map(rawNodes.map((n: any) => [n.id, n]));
    const overviewNodes = rawNodes.filter((n: any) => n.type === "overview");
    const needNodes = rawNodes.filter((n: any) => n.type === "need");
    const assignedIds = new Set<string>();

    const result: RFNode[] = [];
    const addNode = (node: any, x: number, y: number, isSubNode: boolean = false) => {
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
          isSubNode,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      });
    };

    // Build row groups: each need + its feature descendants + spec sub-nodes
    const rowGroups = needNodes.map((need: any) => {
      assignedIds.add(need.id);
      const features: any[] = [];
      const featureSubNodes = new Map<string, any[]>();

      // Find feature children of this need
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
            // Collect spec sub-nodes via BFS
            const subs: any[] = [];
            const subQueue = [child.id];
            const subVisited = new Set([child.id]);
            while (subQueue.length > 0) {
              const sid = subQueue.shift()!;
              for (const descId of adjDown.get(sid) || []) {
                if (subVisited.has(descId)) continue;
                subVisited.add(descId);
                const descNode = nodeMap.get(descId);
                if (descNode && descNode.type === "spec") {
                  subs.push(descNode);
                  assignedIds.add(descNode.id);
                  subQueue.push(descId);
                }
              }
            }
            featureSubNodes.set(child.id, subs);
          } else if (child.type !== "spec") {
            queue.push(childId);
          }
        }
      }

      const totalFeaturesHeight = features.length > 0
        ? features.reduce((sum, f) => {
            const subs = featureSubNodes.get(f.id) || [];
            return sum + Math.max(NODE_HEIGHT, subs.length * SUB_NODE_HEIGHT);
          }, 0)
        : NODE_HEIGHT;

      return { need, features, featureSubNodes, height: totalFeaturesHeight };
    });

    const startY = 60;
    let currentY = startY;

    for (const group of rowGroups) {
      const needY = currentY + group.height / 2 - NODE_HEIGHT / 2;
      addNode(group.need, laneX["need"], needY);

      let featureY = currentY;
      for (const feature of group.features) {
        const subs = group.featureSubNodes.get(feature.id) || [];
        const featureBlockHeight = Math.max(NODE_HEIGHT, subs.length * SUB_NODE_HEIGHT);

        const featureCenterY = featureY + featureBlockHeight / 2 - NODE_HEIGHT / 2;
        addNode(feature, laneX["feature"], featureCenterY);

        // Place spec sub-nodes to the right of feature
        const subX = laneX["feature"] + SUB_NODE_X_OFFSET;
        const subStartY = featureY + (featureBlockHeight - subs.length * SUB_NODE_HEIGHT) / 2;
        subs.forEach((sub: any, i: number) => {
          addNode(sub, subX, subStartY + i * SUB_NODE_HEIGHT, true);
        });

        featureY += featureBlockHeight;
      }

      currentY += group.height + ROW_GAP;
    }

    const totalHeight = Math.max(currentY - startY - ROW_GAP, 0);

    // Place overview nodes at vertical center
    const overviewBlockHeight = overviewNodes.length * NODE_HEIGHT;
    const centerY = startY + totalHeight / 2 - overviewBlockHeight / 2;
    overviewNodes.forEach((node: any, i: number) => {
      assignedIds.add(node.id);
      addNode(node, laneX["overview"], centerY + i * NODE_HEIGHT);
    });

    // Place orphan nodes
    const orphans = rawNodes.filter((n: any) => !assignedIds.has(n.id));
    if (orphans.length > 0) {
      const orphanStartY = currentY + ROW_GAP;
      orphans.forEach((node: any, i: number) => {
        const x = laneX[node.type] ?? laneX["feature"] ?? 440;
        addNode(node, x, orphanStartY + i * NODE_HEIGHT);
      });
    }

    return result;
  }, [rawNodes, selectedNodeId, focusSet, adjDown]);

  const rfEdges: RFEdge[] = useMemo(() => {
    return rawEdges.map((e: any) => {
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
