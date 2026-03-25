import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";

export async function getProjectGraph(projectId: string) {
  const nodes = await db
    .select()
    .from(schema.nodes)
    .where(eq(schema.nodes.project_id, projectId));

  const allEdges = await db.select().from(schema.edges);

  // Filter edges to only those within this project's nodes
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = allEdges.filter(
    (e) => nodeIds.has(e.from_node_id) && nodeIds.has(e.to_node_id)
  );

  return { nodes, edges };
}
