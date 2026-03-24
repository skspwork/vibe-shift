import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { CreateProjectSchema } from "@cddai/shared";

const app = new Hono();

app.get("/", async (c) => {
  const rows = await db.select().from(schema.projects);
  const projects = rows.map((r) => ({
    ...r,
    active_lanes: JSON.parse(r.active_lanes),
  }));
  return c.json(projects);
});

app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = CreateProjectSchema.parse(body);
  const now = new Date().toISOString();
  const projectId = uuid();

  // Create project
  await db.insert(schema.projects).values({
    id: projectId,
    name: parsed.name,
    active_lanes: JSON.stringify(parsed.active_lanes),
    created_at: now,
  });

  // Create overview node
  const overviewContent = [
    `目的・背景: ${parsed.purpose}`,
    parsed.scope ? `スコープ: ${parsed.scope}` : null,
    parsed.stakeholders ? `ステークホルダー: ${parsed.stakeholders}` : null,
    parsed.constraints ? `技術的制約: ${parsed.constraints}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const overviewId = uuid();
  await db.insert(schema.nodes).values({
    id: overviewId,
    project_id: projectId,
    type: "overview",
    title: parsed.name,
    content: overviewContent,
    created_by: "user",
    created_at: now,
    updated_at: now,
  });

  return c.json(
    {
      id: projectId,
      name: parsed.name,
      active_lanes: parsed.active_lanes,
      created_at: now,
      overview_id: overviewId,
    },
    201
  );
});

app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [row] = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, id));
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json({ ...row, active_lanes: JSON.parse(row.active_lanes) });
});

export default app;
