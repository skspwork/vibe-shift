import { eq } from "drizzle-orm";
import { db, rawDb, schema } from "../db/index.js";

export async function getProjectGraph(projectId: string, includeDisabled = false) {
  const nodes = includeDisabled
    ? await db.select().from(schema.nodes).where(eq(schema.nodes.project_id, projectId))
    : rawDb.prepare("SELECT * FROM nodes WHERE project_id = ? AND disabled_at IS NULL").all(projectId) as any[];

  const allEdges = await db.select().from(schema.edges);

  // Filter edges to only those within this project's nodes
  const nodeIds = new Set(nodes.map((n: any) => n.id));
  const edges = allEdges.filter(
    (e) => nodeIds.has(e.from_node_id) && nodeIds.has(e.to_node_id)
  );

  return { nodes, edges };
}
