import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { NODE_LABELS } from "@cddai/shared";

export async function getNodeContext(nodeId: string): Promise<string> {
  const allNodes = await db.select().from(schema.nodes);
  const allEdges = await db.select().from(schema.edges);

  const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
  const targetNode = nodeMap.get(nodeId);
  if (!targetNode) throw new Error("Node not found");

  // Build parent map (to_node_id -> from_node_id)
  const parentMap = new Map<string, string>();
  for (const edge of allEdges) {
    if (edge.link_type === "derives") {
      parentMap.set(edge.to_node_id, edge.from_node_id);
    }
  }

  // Walk up to collect ancestor chain (skip conv nodes)
  const ancestors: typeof allNodes = [];
  let currentId: string | undefined = nodeId;
  while (currentId) {
    const parentId = parentMap.get(currentId);
    if (parentId) {
      const parent = nodeMap.get(parentId);
      if (parent && parent.type !== "conv") {
        ancestors.unshift(parent);
      }
      currentId = parentId;
    } else {
      currentId = undefined;
    }
  }

  // Find overview node
  const overviewNode = allNodes.find(
    (n) => n.project_id === targetNode.project_id && n.type === "overview"
  );

  let context = "";
  if (overviewNode) {
    context += `[システム概要]\n  ${overviewNode.title}: ${overviewNode.content}\n\n`;
  }

  if (ancestors.length > 0) {
    context += "[上流コンテキスト]\n";
    for (const a of ancestors) {
      if (a.type !== "overview") {
        const label = NODE_LABELS[a.type] || a.type;
        context += `  [${a.type}] ${a.title}: ${a.content}\n`;
      }
    }
    context += "\n";
  }

  if (targetNode.type !== "overview") {
    context += `[対象ノード]\n`;
    context += `  種別: ${targetNode.type}\n`;
    context += `  タイトル: ${targetNode.title}\n`;
    context += `  内容: ${targetNode.content}\n`;
  }

  return context;
}

export async function getNodeTrace(nodeId: string, direction: "upstream" | "downstream" | "both" = "both") {
  const allNodes = await db.select().from(schema.nodes);
  const allEdges = await db.select().from(schema.edges);

  const nodeMap = new Map(allNodes.map((n) => [n.id, n]));

  const result = new Set<string>();
  result.add(nodeId);

  if (direction === "upstream" || direction === "both") {
    const queue = [nodeId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const edge of allEdges) {
        if (edge.to_node_id === current && !result.has(edge.from_node_id)) {
          result.add(edge.from_node_id);
          queue.push(edge.from_node_id);
        }
      }
    }
  }

  if (direction === "downstream" || direction === "both") {
    const queue = [nodeId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const edge of allEdges) {
        if (edge.from_node_id === current && !result.has(edge.to_node_id)) {
          result.add(edge.to_node_id);
          queue.push(edge.to_node_id);
        }
      }
    }
  }

  const traceNodes = Array.from(result)
    .map((id) => nodeMap.get(id))
    .filter(Boolean);
  const traceEdges = allEdges.filter(
    (e) => result.has(e.from_node_id) && result.has(e.to_node_id)
  );

  return { nodes: traceNodes, edges: traceEdges };
}
