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
    conversation_id: parsed.conversation_id || null,
    created_by: parsed.created_by,
    created_at: now,
    updated_at: now,
  });

  // Always link from parent to new node
  await db.insert(schema.edges).values({
    id: uuid(),
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

  // Prevent overview deletion
  const [target] = await db
    .select()
    .from(schema.nodes)
    .where(eq(schema.nodes.id, id));
  if (!target) return c.json({ error: "Not found" }, 404);
  if (target.type === "overview")
    return c.json({ error: "Cannot delete overview node" }, 400);

  // Collect all descendant node IDs (BFS via edges)
  const allEdges = await db.select().from(schema.edges);
  const childMap = new Map<string, string[]>();
  for (const e of allEdges) {
    const children = childMap.get(e.from_node_id) || [];
    children.push(e.to_node_id);
    childMap.set(e.from_node_id, children);
  }

  const toDelete = new Set<string>();
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (toDelete.has(current)) continue;
    toDelete.add(current);
    for (const child of childMap.get(current) || []) {
      queue.push(child);
    }
  }

  // Delete all in order: edges -> nodes
  for (const nodeId of toDelete) {
    await db.delete(schema.edges).where(eq(schema.edges.from_node_id, nodeId));
    await db.delete(schema.edges).where(eq(schema.edges.to_node_id, nodeId));
  }
  for (const nodeId of toDelete) {
    await db.delete(schema.nodes).where(eq(schema.nodes.id, nodeId));
  }

  return c.json({ ok: true, deleted_count: toDelete.size });
});

app.get("/:id/conv", async (c) => {
  const nodeId = c.req.param("id");

  const [node] = await db
    .select()
    .from(schema.nodes)
    .where(eq(schema.nodes.id, nodeId));
  if (!node || !node.conversation_id) return c.json(null);

  const [conversation] = await db
    .select()
    .from(schema.conversations)
    .where(eq(schema.conversations.id, node.conversation_id));
  if (!conversation) return c.json(null);

  const messages = await db
    .select()
    .from(schema.conv_messages)
    .where(eq(schema.conv_messages.conversation_id, conversation.id));

  return c.json({
    conversation,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
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
