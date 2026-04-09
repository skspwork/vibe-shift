import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { eq, and, inArray } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { CreateProjectSchema, UpdateProjectSchema } from "@vibeshift/shared";

const app = new Hono();

app.get("/", async (c) => {
  const rows = await db.select().from(schema.projects);
  const projects = rows.map((r) => ({
    ...r,
    active_lanes: JSON.parse(r.active_lanes),
    node_instructions: r.node_instructions ? JSON.parse(r.node_instructions) : undefined,
  }));
  return c.json(projects);
});

app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = CreateProjectSchema.parse(body);
  const now = new Date().toISOString();

  // Duplicate name check
  const [existing] = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.name, parsed.name));
  if (existing) {
    return c.json(
      { error: `同名のプロジェクト「${parsed.name}」が既に存在します (id: ${existing.id})` },
      409
    );
  }

  const projectId = uuid();

  // Create project
  await db.insert(schema.projects).values({
    id: projectId,
    name: parsed.name,
    active_lanes: JSON.stringify(["need", "feature"]),
    node_instructions: parsed.node_instructions ? JSON.stringify(parsed.node_instructions) : null,
    created_at: now,
  });

  // Create overview node
  const overviewContent = [
    `目的・背景: ${parsed.purpose}`,
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
      active_lanes: ["need", "feature"],
      node_instructions: parsed.node_instructions,
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
  if (parsed.node_instructions !== undefined)
    updates.node_instructions = parsed.node_instructions ? JSON.stringify(parsed.node_instructions) : null;

  if (Object.keys(updates).length > 0) {
    await db
      .update(schema.projects)
      .set(updates)
      .where(eq(schema.projects.id, id));
  }

  // Update overview node content if project info fields changed
  if (parsed.name || parsed.purpose !== undefined || parsed.constraints !== undefined) {
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
  return c.json({
    ...updated,
    active_lanes: JSON.parse(updated.active_lanes),
    node_instructions: updated.node_instructions ? JSON.parse(updated.node_instructions) : undefined,
  });
});

app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [row] = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, id));
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json({
    ...row,
    active_lanes: JSON.parse(row.active_lanes),
    node_instructions: row.node_instructions ? JSON.parse(row.node_instructions) : undefined,
  });
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

  // Get all changelog IDs belonging to this project
  const projectChangelogs = await db
    .select({ id: schema.changelogs.id })
    .from(schema.changelogs)
    .where(eq(schema.changelogs.project_id, id));
  const changelogIds = projectChangelogs.map((c) => c.id);

  // Delete changelog_reasons for these changelogs
  if (changelogIds.length > 0) {
    await db
      .delete(schema.changelog_reasons)
      .where(inArray(schema.changelog_reasons.changelog_id, changelogIds));
  }

  if (nodeIds.length > 0) {
    // Delete node_changelogs for these nodes
    await db
      .delete(schema.node_changelogs)
      .where(inArray(schema.node_changelogs.node_id, nodeIds));

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

  // Delete changelogs
  if (changelogIds.length > 0) {
    await db
      .delete(schema.changelogs)
      .where(eq(schema.changelogs.project_id, id));
  }

  // Delete the project
  await db.delete(schema.projects).where(eq(schema.projects.id, id));

  return c.json({ ok: true });
});

export default app;
