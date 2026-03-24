import { eq, and } from "drizzle-orm";
import { db, schema } from "../db/index.js";

export async function getProjectGraph(projectId: string, includeConv = false) {
  const allNodes = await db
    .select()
    .from(schema.nodes)
    .where(eq(schema.nodes.project_id, projectId));

  const allEdges = await db.select().from(schema.edges);

  // Filter edges to only those within this project's nodes
  const nodeIds = new Set(allNodes.map((n) => n.id));
  let filteredEdges = allEdges.filter(
    (e) => nodeIds.has(e.from_node_id) && nodeIds.has(e.to_node_id)
  );

  if (includeConv) {
    return { nodes: allNodes, edges: filteredEdges };
  }

  // Filter out conv nodes
  const convNodeIds = new Set(
    allNodes.filter((n) => n.type === "conv").map((n) => n.id)
  );
  const visibleNodes = allNodes.filter((n) => n.type !== "conv");

  // Rebuild edges: skip conv nodes, connect parent to child directly
  const resolvedEdges: typeof filteredEdges = [];
  for (const edge of filteredEdges) {
    if (convNodeIds.has(edge.from_node_id) && convNodeIds.has(edge.to_node_id)) {
      continue; // both are conv, skip
    }
    if (convNodeIds.has(edge.from_node_id)) {
      // from is conv: find what points to this conv
      const parentEdge = filteredEdges.find(
        (e) => e.to_node_id === edge.from_node_id
      );
      if (parentEdge) {
        resolvedEdges.push({
          ...edge,
          from_node_id: parentEdge.from_node_id,
        });
      }
    } else if (convNodeIds.has(edge.to_node_id)) {
      // to is conv: find children of this conv
      const childEdges = filteredEdges.filter(
        (e) => e.from_node_id === edge.to_node_id && !convNodeIds.has(e.to_node_id)
      );
      for (const child of childEdges) {
        resolvedEdges.push({
          ...edge,
          to_node_id: child.to_node_id,
        });
      }
    } else {
      resolvedEdges.push(edge);
    }
  }

  // Deduplicate edges
  const seen = new Set<string>();
  const uniqueEdges = resolvedEdges.filter((e) => {
    const key = `${e.from_node_id}-${e.to_node_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { nodes: visibleNodes, edges: uniqueEdges };
}
