import { eq } from "drizzle-orm";
import { db, rawDb, schema } from "../db/index.js";
import { NODE_LABELS, DEFAULT_NODE_INSTRUCTIONS } from "@vibeshift/shared";

export async function getNodeContext(nodeId: string): Promise<string> {
  const allNodes = rawDb.prepare("SELECT * FROM nodes WHERE disabled_at IS NULL").all() as any[];
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

  // Walk up to collect ancestor chain
  const ancestors: typeof allNodes = [];
  let currentId: string | undefined = nodeId;
  while (currentId) {
    const parentId = parentMap.get(currentId);
    if (parentId) {
      const parent = nodeMap.get(parentId);
      if (parent) {
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

export async function getProjectContext(projectId: string): Promise<string> {
  const allNodes = rawDb.prepare("SELECT * FROM nodes WHERE project_id = ? AND disabled_at IS NULL").all(projectId) as any[];
  const allEdges = await db.select().from(schema.edges);

  // Fetch project for node_instructions
  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId));

  // Filter edges to only those within this project's nodes
  const nodeIds = new Set(allNodes.map((n) => n.id));
  const projectEdges = allEdges.filter(
    (e) => nodeIds.has(e.from_node_id) && nodeIds.has(e.to_node_id) && e.link_type === "derives"
  );

  const nodeMap = new Map(allNodes.map((n) => [n.id, n]));

  // Build children map (parent -> children[])
  const childrenMap = new Map<string, string[]>();
  for (const edge of projectEdges) {
    const children = childrenMap.get(edge.from_node_id) || [];
    children.push(edge.to_node_id);
    childrenMap.set(edge.from_node_id, children);
  }

  const overviewNode = allNodes.find((n) => n.type === "overview");

  let context = "";
  if (overviewNode) {
    context += `[プロジェクト概要]\n  名前: ${overviewNode.title}\n  内容: ${overviewNode.content}\n\n`;
  }

  // Include node_instructions (fall back to defaults)
  const projectInstructions = project?.node_instructions
    ? JSON.parse(project.node_instructions)
    : {};
  const mergedInstructions = { ...DEFAULT_NODE_INSTRUCTIONS, ...projectInstructions };
  // Remove entries with empty string (explicitly cleared)
  const entries = Object.entries(mergedInstructions).filter(([, rule]) => rule);
  if (entries.length > 0) {
    context += `[ノード記述ルール]\n`;
    for (const [nodeType, rule] of entries) {
      const label = NODE_LABELS[nodeType] || nodeType;
      context += `  ${label}（${nodeType}）: ${rule}\n`;
    }
    context += `\n`;
  }

  // Build tree recursively
  const nonOverviewNodes = allNodes.filter((n) => n.type !== "overview");
  if (nonOverviewNodes.length === 0) {
    context += "[既存ノード]\n  （なし）\n";
    return context;
  }

  context += "[既存ノード一覧]\n";

  function renderTree(nodeId: string, indent: number) {
    const node = nodeMap.get(nodeId);
    if (!node || node.type === "overview") return;
    const prefix = "  ".repeat(indent);
    const contentPreview = node.content.length > 100
      ? node.content.substring(0, 100) + "..."
      : node.content;
    context += `${prefix}[${node.type}] ${node.title} (id: ${node.id})\n`;
    if (contentPreview) {
      context += `${prefix}  内容: ${contentPreview}\n`;
    }
    const children = childrenMap.get(nodeId) || [];
    for (const childId of children) {
      renderTree(childId, indent + 1);
    }
  }

  // Start from overview's children (top-level needs)
  if (overviewNode) {
    const topLevel = childrenMap.get(overviewNode.id) || [];
    for (const childId of topLevel) {
      renderTree(childId, 1);
    }
  }

  return context;
}

export async function getNodeTrace(nodeId: string, direction: "upstream" | "downstream" | "both" = "both") {
  const allNodes = rawDb.prepare("SELECT * FROM nodes WHERE disabled_at IS NULL").all() as any[];
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
