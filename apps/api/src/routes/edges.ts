import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { CreateEdgeSchema } from "@vibeshift/shared";

const app = new Hono();

app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = CreateEdgeSchema.parse(body);
  const now = new Date().toISOString();
  const edgeId = uuid();

  await db.insert(schema.edges).values({
    id: edgeId,
    from_node_id: parsed.from_node_id,
    to_node_id: parsed.to_node_id,
    link_type: parsed.link_type,
    created_at: now,
  });

  const [edge] = await db
    .select()
    .from(schema.edges)
    .where(eq(schema.edges.id, edgeId));
  return c.json(edge, 201);
});

app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await db.delete(schema.edges).where(eq(schema.edges.id, id));
  return c.json({ ok: true });
});

export default app;
