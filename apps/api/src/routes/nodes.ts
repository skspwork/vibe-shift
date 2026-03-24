import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { eq, like, and, inArray } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { CreateNodeSchema, UpdateNodeSchema } from "@cddai/shared";
import { getNodeContext, getNodeTrace } from "../services/contextService.js";

const app = new Hono();

app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = CreateNodeSchema.parse(body);
  const now = new Date().toISOString();
  const nodeId = uuid();

  await db.insert(schema.nodes).values({
    id: nodeId,
    project_id: parsed.project_id,
    type: parsed.type,
    title: parsed.title,
    content: parsed.content,
    rationale_note: parsed.rationale_note || null,
    created_by: parsed.created_by,
    created_at: now,
    updated_at: now,
  });

  // Create edge from parent
  const edgeId = uuid();
  await db.insert(schema.edges).values({
    id: edgeId,
    from_node_id: parsed.parent_id,
    to_node_id: nodeId,
    link_type: "derives",
    created_at: now,
  });

  const [node] = await db
    .select()
    .from(schema.nodes)
    .where(eq(schema.nodes.id, nodeId));

  return c.json(node, 201);
});

app.get("/search", async (c) => {
  const projectId = c.req.query("project_id");
  const query = c.req.query("query") || "";
  const types = c.req.query("types")?.split(",");

  if (!projectId) return c.json({ error: "project_id required" }, 400);

  let results = await db
    .select()
    .from(schema.nodes)
    .where(eq(schema.nodes.project_id, projectId));

  if (query) {
    results = results.filter(
      (n) =>
        n.title.toLowerCase().includes(query.toLowerCase()) ||
        n.content.toLowerCase().includes(query.toLowerCase())
    );
  }
  if (types && types.length > 0) {
    results = results.filter((n) => types.includes(n.type));
  }

  return c.json(results);
});

app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [node] = await db
    .select()
    .from(schema.nodes)
    .where(eq(schema.nodes.id, id));
  if (!node) return c.json({ error: "Not found" }, 404);
  return c.json(node);
});

app.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = UpdateNodeSchema.parse(body);
  const now = new Date().toISOString();

  await db
    .update(schema.nodes)
    .set({ ...parsed, updated_at: now })
    .where(eq(schema.nodes.id, id));

  const [node] = await db
    .select()
    .from(schema.nodes)
    .where(eq(schema.nodes.id, id));
  return c.json(node);
});

app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  // Delete related edges
  await db
    .delete(schema.edges)
    .where(eq(schema.edges.from_node_id, id));
  await db
    .delete(schema.edges)
    .where(eq(schema.edges.to_node_id, id));
  // Delete conv messages if conv
  await db
    .delete(schema.conv_messages)
    .where(eq(schema.conv_messages.conv_node_id, id));
  await db.delete(schema.nodes).where(eq(schema.nodes.id, id));
  return c.json({ ok: true });
});

app.get("/:id/conv", async (c) => {
  const nodeId = c.req.param("id");

  // Find conv nodes that are parents of this node (via edges)
  const parentEdges = await db
    .select()
    .from(schema.edges)
    .where(eq(schema.edges.to_node_id, nodeId));

  for (const edge of parentEdges) {
    const [parentNode] = await db
      .select()
      .from(schema.nodes)
      .where(eq(schema.nodes.id, edge.from_node_id));
    if (parentNode && parentNode.type === "conv") {
      const messages = await db
        .select()
        .from(schema.conv_messages)
        .where(eq(schema.conv_messages.conv_node_id, parentNode.id));
      return c.json({
        conv_node: parentNode,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });
    }
  }

  return c.json(null);
});

app.get("/:id/trace", async (c) => {
  const nodeId = c.req.param("id");
  const direction = (c.req.query("direction") as "upstream" | "downstream" | "both") || "both";
  const result = await getNodeTrace(nodeId, direction);
  return c.json(result);
});

app.get("/:id/context", async (c) => {
  const nodeId = c.req.param("id");
  const context = await getNodeContext(nodeId);
  return c.json({ context });
});

export default app;
