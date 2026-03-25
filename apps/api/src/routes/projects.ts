import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { eq, and, inArray } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { CreateProjectSchema, UpdateProjectSchema } from "@cddai/shared";

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
    methodology: parsed.methodology,
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
      methodology: parsed.methodology,
      created_at: now,
      overview_id: overviewId,
    },
    201
  );
});

app.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = UpdateProjectSchema.parse(body);

  const [existing] = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, id));
  if (!existing) return c.json({ error: "Not found" }, 404);

  const updates: Record<string, any> = {};
  if (parsed.name !== undefined) updates.name = parsed.name;
  if (parsed.methodology !== undefined) updates.methodology = parsed.methodology;
  if (parsed.active_lanes !== undefined)
    updates.active_lanes = JSON.stringify(parsed.active_lanes);

  if (Object.keys(updates).length > 0) {
    await db
      .update(schema.projects)
      .set(updates)
      .where(eq(schema.projects.id, id));
  }

  // Update overview node content if project info fields changed
  if (parsed.name || parsed.purpose !== undefined || parsed.scope !== undefined || parsed.stakeholders !== undefined || parsed.constraints !== undefined) {
    const overviewNodes = await db
      .select()
      .from(schema.nodes)
      .where(
        and(
          eq(schema.nodes.project_id, id),
          eq(schema.nodes.type, "overview")
        )
      );
    if (overviewNodes.length > 0) {
      const overview = overviewNodes[0];
      const nodeUpdates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (parsed.name) nodeUpdates.title = parsed.name;

      // Rebuild content from existing + new values
      const existingContent = overview.content || "";
      const fields = {
        "目的・背景": parsed.purpose,
        "スコープ": parsed.scope,
        "ステークホルダー": parsed.stakeholders,
        "技術的制約": parsed.constraints,
      };

      const lines = existingContent.split("\n");
      for (const [label, newValue] of Object.entries(fields)) {
        if (newValue === undefined) continue;
        const idx = lines.findIndex((l: string) => l.startsWith(`${label}: `));
        if (newValue) {
          if (idx >= 0) {
            lines[idx] = `${label}: ${newValue}`;
          } else {
            lines.push(`${label}: ${newValue}`);
          }
        } else if (idx >= 0) {
          lines.splice(idx, 1);
        }
      }
      nodeUpdates.content = lines.filter((l: string) => l.trim()).join("\n");

      await db
        .update(schema.nodes)
        .set(nodeUpdates)
        .where(eq(schema.nodes.id, overview.id));
    }
  }

  const [updated] = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, id));
  return c.json({ ...updated, active_lanes: JSON.parse(updated.active_lanes) });
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

app.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const [existing] = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, id));
  if (!existing) return c.json({ error: "Not found" }, 404);

  // Get all node IDs belonging to this project
  const projectNodes = await db
    .select({ id: schema.nodes.id })
    .from(schema.nodes)
    .where(eq(schema.nodes.project_id, id));
  const nodeIds = projectNodes.map((n) => n.id);

  // Get all conversation IDs belonging to this project
  const projectConvs = await db
    .select({ id: schema.conversations.id })
    .from(schema.conversations)
    .where(eq(schema.conversations.project_id, id));
  const convIds = projectConvs.map((c) => c.id);

  // Delete conv_messages for these conversations
  if (convIds.length > 0) {
    await db
      .delete(schema.conv_messages)
      .where(inArray(schema.conv_messages.conversation_id, convIds));
  }

  if (nodeIds.length > 0) {
    // Delete edges referencing these nodes
    await db
      .delete(schema.edges)
      .where(inArray(schema.edges.from_node_id, nodeIds));
    await db
      .delete(schema.edges)
      .where(inArray(schema.edges.to_node_id, nodeIds));

    // Delete nodes
    await db
      .delete(schema.nodes)
      .where(eq(schema.nodes.project_id, id));
  }

  // Delete conversations
  if (convIds.length > 0) {
    await db
      .delete(schema.conversations)
      .where(eq(schema.conversations.project_id, id));
  }

  // Delete the project
  await db.delete(schema.projects).where(eq(schema.projects.id, id));

  return c.json({ ok: true });
});

export default app;
