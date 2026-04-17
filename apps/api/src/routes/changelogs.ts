import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { db, schema } from "../db/index.js";

const app = new Hono();

app.post("/", async (c) => {
  const body = await c.req.json();
  const { project_id, title } = body;
  if (!project_id || !title) return c.json({ error: "project_id and title required" }, 400);

  const id = uuid();
  const now = new Date().toISOString();
  await db.insert(schema.changelogs).values({
    id,
    project_id,
    title,
    created_at: now,
  });

  return c.json({ id, project_id, title, created_at: now }, 201);
});

app.post("/:id/reasons", async (c) => {
  const changelogId = c.req.param("id");
  const body = await c.req.json();
  const { role, content, user_name } = body;
  if (!role || !content) return c.json({ error: "role and content required" }, 400);

  const msgId = uuid();
  await db.insert(schema.changelog_reasons).values({
    id: msgId,
    changelog_id: changelogId,
    role,
    user_name: user_name ?? null,
    content,
    created_at: new Date().toISOString(),
  });

  return c.json({ id: msgId }, 201);
});

export default app;
