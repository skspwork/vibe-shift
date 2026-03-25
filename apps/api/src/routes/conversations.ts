import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";

const app = new Hono();

app.post("/", async (c) => {
  const body = await c.req.json();
  const { project_id, title } = body;
  if (!project_id || !title) return c.json({ error: "project_id and title required" }, 400);

  const id = uuid();
  const now = new Date().toISOString();
  await db.insert(schema.conversations).values({
    id,
    project_id,
    title,
    created_at: now,
  });

  return c.json({ id, project_id, title, created_at: now }, 201);
});

app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [conv] = await db
    .select()
    .from(schema.conversations)
    .where(eq(schema.conversations.id, id));
  if (!conv) return c.json({ error: "Not found" }, 404);

  const messages = await db
    .select()
    .from(schema.conv_messages)
    .where(eq(schema.conv_messages.conversation_id, id));

  return c.json({
    conversation: conv,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
});

app.post("/:id/messages", async (c) => {
  const conversationId = c.req.param("id");
  const body = await c.req.json();
  const { role, content } = body;
  if (!role || !content) return c.json({ error: "role and content required" }, 400);

  const msgId = uuid();
  await db.insert(schema.conv_messages).values({
    id: msgId,
    conversation_id: conversationId,
    role,
    content,
    created_at: new Date().toISOString(),
  });

  return c.json({ id: msgId }, 201);
});

export default app;
